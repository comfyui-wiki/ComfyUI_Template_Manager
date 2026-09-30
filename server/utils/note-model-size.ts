import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { formatModelFileSize, isAllowedModelDownloadUrl } from '~/lib/model-file-size'
import {
  fileSizeFromHeaderDump,
  findNoteSizeGaps,
  noteTextsNeedingSizes,
  applyModelSizeLabels,
} from '~/lib/note-model-size'
import { gitAdd, gitCommit, isLocalRepoMode, readRepoText, resolveRepoPath, writeRepoText } from '~/server/utils/local-repo'

const execFileAsync = promisify(execFile)
const TEMPLATE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export type NoteSizeTemplate = {
  name: string
  missingCount: number
  nodeIds: string[]
  samples: string[]
}

function templatePath(name: string): string {
  if (!TEMPLATE_NAME.test(name)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid template name' })
  }
  return `templates/${name}.json`
}

async function listWorkflowFiles(): Promise<string[]> {
  const templatesDir = resolveRepoPath('templates')
  const entries = await fs.readdir(templatesDir)
  return entries.filter(filename => filename.endsWith('.json') && !filename.startsWith('index')).sort()
}

export async function scanNoteModelSizes(): Promise<{
  available: boolean
  checkedWorkflows: number
  missingTemplates: number
  templates: NoteSizeTemplate[]
}> {
  if (!isLocalRepoMode()) return { available: false, checkedWorkflows: 0, missingTemplates: 0, templates: [] }

  const templates: NoteSizeTemplate[] = []
  const files = await listWorkflowFiles()
  for (const filename of files) {
    const name = filename.replace(/\.json$/i, '')
    let workflow: unknown
    try {
      workflow = JSON.parse(await fs.readFile(join(resolveRepoPath('templates'), filename), 'utf-8'))
    } catch {
      continue
    }
    const gaps = findNoteSizeGaps(workflow)
    if (!gaps.length) continue
    const urls = new Set(gaps.flatMap(gap => gap.missing.map(link => link.url)))
    const samples = gaps.flatMap(gap => gap.missing.map(link => link.label)).slice(0, 3)
    templates.push({
      name,
      missingCount: urls.size,
      nodeIds: gaps.map(gap => gap.nodeId),
      samples
    })
  }

  return {
    available: true,
    checkedWorkflows: files.length,
    missingTemplates: templates.length,
    templates
  }
}

async function readSize(url: string): Promise<number | null> {
  if (!isAllowedModelDownloadUrl(url)) return null
  try {
    const { stdout } = await execFileAsync('curl', [
      '-sI',
      '-L',
      '--max-redirs',
      '5',
      '--max-time',
      '20',
      url
    ], { maxBuffer: 256 * 1024 })
    return fileSizeFromHeaderDump(stdout)
  } catch {
    return null
  }
}

async function readSizes(urls: string[]): Promise<Record<string, string>> {
  const labels: Record<string, string> = {}
  const queue = [...urls]
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift()
      if (!url) return
      const bytes = await readSize(url)
      const label = bytes == null ? null : formatModelFileSize(bytes)
      if (label) labels[url] = label
    }
  })
  await Promise.all(workers)
  return labels
}

export async function fixNoteModelSizes(name: string): Promise<{
  applied: number
  stillMissing: number
  commit: string | null
}> {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 400, statusMessage: 'Note size fix is only available in local repo mode' })
  }

  const path = templatePath(name)
  const raw = await readRepoText(path)
  const workflow = JSON.parse(raw)
  const texts = noteTextsNeedingSizes(workflow)
  const urls = [...new Set(findNoteSizeGaps(workflow).flatMap(gap => gap.missing.map(link => link.url)))]
  if (!urls.length) return { applied: 0, stillMissing: 0, commit: null }

  const labels = await readSizes(urls)
  if (!Object.keys(labels).length) {
    return { applied: 0, stillMissing: urls.length, commit: null }
  }

  let next = raw
  let applied = 0
  for (const text of texts) {
    const updated = applyModelSizeLabels(text, labels)
    if (!updated.applied || updated.text === text) continue
    const from = JSON.stringify(text).slice(1, -1)
    const to = JSON.stringify(updated.text).slice(1, -1)
    if (!next.includes(from)) continue
    next = next.split(from).join(to)
    applied += updated.applied
  }

  if (next === raw) return { applied: 0, stillMissing: urls.length, commit: null }

  await writeRepoText(path, next)
  await gitAdd([path])
  const sha = await gitCommit(`Add model file sizes to the note in ${name}`)
  const stillMissing = findNoteSizeGaps(JSON.parse(next)).reduce((sum, gap) => sum + gap.missing.length, 0)
  return { applied, stillMissing, commit: sha }
}
