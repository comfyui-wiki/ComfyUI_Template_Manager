import { ref, computed } from 'vue'

export interface UpstreamCompareInfo {
  compareRef: string
  available: boolean
  error?: string
  status?: 'identical' | 'ahead' | 'behind' | 'diverged'
  aheadBy?: number
  behindBy?: number
  isBehind?: boolean
  isAhead?: boolean
  isDiverged?: boolean
}

export interface RepoModeInfo {
  loaded: boolean
  mode: 'github' | 'local'
  localRepoMode: boolean
  repoPath?: string
  displayName?: string
  compareRef?: string
  branch?: string
  commitSha?: string
  dirty?: boolean
  changedFiles?: string[]
  upstreamCompare?: UpstreamCompareInfo
}

const modeInfo = ref<RepoModeInfo>({
  loaded: false,
  mode: 'github',
  localRepoMode: false
})

let loadPromise: Promise<RepoModeInfo> | null = null

export const useRepoMode = () => {
  const isLocalMode = computed(() => modeInfo.value.localRepoMode === true)

  const loadMode = async (force = false): Promise<RepoModeInfo> => {
    if (!force && modeInfo.value.loaded) {
      return modeInfo.value
    }

    if (!force && loadPromise) {
      return loadPromise
    }

    loadPromise = (async () => {
      try {
        const response = await $fetch<Omit<RepoModeInfo, 'loaded'>>('/api/local/mode')
        modeInfo.value = {
          ...response,
          loaded: true,
          mode: response.localRepoMode ? 'local' : 'github'
        }
      } catch {
        modeInfo.value = {
          loaded: true,
          mode: 'github',
          localRepoMode: false
        }
      } finally {
        loadPromise = null
      }
      return modeInfo.value
    })()

    return loadPromise
  }

  const refreshMode = async () => loadMode(true)

  const fetchUpstream = async (): Promise<UpstreamCompareInfo | null> => {
    try {
      const response = await $fetch<{ success: boolean; comparison: UpstreamCompareInfo; message?: string }>(
        '/api/local/git/fetch',
        { method: 'POST' }
      )
      if (modeInfo.value.localRepoMode && response.comparison) {
        modeInfo.value = {
          ...modeInfo.value,
          upstreamCompare: response.comparison
        }
      }
      return response.comparison ?? null
    } catch (error) {
      console.error('[useRepoMode] Failed to fetch upstream:', error)
      return null
    }
  }

  return {
    modeInfo,
    isLocalMode,
    loadMode,
    refreshMode,
    fetchUpstream
  }
}
