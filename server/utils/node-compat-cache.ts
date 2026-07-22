import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { NodeCompatScanResult } from '~/lib/node-compat/types'

const CACHE_DIR = '.cache'
const OBJECT_INFO_FILE = 'comfyui-object-info.json'
const SCAN_RESULTS_FILE = 'node-compat-results.json'

export interface ObjectInfoCacheEntry {
  baseUrl: string
  fetchedAt: string
  nodeCount: number
  data: Record<string, unknown>
}

export interface ScanResultsCacheEntry {
  baseUrl: string
  objectInfoFetchedAt: string
  workflowFingerprint: string
  scannerVersion: string
  result: NodeCompatScanResult
}

function projectCacheDir(): string {
  return join(process.cwd(), CACHE_DIR)
}

function objectInfoCachePath(): string {
  return join(projectCacheDir(), OBJECT_INFO_FILE)
}

function scanResultsCachePath(): string {
  return join(projectCacheDir(), SCAN_RESULTS_FILE)
}

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim()
  if (url.endsWith('/')) url = url.slice(0, -1)
  return url
}

export function hashObjectInfo(data: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)
}

export const SCANNER_VERSION = '3'

export function buildWorkflowFingerprint(
  workflows: Array<{ name: string, content: string }>
): string {
  const payload = workflows
    .map(workflow => `${workflow.name}:${createHash('sha256').update(workflow.content).digest('hex').slice(0, 12)}`)
    .join('|')
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(projectCacheDir(), { recursive: true })
}

export async function readObjectInfoCache(baseUrl: string): Promise<ObjectInfoCacheEntry | null> {
  try {
    const raw = await fs.readFile(objectInfoCachePath(), 'utf-8')
    const entry = JSON.parse(raw) as ObjectInfoCacheEntry
    if (normalizeBaseUrl(entry.baseUrl) !== normalizeBaseUrl(baseUrl)) return null
    if (typeof entry.data !== 'object' || entry.data === null) return null
    return entry
  } catch {
    return null
  }
}

export async function writeObjectInfoCache(
  baseUrl: string,
  data: Record<string, unknown>
): Promise<ObjectInfoCacheEntry> {
  await ensureCacheDir()
  const entry: ObjectInfoCacheEntry = {
    baseUrl: normalizeBaseUrl(baseUrl),
    fetchedAt: new Date().toISOString(),
    nodeCount: Object.keys(data).length,
    data
  }
  await fs.writeFile(objectInfoCachePath(), JSON.stringify(entry, null, 2), 'utf-8')
  return entry
}

export async function readScanResultsCache(
  baseUrl: string,
  workflowFingerprint: string,
  objectInfoFetchedAt: string
): Promise<NodeCompatScanResult | null> {
  try {
    const raw = await fs.readFile(scanResultsCachePath(), 'utf-8')
    const entry = JSON.parse(raw) as ScanResultsCacheEntry
    if (normalizeBaseUrl(entry.baseUrl) !== normalizeBaseUrl(baseUrl)) return null
    if (entry.workflowFingerprint !== workflowFingerprint) return null
    if (entry.objectInfoFetchedAt !== objectInfoFetchedAt) return null
    if (entry.scannerVersion !== SCANNER_VERSION) return null
    if (!entry.result?.available) return null
    return entry.result
  } catch {
    return null
  }
}

export async function writeScanResultsCache(
  baseUrl: string,
  workflowFingerprint: string,
  objectInfoFetchedAt: string,
  result: NodeCompatScanResult
): Promise<void> {
  await ensureCacheDir()
  const entry: ScanResultsCacheEntry = {
    baseUrl: normalizeBaseUrl(baseUrl),
    objectInfoFetchedAt,
    workflowFingerprint,
    scannerVersion: SCANNER_VERSION,
    result
  }
  await fs.writeFile(scanResultsCachePath(), JSON.stringify(entry, null, 2), 'utf-8')
}
