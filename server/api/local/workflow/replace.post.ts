import { parseWorkflowFilename } from '~/lib/workflow-filename'
import {
  gitAdd,
  gitCommit,
  isLocalRepoMode,
  readRepoJson,
  writeRepoText
} from '~/server/utils/local-repo'

interface ReplaceItem {
  filename: string
  content: string
}

interface ReplaceResult {
  filename: string
  templateName?: string
  path?: string
  success: boolean
  message: string
}

function collectTemplateNames(indexData: unknown): Set<string> {
  const names = new Set<string>()
  if (!Array.isArray(indexData)) return names
  for (const category of indexData) {
    if (!category || typeof category !== 'object') continue
    const templates = (category as { templates?: unknown[] }).templates
    if (!Array.isArray(templates)) continue
    for (const tpl of templates) {
      if (tpl && typeof tpl === 'object' && (tpl as { name?: string }).name) {
        names.add(String((tpl as { name: string }).name))
      }
    }
  }
  return names
}

export default defineEventHandler(async (event) => {
  if (!isLocalRepoMode()) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Workflow replace is only available in local repo mode'
    })
  }

  const body = await readBody<{
    files?: ReplaceItem[]
    commit?: boolean
  }>(event)

  const files = body.files ?? []
  if (files.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No workflow files provided'
    })
  }

  const indexData = await readRepoJson('templates/index.json')
  const knownTemplates = collectTemplateNames(indexData)

  const results: ReplaceResult[] = []
  const changedPaths: string[] = []

  for (const file of files) {
    const filename = String(file.filename || '').trim()
    const parsed = parseWorkflowFilename(filename)

    if (!parsed) {
      results.push({
        filename,
        success: false,
        message: 'Filename must end with .json or .app.json'
      })
      continue
    }

    if (!knownTemplates.has(parsed.templateName)) {
      results.push({
        filename,
        templateName: parsed.templateName,
        success: false,
        message: `No template named "${parsed.templateName}" in templates/index.json`
      })
      continue
    }

    let workflowData: unknown
    try {
      workflowData = JSON.parse(file.content)
    } catch {
      results.push({
        filename,
        templateName: parsed.templateName,
        success: false,
        message: 'Invalid JSON content'
      })
      continue
    }

    const formatted = `${JSON.stringify(workflowData, null, 2)}\n`
    await writeRepoText(parsed.repoPath, formatted)
    changedPaths.push(parsed.repoPath)

    results.push({
      filename,
      templateName: parsed.templateName,
      path: parsed.repoPath,
      success: true,
      message: 'Replaced'
    })
  }

  const successCount = results.filter(r => r.success).length
  let commitSha: string | null = null

  if (successCount > 0 && body.commit !== false) {
    await gitAdd(changedPaths)
    const names = results.filter(r => r.success).map(r => r.templateName).join(', ')
    commitSha = await gitCommit(`Replace workflow file(s): ${names}`)
  }

  return {
    success: successCount > 0,
    replaced: successCount,
    failed: results.length - successCount,
    results,
    commit: commitSha ? { sha: commitSha } : null
  }
})
