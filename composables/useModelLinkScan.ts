import { ref, computed, watch } from 'vue'
import type { ModelLinkScanResult, TemplateModelLinkResult } from '~/lib/model-link-scan/types'

const scanResult = ref<ModelLinkScanResult | null>(null)
const isScanning = ref(false)
const hasAttemptedScan = ref(false)
const scanError = ref<string | null>(null)
let autoScanWatcherStarted = false
let pendingRescan = false

function startAutoScanWatcher(scanModelLinks: () => Promise<void>) {
  if (!import.meta.client || autoScanWatcherStarted) return
  autoScanWatcherStarted = true

  const { modeInfo, loadMode } = useRepoMode()

  watch(
    () => modeInfo.value.loaded && modeInfo.value.localRepoMode,
    (isLocal) => {
      if (isLocal) void scanModelLinks()
    }
  )

  void loadMode(true)
}

export const useModelLinkScan = () => {
  const { modeInfo, loadMode } = useRepoMode()

  const isAvailable = computed(() => scanResult.value?.available === true)
  const templateResults = computed(() => scanResult.value?.results ?? {})

  const getTemplateModelLinks = (templateName: string): TemplateModelLinkResult | null => {
    if (!isAvailable.value) return null
    return templateResults.value[templateName] ?? null
  }

  const scanStats = computed(() => {
    if (!isAvailable.value || !scanResult.value?.results) return null
    const values = Object.values(scanResult.value.results)
    return {
      total: values.length,
      ok: values.filter(result => result.status === 'ok').length,
      error: values.filter(result => result.status === 'error').length,
      checkedWorkflows: scanResult.value.checkedWorkflows ?? values.length,
      issueTemplates: scanResult.value.issueTemplates ?? values.filter(result => result.status === 'error').length
    }
  })

  const issueSummaries = computed(() => {
    if (!isAvailable.value || !scanResult.value?.results) return []
    return Object.entries(scanResult.value.results)
      .filter(([, result]) => result.status === 'error')
      .map(([name, result]) => ({
        name,
        issueCount: result.issueCount,
        preview: result.issues[0]?.message ?? ''
      }))
  })

  const scanModelLinks = async () => {
    if (!import.meta.client) return

    if (isScanning.value) {
      pendingRescan = true
      return
    }

    isScanning.value = true
    scanError.value = null
    try {
      const mode = await loadMode()
      if (!mode.localRepoMode) {
        hasAttemptedScan.value = true
        scanResult.value = { available: false }
        return
      }

      scanResult.value = await $fetch<ModelLinkScanResult>('/api/local/model-links-scan')
      if (!scanResult.value.available) {
        scanError.value = 'Model link scan is only available in local repo mode.'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[useModelLinkScan] scan failed:', error)
      scanResult.value = { available: false }
      scanError.value = message
    } finally {
      hasAttemptedScan.value = true
      isScanning.value = false
      if (pendingRescan) {
        pendingRescan = false
        void scanModelLinks()
      }
    }
  }

  const resetScan = () => {
    scanResult.value = null
    hasAttemptedScan.value = false
    scanError.value = null
    pendingRescan = false
  }

  const showModelLinkFilter = computed(() =>
    modeInfo.value.localRepoMode
    && (hasAttemptedScan.value || isScanning.value || isAvailable.value)
  )

  startAutoScanWatcher(scanModelLinks)

  return {
    scanResult,
    isScanning,
    isAvailable,
    scanError,
    showModelLinkFilter,
    scanStats,
    issueSummaries,
    templateResults,
    getTemplateModelLinks,
    scanModelLinks,
    resetScan
  }
}
