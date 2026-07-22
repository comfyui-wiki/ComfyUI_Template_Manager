import { ref, computed, watch } from 'vue'
import type { NodeCompatScanResult, TemplateCompatResult } from '~/lib/node-compat/types'

const scanResult = ref<NodeCompatScanResult | null>(null)
const isScanning = ref(false)
const hasAttemptedScan = ref(false)
const scanError = ref<string | null>(null)
let autoScanWatcherStarted = false

function getLocalComfyBaseUrl(): string {
  if (!import.meta.client) return 'http://127.0.0.1:8188'
  return localStorage.getItem('comfyui_local_base_url')?.trim() || 'http://127.0.0.1:8188'
}

function startAutoScanWatcher(scanNodeCompat: (force?: boolean) => Promise<void>) {
  if (!import.meta.client || autoScanWatcherStarted) return
  autoScanWatcherStarted = true

  const { modeInfo, loadMode } = useRepoMode()

  watch(
    () => modeInfo.value.loaded && modeInfo.value.localRepoMode,
    (isLocal) => {
      if (isLocal) void scanNodeCompat()
    }
  )

  void loadMode(true)
}

export const useNodeCompat = () => {
  const { modeInfo, loadMode } = useRepoMode()

  const isAvailable = computed(() => scanResult.value?.available === true)

  const templateResults = computed(() => scanResult.value?.results ?? {})

  const getTemplateCompat = (templateName: string): TemplateCompatResult | null => {
    if (!isAvailable.value) return null
    return templateResults.value[templateName] ?? null
  }

  const scanStats = computed(() => {
    if (!isAvailable.value || !scanResult.value?.results) return null
    const values = Object.values(scanResult.value.results)
    return {
      total: values.length,
      ok: values.filter(r => r.status === 'ok').length,
      warning: values.filter(r => r.status === 'warning').length,
      error: values.filter(r => r.status === 'error').length,
      issueTemplates: values.filter(r => r.status === 'error' || r.status === 'warning').length,
      nodeCount: scanResult.value.nodeCount ?? 0,
      sourceUrl: scanResult.value.sourceUrl,
      fromCache: scanResult.value.fromCache === true,
      objectInfoCachedAt: scanResult.value.objectInfoCachedAt
    }
  })

  const scanNodeCompat = async (force = false) => {
    if (!import.meta.client) return
    if (isScanning.value) return
    if (hasAttemptedScan.value && !force && scanResult.value?.available) return

    const mode = await loadMode(true)
    if (!mode.localRepoMode) {
      hasAttemptedScan.value = true
      scanResult.value = { available: false }
      scanError.value = null
      return
    }

    isScanning.value = true
    scanError.value = null
    try {
      const baseUrl = getLocalComfyBaseUrl()
      const response = await $fetch<NodeCompatScanResult>('/api/comfyui/node-compat', {
        query: {
          baseUrl,
          ...(force ? { forceRefresh: 'true' } : {})
        }
      })
      scanResult.value = response
      if (!response.available) {
        scanError.value = 'Node baseline unavailable. Start ComfyUI or check local cache.'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[useNodeCompat] scan failed:', error)
      scanResult.value = { available: false }
      scanError.value = message
    } finally {
      hasAttemptedScan.value = true
      isScanning.value = false
    }
  }

  const resetScan = () => {
    scanResult.value = null
    hasAttemptedScan.value = false
    scanError.value = null
  }

  const showNodeCompatFilter = computed(() =>
    modeInfo.value.localRepoMode
    && (hasAttemptedScan.value || isScanning.value || isAvailable.value)
  )

  startAutoScanWatcher(scanNodeCompat)

  return {
    scanResult,
    isScanning,
    isAvailable,
    scanError,
    showNodeCompatFilter,
    scanStats,
    templateResults,
    getTemplateCompat,
    scanNodeCompat,
    resetScan
  }
}
