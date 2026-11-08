/**
 * GET /api/templates/content-diff
 * Query: { owner, repo, branch }
 *
 * Reports which templates' workflow JSON (templates/<name>.json) differs from the
 * compare branch, so the dashboard can flag body-only edits (e.g. MarkdownNote text)
 * that never show up in templates/index.json metadata.
 *
 * - local mode: `git diff --name-only <compareRef> -- templates` (working tree, so
 *   uncommitted edits count too)
 * - github mode: GitHub compare API (complete file list); falls back to comparing the
 *   per-asset sha256 values in the generated manifest
 */
import { getServerSession } from '#auth'
import { gitExec, isLocalRepoMode, resolveCompareRef } from '~/server/utils/local-repo'
import {
  diffWorkflowAssetShas,
  templateNamesFromChangedFiles,
  type TemplateManifest
} from '~/lib/template-content-diff'

const MANIFEST_PATH = 'packages/core/src/comfyui_workflow_templates_core/manifest.json'
// GitHub's compare endpoint truncates `files` at 300 entries.
const COMPARE_FILES_LIMIT = 300

const githubHeaders = (): Record<string, string> => ({
  'User-Agent': 'ComfyUI-Template-CMS',
  Accept: 'application/vnd.github.v3+json'
})

async function namesFromCompareApi(
  headers: Record<string, string>,
  owner: string,
  repo: string,
  branch: string
): Promise<string[] | null> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/compare/main...${branch}`
    const response = await fetch(url, { headers })
    if (!response.ok) return null

    const data = await response.json() as { files?: Array<{ filename?: string }> }
    if (!Array.isArray(data.files)) return null

    if (data.files.length >= COMPARE_FILES_LIMIT) {
      console.warn(`[content-diff API] compare result truncated at ${COMPARE_FILES_LIMIT} files`)
    }
    return templateNamesFromChangedFiles(data.files.map(file => file.filename ?? ''))
  } catch (error: any) {
    console.warn('[content-diff API] compare API failed:', error?.message)
    return null
  }
}

async function fetchManifest(
  headers: Record<string, string>,
  owner: string,
  repo: string,
  ref: string
): Promise<TemplateManifest | null> {
  try {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${MANIFEST_PATH}`
    const response = await fetch(url, { headers })
    if (!response.ok) return null
    return await response.json() as TemplateManifest
  } catch (error: any) {
    console.warn(`[content-diff API] manifest fetch failed (${ref}):`, error?.message)
    return null
  }
}

async function namesFromManifests(
  headers: Record<string, string>,
  owner: string,
  repo: string,
  branch: string
): Promise<string[] | null> {
  const [current, base] = await Promise.all([
    fetchManifest(headers, owner, repo, branch),
    fetchManifest(headers, owner, repo, 'main')
  ])
  if (!current || !base) return null
  return diffWorkflowAssetShas(current, base)
}

export default defineEventHandler(async (event) => {
  const { owner, repo, branch = 'main' } = getQuery(event)

  if (isLocalRepoMode()) {
    try {
      const compareRef = await resolveCompareRef()
      const diff = await gitExec(['diff', '--name-only', compareRef, '--', 'templates'])
      return {
        success: true,
        names: templateNamesFromChangedFiles(diff.split('\n')),
        source: 'git' as const,
        compareRef
      }
    } catch (error: any) {
      console.warn('[content-diff API] git diff failed:', error?.message)
      return {
        success: false,
        names: [] as string[],
        source: 'git' as const,
        error: error?.message || 'git diff failed'
      }
    }
  }

  if (!owner || !repo) {
    throw createError({ statusCode: 400, message: 'Owner and repo are required' })
  }

  const branchName = String(branch)
  if (String(owner) === 'Comfy-Org' && String(repo) === 'workflow_templates' && branchName === 'main') {
    return { success: true, names: [] as string[], source: 'main' as const }
  }

  const session = await getServerSession(event)
  const headers = githubHeaders()
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`

  const fromCompare = await namesFromCompareApi(headers, String(owner), String(repo), branchName)
  if (fromCompare) {
    return { success: true, names: fromCompare, source: 'compare-api' as const }
  }

  const fromManifest = await namesFromManifests(headers, String(owner), String(repo), branchName)
  if (fromManifest) {
    return { success: true, names: fromManifest, source: 'manifest' as const }
  }

  return {
    success: false,
    names: [] as string[],
    source: 'manifest' as const,
    error: 'Unable to resolve changed workflow files (compare API and manifest both unavailable)'
  }
})
