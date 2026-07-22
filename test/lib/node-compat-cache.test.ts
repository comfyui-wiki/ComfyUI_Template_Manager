import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildWorkflowFingerprint,
  readObjectInfoCache,
  readScanResultsCache,
  writeObjectInfoCache,
  writeScanResultsCache
} from '../../server/utils/node-compat-cache'

describe('node-compat-cache', () => {
  let cacheRoot = ''

  beforeEach(() => {
    cacheRoot = mkdtempSync(join(tmpdir(), 'node-compat-cache-'))
    vi.spyOn(process, 'cwd').mockReturnValue(cacheRoot)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(cacheRoot, { recursive: true, force: true })
  })

  it('writes and reads object_info cache', async () => {
    const entry = await writeObjectInfoCache('http://127.0.0.1:8188', {
      KSampler: { display_name: 'KSampler' }
    })

    expect(entry.nodeCount).toBe(1)
    const cached = await readObjectInfoCache('http://127.0.0.1:8188/')
    expect(cached?.data.KSampler).toBeTruthy()
    expect(readFileSync(join(cacheRoot, '.cache', 'comfyui-object-info.json'), 'utf-8')).toContain('KSampler')
  })

  it('writes and reads scan results cache keyed by workflow fingerprint', async () => {
    const objectInfo = await writeObjectInfoCache('http://127.0.0.1:8188', { A: {} })
    const workflows = [{ name: 'demo', content: '{"nodes":[]}' }]
    const fingerprint = buildWorkflowFingerprint(workflows)
    const result = {
      available: true,
      nodeCount: 1,
      checkedWorkflows: 1,
      results: {
        demo: { status: 'ok', errorCount: 0, warningCount: 0, issues: [] }
      }
    } as const

    await writeScanResultsCache('http://127.0.0.1:8188', fingerprint, objectInfo.fetchedAt, result)

    const cached = await readScanResultsCache('http://127.0.0.1:8188', fingerprint, objectInfo.fetchedAt)
    expect(cached?.results?.demo.status).toBe('ok')
    expect(await readScanResultsCache('http://127.0.0.1:8188', 'other', objectInfo.fetchedAt)).toBeNull()
  })
})
