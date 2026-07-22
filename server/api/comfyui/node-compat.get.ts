import { promises as fs } from 'fs'
import {
  DEFAULT_BASE_URL,
  fetchObjectInfo,
  OBJECT_INFO_REFRESH_TIMEOUT_MS,
  scanWithObjectInfo
} from '~/lib/node-compat/scan'
import type { NodeCompatScanResult } from '~/lib/node-compat/types'
import {
  buildWorkflowFingerprint,
  readObjectInfoCache,
  readScanResultsCache,
  writeObjectInfoCache,
  writeScanResultsCache
} from '~/server/utils/node-compat-cache'
import { isLocalRepoMode, readRepoJson, repoFileExists, resolveRepoPath } from '~/server/utils/local-repo'

async function collectWorkflowSources(templateNames: string[]): Promise<Array<{ name: string, content: string }>> {
  const workflows: Array<{ name: string, content: string }> = []

  for (const templateName of templateNames) {
    const candidates = [
      `templates/${templateName}.json`,
      `templates/${templateName}.app.json`
    ]

    for (const relativePath of candidates) {
      if (!(await repoFileExists(relativePath))) continue
      const content = await fs.readFile(resolveRepoPath(relativePath), 'utf-8')
      workflows.push({ name: templateName, content })
      break
    }
  }

  return workflows
}

function collectTemplateNames(indexData: unknown): string[] {
  if (!Array.isArray(indexData)) return []
  const names = new Set<string>()
  for (const category of indexData) {
    if (typeof category !== 'object' || category === null) continue
    const templates = (category as Record<string, unknown>).templates
    if (!Array.isArray(templates)) continue
    for (const template of templates) {
      if (typeof template === 'object' && template !== null && typeof (template as Record<string, unknown>).name === 'string') {
        names.add((template as Record<string, unknown>).name as string)
      }
    }
  }
  return [...names].sort()
}

async function resolveNodeCompatScan(
  baseUrl: string,
  workflows: Array<{ name: string, content: string }>,
  forceRefresh: boolean
): Promise<NodeCompatScanResult> {
  const workflowFingerprint = buildWorkflowFingerprint(workflows)

  if (!forceRefresh) {
    const cachedObjectInfo = await readObjectInfoCache(baseUrl)
    if (cachedObjectInfo) {
      const cachedScan = await readScanResultsCache(
        baseUrl,
        workflowFingerprint,
        cachedObjectInfo.fetchedAt
      )
      if (cachedScan) {
        return {
          ...cachedScan,
          fromCache: true,
          objectInfoCachedAt: cachedObjectInfo.fetchedAt
        }
      }
    }
  }

  const liveObjectInfo = await fetchObjectInfo(baseUrl, OBJECT_INFO_REFRESH_TIMEOUT_MS)
  if (liveObjectInfo) {
    const objectInfoCache = await writeObjectInfoCache(baseUrl, liveObjectInfo)
    const result = scanWithObjectInfo(baseUrl, liveObjectInfo, workflows)
    await writeScanResultsCache(
      baseUrl,
      workflowFingerprint,
      objectInfoCache.fetchedAt,
      result
    )
    return result
  }

  const cachedObjectInfo = await readObjectInfoCache(baseUrl)
  if (!cachedObjectInfo) {
    return { available: false }
  }

  const cachedScan = !forceRefresh
    ? await readScanResultsCache(baseUrl, workflowFingerprint, cachedObjectInfo.fetchedAt)
    : null

  if (cachedScan) {
    return {
      ...cachedScan,
      fromCache: true,
      objectInfoCachedAt: cachedObjectInfo.fetchedAt
    }
  }

  const result = scanWithObjectInfo(baseUrl, cachedObjectInfo.data, workflows)
  result.fromCache = true
  result.objectInfoCachedAt = cachedObjectInfo.fetchedAt
  await writeScanResultsCache(
    baseUrl,
    workflowFingerprint,
    cachedObjectInfo.fetchedAt,
    result
  )
  return result
}

export default defineEventHandler(async (event) => {
  if (!isLocalRepoMode()) {
    return { available: false }
  }

  const query = getQuery(event)
  const baseUrl = typeof query.baseUrl === 'string' && query.baseUrl.trim()
    ? query.baseUrl.trim()
    : DEFAULT_BASE_URL
  const forceRefresh = query.forceRefresh === 'true' || query.forceRefresh === '1'

  try {
    const indexData = await readRepoJson('templates/index.json')
    const templateNames = collectTemplateNames(indexData)
    const workflows = await collectWorkflowSources(templateNames)
    return await resolveNodeCompatScan(baseUrl, workflows, forceRefresh)
  } catch (error) {
    console.warn('[node-compat] scan failed:', error)
    return { available: false }
  }
})
