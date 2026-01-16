<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">Repository & Branch</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Repository Selector -->
      <div>
        <label class="text-sm font-medium mb-2 block">Repository</label>
        <Select v-model="selectedRepo" @update:modelValue="onRepoChange">
          <SelectTrigger :disabled="availableRepos.length === 0">
            <SelectValue placeholder="Select repository" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="repo in availableRepos"
              :key="repo.fullName"
              :value="repo.fullName"
            >
              <div class="flex items-center gap-2">
                <svg v-if="repo.type === 'main'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <span class="text-sm">{{ repo.label }}</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Fork prompt if no fork exists -->
        <div v-if="!hasFork" class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <p class="text-blue-800 mb-2">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ hasMainRepoAccess
              ? 'Create a fork for experimental changes or independent work'
              : 'Fork the repository to contribute templates' }}
          </p>
          <div class="flex gap-2">
            <Button @click="handleCreateFork" size="sm" class="flex-1" :disabled="isLoading">
              <svg v-if="!isLoading" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <span v-if="isLoading">Creating...</span>
              <span v-else>Create Fork</span>
            </Button>
            <Button @click="handleRecheckFork" size="sm" variant="outline" :disabled="isLoading">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>
        </div>

        <!-- Fork outdated warning - Only show when current repo IS the fork -->
        <div v-if="isCurrentRepoFork && forkCompareStatus?.isBehind" class="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <p class="text-yellow-800 mb-2 font-medium flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Fork is {{ forkCompareStatus.behindBy }} commit{{ forkCompareStatus.behindBy > 1 ? 's' : '' }} behind
          </p>
          <p class="text-yellow-700 text-xs mb-2">
            Your fork is outdated. Sync to get the latest templates from upstream.
          </p>
          <Button @click="handleSyncFork" size="sm" class="w-full" :disabled="isLoading">
            <svg v-if="!isLoading" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-if="isLoading">Syncing...</span>
            <span v-else>Sync Fork</span>
          </Button>
        </div>

        <!-- Fork up to date notice - Only show when current repo IS the fork -->
        <div v-if="isCurrentRepoFork && forkCompareStatus && !forkCompareStatus.isBehind && !forkCompareStatus.isAhead" class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
          <p class="text-green-700 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Fork is up to date with upstream
          </p>
        </div>
      </div>

      <!-- Branch Selector -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm font-medium">Branch</label>
          <Button
            variant="ghost"
            size="sm"
            @click="showCreateBranch = true"
            :disabled="!hasRepoWriteAccess || isLoading"
            :title="hasRepoWriteAccess ? 'Create a new branch' : 'You need write access to create branches'"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New
          </Button>
        </div>

        <Select v-model="selectedBranch" @update:modelValue="onBranchChange" :disabled="branches.length === 0 || isLoading">
          <SelectTrigger>
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="branch in branches" :key="branch.name" :value="branch.name">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span class="font-mono text-sm">{{ branch.name }}</span>
                <span v-if="branch.isDefault" class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  default
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Current working branch info -->
        <div v-if="selectedBranch" class="mt-2 p-2 bg-muted rounded text-xs">
          <div class="flex items-center gap-2">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Working on: <span class="font-mono font-semibold">{{ selectedBranch }}</span></span>
          </div>

          <!-- Permission status -->
          <div v-if="canEditCurrentRepo" class="text-green-600 mt-1 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Can edit this branch</span>
          </div>
          <div v-else-if="branchPermission?.isProtected" class="text-yellow-600 mt-1 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Branch protected (use PR)</span>
          </div>
          <div v-else class="text-red-600 mt-1 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Read-only: No edit permission</span>
          </div>

          <!-- Best practice warning: Don't work on fork's main branch -->
          <div v-if="isWorkingOnForkMainBranch" class="mt-2 pt-2 border-t border-gray-300">
            <div class="text-orange-600 flex items-start gap-1">
              <svg class="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p class="font-medium">Best Practice</p>
                <p class="text-[11px] leading-tight mt-0.5">
                  Create a new branch instead of committing to main. This keeps your fork's main branch clean for syncing.
                </p>
                <Button
                  @click="showCreateBranch = true"
                  size="sm"
                  variant="outline"
                  class="mt-1.5 h-6 text-[11px] px-2"
                >
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create New Branch
                </Button>
              </div>
            </div>
          </div>

          <!-- Debug permission info (collapsible) -->
          <div v-if="true" class="mt-2 pt-2 border-t text-xs opacity-60">
            <button
              @click="showDebugInfo = !showDebugInfo"
              class="flex items-center gap-1 w-full hover:opacity-80 transition-opacity"
            >
              <svg
                class="w-3 h-3 transition-transform"
                :class="{ 'rotate-90': showDebugInfo }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              <strong>Debug Info</strong>
            </button>
            <div v-if="showDebugInfo" class="mt-1 space-y-1 pl-4">
              <div>Selected repo: {{ selectedRepo }}</div>
              <div>Selected branch: {{ selectedBranch }}</div>
              <div>Branches loaded: {{ branches.length }}</div>
              <div v-if="branches.length > 0">Branch names: {{ branches.map(b => b.name).join(', ') }}</div>
              <div>Has fork: {{ hasFork }}</div>
              <div>Has main access: {{ hasMainRepoAccess }}</div>
              <div>Available repos: {{ availableRepos.length }}</div>
              <div>Repo write access: {{ hasRepoWriteAccess }}</div>
              <div v-if="forkCompareStatus">
                <div>Fork behind: {{ forkCompareStatus.behindBy || 0 }}</div>
                <div>Fork ahead: {{ forkCompareStatus.aheadBy || 0 }}</div>
                <div>Fork status: {{ forkCompareStatus.status }}</div>
              </div>
              <div v-if="branchPermission">
                <div>Permission: {{ branchPermission.permission }}</div>
                <div v-if="branchPermission.isProtected !== undefined">Protected: {{ branchPermission.isProtected }}</div>
                <div>Can push: {{ branchPermission.canPush }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  <!-- Create Branch Dialog -->
  <Dialog v-model:open="showCreateBranch">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create New Branch</DialogTitle>
        <DialogDescription>
          Create a new branch from {{ selectedBranch || 'main' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium mb-2 block">Branch Name</label>
          <Input
            v-model="newBranchName"
            :placeholder="suggestedBranchName"
            class="font-mono"
          />
          <p class="text-xs text-muted-foreground mt-1">
            Leave empty to use: {{ suggestedBranchName }}
          </p>
        </div>

        <div class="flex gap-2">
          <Button @click="handleCreateBranch" class="flex-1" :disabled="isLoading">
            <span v-if="isLoading">Creating...</span>
            <span v-else>Create Branch</span>
          </Button>
          <Button @click="showCreateBranch = false" variant="outline">Cancel</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const {
  hasMainRepoAccess,
  hasFork,
  selectedRepo,
  selectedBranch,
  branches,
  isLoading,
  availableRepos,
  hasRepoWriteAccess,
  canEditCurrentRepo,
  branchPermission,
  forkCompareStatus,
  createFork,
  syncFork,
  loadBranches,
  createBranch,
  initialize
} = useGitHubRepo()

const showCreateBranch = ref(false)
const newBranchName = ref('')
const showDebugInfo = ref(false) // Collapsed by default

const suggestedBranchName = computed(() => {
  const now = new Date()
  // Format: YYYYMMDD-HHmmss (e.g., 20260117-143052)
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 19).replace(/:/g, '')
  return `template-update-${date}-${time}`
})

// Check if currently selected repo is the user's fork
const isCurrentRepoFork = computed(() => {
  if (!selectedRepo.value || !hasFork.value) return false

  const currentRepo = availableRepos.value.find(r => r.fullName === selectedRepo.value)
  return currentRepo?.type === 'fork'
})

// Check if user is working on their fork's main branch (not recommended)
const isWorkingOnForkMainBranch = computed(() => {
  if (!selectedRepo.value || !selectedBranch.value) return false

  const [owner] = selectedRepo.value.split('/')
  const { data: session } = useAuth()

  // Check if:
  // 1. Current repo is user's fork (owner matches username)
  // 2. Current branch is 'main'
  const isOwnFork = owner === session.value?.user?.login
  const isMainBranch = selectedBranch.value === 'main'

  return isOwnFork && isMainBranch
})

const onRepoChange = async () => {
  if (!selectedRepo.value) return
  const [owner, name] = selectedRepo.value.split('/')

  // Save current branch before loading new branches
  const previousBranch = selectedBranch.value

  await loadBranches(owner, name)

  // Try to keep the same branch name if it exists in the new repo
  const branchExists = branches.value.find(b => b.name === previousBranch)
  if (branchExists) {
    console.log('[RepoAndBranchSwitcher] Keeping branch:', previousBranch)
    selectedBranch.value = previousBranch
  } else {
    console.log('[RepoAndBranchSwitcher] Branch not found, switching to main')
    selectedBranch.value = 'main'
  }
}

const onBranchChange = (newBranch: string) => {
  console.log('[RepoAndBranchSwitcher] Branch changed to:', newBranch)
  console.log('[RepoAndBranchSwitcher] Current repo:', selectedRepo.value)
}

// Debug watcher for selectedBranch
watch(selectedBranch, (newVal, oldVal) => {
  console.log('[RepoAndBranchSwitcher] selectedBranch watch:', { old: oldVal, new: newVal })
})

// Debug watcher for branches array
watch(branches, (newVal) => {
  console.log('[RepoAndBranchSwitcher] branches watch:', {
    count: newVal.length,
    names: newVal.map(b => b.name),
    selectedBranch: selectedBranch.value
  })
})

const handleCreateFork = async () => {
  try {
    await createFork()
    // Re-initialize to refresh available repos
    await initialize()
  } catch (error) {
    console.error('Failed to create fork:', error)
    alert('Failed to create fork. Please try again.')
  }
}

const handleRecheckFork = async () => {
  console.log('[RepoAndBranchSwitcher] Manual recheck fork triggered')
  try {
    await initialize()
    console.log('[RepoAndBranchSwitcher] Recheck complete. Has fork:', hasFork.value)
  } catch (error) {
    console.error('[RepoAndBranchSwitcher] Failed to recheck fork:', error)
  }
}

const handleCreateBranch = async () => {
  const branchName = newBranchName.value || suggestedBranchName.value
  const [owner, name] = selectedRepo.value.split('/')

  try {
    await createBranch(owner, name, branchName, selectedBranch.value)
    selectedBranch.value = branchName
    showCreateBranch.value = false
    newBranchName.value = ''
  } catch (error) {
    console.error('Failed to create branch:', error)
    alert('Failed to create branch. Please try again.')
  }
}

const handleSyncFork = async () => {
  try {
    const result = await syncFork()
    if (result.success) {
      if (result.alreadyUpToDate) {
        alert('Fork is already up to date!')
      } else {
        alert('Fork synced successfully! Refreshing...')
        // Refresh the page to load updated templates
        await initialize()
        window.location.reload()
      }
    } else if (result.needsManualMerge) {
      alert('Your fork has diverged from upstream. Please merge manually on GitHub.')
      window.open(`https://github.com/${selectedRepo.value}`, '_blank')
    } else {
      alert(`Failed to sync fork: ${result.error}`)
    }
  } catch (error) {
    console.error('Failed to sync fork:', error)
    alert('Failed to sync fork. Please try again.')
  }
}

// Initialize on mount
onMounted(() => {
  initialize()
})
</script>
