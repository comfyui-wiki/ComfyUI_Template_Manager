import { ref, computed, watch } from 'vue'

// Helper: Get from localStorage with fallback
const getStoredValue = (key: string, defaultValue: any) => {
  if (process.client) {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  }
  return defaultValue
}

// Global state - shared across all components with persistence
const hasMainRepoAccess = ref(false)
const hasFork = ref(false)
const selectedRepo = ref(getStoredValue('github_selected_repo', ''))
const selectedBranch = ref(getStoredValue('github_selected_branch', 'main'))
const branches = ref<any[]>([])
const isLoading = ref(false)
const forkInfo = ref<any>(null)
const branchPermission = ref<any>(null)
const forkCompareStatus = ref<any>(null)

// Watch and persist repo/branch selection
if (process.client) {
  watch(selectedRepo, (value) => {
    localStorage.setItem('github_selected_repo', JSON.stringify(value))
  })

  watch(selectedBranch, (value) => {
    localStorage.setItem('github_selected_branch', JSON.stringify(value))
  })
}

export const useGitHubRepo = () => {
  // Main repository info
  const mainRepo = {
    owner: 'Comfy-Org',
    name: 'workflow_templates',
    fullName: 'Comfy-Org/workflow_templates'
  }

  // Get auth state
  const { data: session, status } = useAuth()

  // Check if user has write access to main repo
  const checkMainRepoAccess = async () => {
    if (status.value !== 'authenticated' || !session.value?.user?.login) {
      hasMainRepoAccess.value = false
      return false
    }

    try {
      const response = await $fetch('/api/github/permission', {
        query: {
          username: session.value.user.login
        }
      })
      hasMainRepoAccess.value = response.hasAccess
      return response.hasAccess
    } catch (error) {
      console.error('Failed to check repo access:', error)
      hasMainRepoAccess.value = false
      return false
    }
  }

  // Check if user has forked the repo
  const checkForkExists = async () => {
    if (status.value !== 'authenticated' || !session.value?.user?.login) {
      console.log('[useGitHubRepo] Not authenticated or no username, skipping fork check')
      hasFork.value = false
      return false
    }

    const username = session.value.user.login
    console.log('[useGitHubRepo] Checking fork for username:', username)

    try {
      const response = await $fetch('/api/github/fork/check', {
        query: {
          username
        }
      })
      console.log('[useGitHubRepo] Fork check response:', response)
      hasFork.value = response.exists
      if (response.exists) {
        forkInfo.value = response.fork
        console.log('[useGitHubRepo] Fork found:', response.fork)

        // Also check if fork is behind upstream
        await checkForkStatus()
      } else {
        console.log('[useGitHubRepo] Fork does not exist')
      }
      return response.exists
    } catch (error) {
      console.error('[useGitHubRepo] Failed to check fork:', error)
      hasFork.value = false
      return false
    }
  }

  // Check if fork is behind upstream
  const checkForkStatus = async () => {
    if (!hasFork.value || !session.value?.user?.login) {
      console.log('[useGitHubRepo] No fork or not authenticated, skipping fork status check')
      forkCompareStatus.value = null
      return null
    }

    const username = session.value.user.login
    console.log('[useGitHubRepo] Checking fork status for:', username)

    try {
      const response = await $fetch('/api/github/fork/compare', {
        query: {
          username
        }
      })
      console.log('[useGitHubRepo] Fork compare response:', response)
      forkCompareStatus.value = response
      return response
    } catch (error) {
      console.error('[useGitHubRepo] Failed to check fork status:', error)
      forkCompareStatus.value = null
      return null
    }
  }

  // Sync fork with upstream
  const syncFork = async () => {
    if (!hasFork.value) {
      console.log('[useGitHubRepo] No fork to sync')
      return { success: false, error: 'No fork found' }
    }

    isLoading.value = true
    try {
      console.log('[useGitHubRepo] Syncing fork...')
      const response = await $fetch('/api/github/fork/sync', {
        method: 'POST'
      })
      console.log('[useGitHubRepo] Fork sync response:', response)

      // Refresh fork status after sync
      if (response.success) {
        await checkForkStatus()
      }

      return response
    } catch (error: any) {
      console.error('[useGitHubRepo] Failed to sync fork:', error)
      return { success: false, error: error.message }
    } finally {
      isLoading.value = false
    }
  }

  // Create a fork
  const createFork = async () => {
    if (status.value !== 'authenticated') return

    isLoading.value = true
    try {
      const response = await $fetch('/api/github/fork/create', {
        method: 'POST'
      })
      hasFork.value = true
      forkInfo.value = response.fork
      return response.fork
    } catch (error) {
      console.error('Failed to create fork:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Get branches for a repository
  const loadBranches = async (owner: string, repo: string) => {
    isLoading.value = true
    try {
      const response = await $fetch('/api/github/branches', {
        query: { owner, repo }
      })
      branches.value = response.branches
      return response.branches
    } catch (error) {
      console.error('Failed to load branches:', error)
      branches.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  // Create a new branch
  const createBranch = async (owner: string, repo: string, branchName: string, fromBranch: string = 'main') => {
    isLoading.value = true
    try {
      const response = await $fetch('/api/github/branch/create', {
        method: 'POST',
        body: {
          owner,
          repo,
          branch: branchName,
          from: fromBranch
        }
      })

      // Reload branches
      await loadBranches(owner, repo)

      return response
    } catch (error) {
      console.error('Failed to create branch:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Available repositories for the user
  const availableRepos = computed(() => {
    const repos: any[] = []

    // Always show main repo (read-only if no access)
    repos.push({
      owner: mainRepo.owner,
      name: mainRepo.name,
      fullName: mainRepo.fullName,
      type: 'main',
      label: hasMainRepoAccess.value
        ? 'Comfy-Org/workflow_templates (Main)'
        : 'Comfy-Org/workflow_templates (Read-only)',
      canEdit: hasMainRepoAccess.value
    })

    // Add fork if exists
    if (hasFork.value && session.value?.user?.login) {
      repos.push({
        owner: session.value.user.login,
        name: mainRepo.name,
        fullName: `${session.value.user.login}/workflow_templates`,
        type: 'fork',
        label: `${session.value.user.login}/workflow_templates (Fork)`,
        canEdit: true
      })
    }

    return repos
  })

  // Check branch-level permission
  const checkBranchPermission = async (owner: string, repo: string, branch: string) => {
    if (status.value !== 'authenticated') {
      branchPermission.value = null
      return null
    }

    try {
      console.log(`[useGitHubRepo] Checking branch permission for ${owner}/${repo}/${branch}`)
      const response = await $fetch('/api/github/branch-permission', {
        query: { owner, repo, branch }
      })
      branchPermission.value = response
      console.log('[useGitHubRepo] Branch permission:', response)
      return response
    } catch (error) {
      console.error('[useGitHubRepo] Failed to check branch permission:', error)
      branchPermission.value = null
      return null
    }
  }

  // Repository-level write access (for creating branches, forks, etc.)
  const hasRepoWriteAccess = computed(() => {
    if (!selectedRepo.value) return false

    const [owner] = selectedRepo.value.split('/')

    // If user owns the repository (their fork), they have write access
    if (owner === session.value?.user?.login) {
      return true
    }

    // For main repo, check if user has collaborator access
    if (hasMainRepoAccess.value) {
      // If we have permission data, check the permission level
      if (branchPermission.value?.permission) {
        return branchPermission.value.permission === 'write' ||
               branchPermission.value.permission === 'admin'
      }
      // If no detailed permission yet, trust hasMainRepoAccess
      return true
    }

    return false
  })

  // Can edit current repository and branch (push to current branch)
  const canEditCurrentRepo = computed(() => {
    // Get fresh auth state inside computed to ensure we have latest session
    const { data: currentSession } = useAuth()

    console.log('[canEditCurrentRepo] Computing...', {
      selectedRepo: selectedRepo.value,
      selectedBranch: selectedBranch.value,
      sessionUserLogin: currentSession.value?.user?.login,
      branchPermission: branchPermission.value,
      hasMainRepoAccess: hasMainRepoAccess.value
    })

    if (!selectedRepo.value || !selectedBranch.value) {
      console.log('[canEditCurrentRepo] Missing repo or branch')
      return false
    }

    const [owner] = selectedRepo.value.split('/')
    console.log('[canEditCurrentRepo] Owner:', owner)

    // If user owns the repository (their fork), check branch permission
    if (owner === currentSession.value?.user?.login) {
      console.log('[canEditCurrentRepo] User owns the repo')
      // User owns the repo, check if branch is protected
      if (branchPermission.value) {
        const canPush = branchPermission.value.canPush === true
        console.log('[canEditCurrentRepo] Branch permission exists, canPush:', canPush)
        return canPush
      }
      // If no permission data yet, assume true for own repo
      console.log('[canEditCurrentRepo] No permission data yet, assuming true for own repo')
      return true
    }

    // For main repo, check if user has access and branch allows push
    if (hasMainRepoAccess.value) {
      console.log('[canEditCurrentRepo] Has main repo access')
      if (branchPermission.value) {
        const canPush = branchPermission.value.canPush === true
        console.log('[canEditCurrentRepo] Branch permission exists, canPush:', canPush)
        return canPush
      }
      // If no permission data yet, use general access
      console.log('[canEditCurrentRepo] No permission data yet, using general access')
      return true
    }

    console.log('[canEditCurrentRepo] No access, returning false')
    return false
  })

  // Initialize: check permissions and fork status
  // Reset to main repo and main branch (called on sign out)
  const resetToMain = () => {
    console.log('[useGitHubRepo] Resetting to main repo and branch')
    selectedRepo.value = 'Comfy-Org/workflow_templates'
    selectedBranch.value = 'main'
    hasMainRepoAccess.value = false
    hasFork.value = false
    branches.value = []
    forkInfo.value = null
    branchPermission.value = null
    forkCompareStatus.value = null

    // Clear localStorage
    if (process.client) {
      localStorage.removeItem('github_selected_repo')
      localStorage.removeItem('github_selected_branch')
    }
  }

  const initialize = async () => {
    console.log('[useGitHubRepo] Initializing...')
    if (status.value !== 'authenticated') {
      console.log('[useGitHubRepo] User not authenticated, resetting to main')
      resetToMain()
      return
    }

    console.log('[useGitHubRepo] Checking permissions and fork status...')
    await Promise.all([
      checkMainRepoAccess(),
      checkForkExists()
    ])

    console.log('[useGitHubRepo] Has main repo access:', hasMainRepoAccess.value)
    console.log('[useGitHubRepo] Has fork:', hasFork.value)
    console.log('[useGitHubRepo] Available repos:', availableRepos.value.length)

    // Check if we have persisted repo/branch
    const hasPersistedRepo = selectedRepo.value && selectedRepo.value !== ''
    const hasPersistedBranch = selectedBranch.value && selectedBranch.value !== ''

    console.log('[useGitHubRepo] Persisted values:', {
      repo: selectedRepo.value,
      branch: selectedBranch.value,
      hasPersistedRepo,
      hasPersistedBranch
    })

    if (availableRepos.value.length > 0) {
      // If we have a persisted repo, validate it exists in available repos
      if (hasPersistedRepo) {
        const repoExists = availableRepos.value.find(r => r.fullName === selectedRepo.value)
        if (repoExists) {
          console.log('[useGitHubRepo] Using persisted repo:', selectedRepo.value)
          const [owner, name] = selectedRepo.value.split('/')
          await loadBranches(owner, name)

          // Validate persisted branch exists (if we have one)
          if (hasPersistedBranch) {
            const branchExists = branches.value.find(b => b.name === selectedBranch.value)
            if (branchExists) {
              console.log('[useGitHubRepo] Using persisted branch:', selectedBranch.value)
            } else {
              console.log('[useGitHubRepo] Persisted branch not found, using main')
              selectedBranch.value = 'main'
            }
          } else {
            // No persisted branch, use main
            selectedBranch.value = 'main'
          }
        } else {
          // Persisted repo not available, select first
          console.log('[useGitHubRepo] Persisted repo not available, auto-selecting first')
          selectedRepo.value = availableRepos.value[0].fullName
          const [owner, name] = selectedRepo.value.split('/')
          await loadBranches(owner, name)
          selectedBranch.value = 'main'
        }
      } else {
        // No persisted repo, auto-select first available repo
        selectedRepo.value = availableRepos.value[0].fullName
        console.log('[useGitHubRepo] Auto-selected repo:', selectedRepo.value)
        const [owner, name] = selectedRepo.value.split('/')
        await loadBranches(owner, name)
        selectedBranch.value = 'main'
      }

      console.log('[useGitHubRepo] Final state:', {
        repo: selectedRepo.value,
        branch: selectedBranch.value,
        branchesCount: branches.value.length
      })
    }
  }

  return {
    // State
    hasMainRepoAccess,
    hasFork,
    selectedRepo,
    selectedBranch,
    branches,
    isLoading,
    forkInfo,
    branchPermission,
    forkCompareStatus,
    mainRepo,

    // Computed
    availableRepos,
    hasRepoWriteAccess,
    canEditCurrentRepo,

    // Methods
    checkMainRepoAccess,
    checkForkExists,
    checkForkStatus,
    syncFork,
    checkBranchPermission,
    createFork,
    loadBranches,
    createBranch,
    initialize,
    resetToMain
  }
}
