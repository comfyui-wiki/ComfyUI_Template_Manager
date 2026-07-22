import { buildSpecsFromObjectInfo } from './registry'
import { scanWorkflowJson, summarizeTemplateCompat } from './workflow'
import type { NodeCompatScanResult, TemplateCompatResult } from './types'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8188'
const OBJECT_INFO_TIMEOUT_MS = 8000
const OBJECT_INFO_REFRESH_TIMEOUT_MS = 3000

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim()
  if (url.endsWith('/')) url = url.slice(0, -1)
  return url
}

export async function fetchObjectInfo(
  baseUrl: string,
  timeoutMs = OBJECT_INFO_TIMEOUT_MS
): Promise<Record<string, unknown> | null> {
  const normalized = normalizeBaseUrl(baseUrl)
  const objectInfoUrl = `${normalized}/object_info`

  try {
    const response = await fetch(objectInfoUrl, {
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!response.ok) return null
    const payload = await response.json()
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

export interface WorkflowSource {
  name: string
  content: string
}

export function scanWithObjectInfo(
  baseUrl: string,
  objectInfo: Record<string, unknown>,
  workflows: WorkflowSource[]
): NodeCompatScanResult {
  const specs = buildSpecsFromObjectInfo(objectInfo)
  const results: Record<string, TemplateCompatResult> = {}

  for (const workflow of workflows) {
    try {
      const data = JSON.parse(workflow.content)
      const issues = scanWorkflowJson(workflow.name, data, specs)
      results[workflow.name] = summarizeTemplateCompat(issues)
    } catch (error) {
      results[workflow.name] = summarizeTemplateCompat([{
        severity: 'error',
        kind: 'invalid_json',
        workflow: workflow.name,
        nodeId: '-',
        nodeType: '-',
        message: error instanceof Error ? error.message : String(error)
      }])
    }
  }

  return {
    available: true,
    scanMode: 'runtime',
    sourceUrl: `${normalizeBaseUrl(baseUrl)}/object_info`,
    nodeCount: specs.size,
    checkedWorkflows: workflows.length,
    results
  }
}

export async function scanWorkflowSources(
  baseUrl: string,
  workflows: WorkflowSource[],
  options?: {
    objectInfo?: Record<string, unknown>
    fromCache?: boolean
    objectInfoCachedAt?: string
  }
): Promise<NodeCompatScanResult> {
  const objectInfo = options?.objectInfo ?? await fetchObjectInfo(baseUrl)
  if (!objectInfo) {
    return { available: false }
  }

  const result = scanWithObjectInfo(baseUrl, objectInfo, workflows)
  if (options?.fromCache) {
    result.fromCache = true
    result.objectInfoCachedAt = options.objectInfoCachedAt
  }
  return result
}

export { DEFAULT_BASE_URL, OBJECT_INFO_REFRESH_TIMEOUT_MS }
