<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>Browse Pull Requests</DialogTitle>
        <DialogDescription>
          Switch to any PR branch to review and test templates
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto">
        <!-- Filters -->
        <div class="flex items-center gap-3 mb-4 pb-3 border-b">
          <div class="flex items-center gap-2">
            <button
              v-for="state in ['open', 'closed', 'all']"
              :key="state"
              @click="selectedState = state"
              :class="[
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                selectedState === state
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              ]"
            >
              {{ state.charAt(0).toUpperCase() + state.slice(1) }}
            </button>
          </div>

          <div class="ml-auto text-sm text-muted-foreground">
            {{ pullRequests.length }} PR{{ pullRequests.length !== 1 ? 's' : '' }}
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="pullRequests.length === 0" class="text-center py-12">
          <svg class="mx-auto w-12 h-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="text-lg font-medium mb-2">No pull requests found</h3>
          <p class="text-muted-foreground">Try changing the filter above</p>
        </div>

        <!-- PR List -->
        <div v-else class="space-y-3">
          <div
            v-for="pr in pullRequests"
            :key="pr.number"
            class="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-start gap-3">
              <!-- Status Icon -->
              <div class="flex-shrink-0 mt-1">
                <!-- Open -->
                <svg v-if="pr.status === 'open'" class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM5 1a1.75 1.75 0 100 3.5A1.75 1.75 0 005 1zM3.25 12a1.75 1.75 0 113.5 0 1.75 1.75 0 01-3.5 0z"/>
                </svg>
                <!-- Merged -->
                <svg v-else-if="pr.status === 'merged'" class="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346zM12.75 9a.75.75 0 100-1.5.75.75 0 000 1.5zm-8.5 4.5a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
                </svg>
                <!-- Closed -->
                <svg v-else class="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M3.25 1A2.25 2.25 0 001 3.25v9.5A2.25 2.25 0 003.25 15h9.5A2.25 2.25 0 0015 12.75v-9.5A2.25 2.25 0 0012.75 1h-9.5zm9.5 1.5a.75.75 0 01.75.75v9.5a.75.75 0 01-.75.75h-9.5a.75.75 0 01-.75-.75v-9.5a.75.75 0 01.75-.75h9.5z"/>
                </svg>
              </div>

              <!-- PR Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-gray-900 truncate">
                      {{ pr.title }}
                    </h3>
                    <div class="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>#{{ pr.number }}</span>
                      <span>•</span>
                      <span>{{ pr.user.login }}</span>
                      <span>•</span>
                      <span>{{ formatDate(pr.created_at) }}</span>
                      <span v-if="pr.draft" class="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">Draft</span>
                    </div>
                    <div class="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span class="flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm.5 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 00.471.696l2.5 1a.75.75 0 00.557-1.392L8.5 7.742V4.75z"/>
                        </svg>
                        {{ pr.commits }} commit{{ pr.commits !== 1 ? 's' : '' }}
                      </span>
                      <span class="flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
                        </svg>
                        {{ pr.changed_files }} file{{ pr.changed_files !== 1 ? 's' : '' }}
                      </span>
                      <span class="text-green-600">+{{ pr.additions }}</span>
                      <span class="text-red-600">-{{ pr.deletions }}</span>
                    </div>
                  </div>

                  <!-- Status Badge -->
                  <div>
                    <span
                      v-if="pr.status === 'open'"
                      class="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
                    >
                      Open
                    </span>
                    <span
                      v-else-if="pr.status === 'merged'"
                      class="inline-flex items-center px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium"
                    >
                      Merged
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium"
                    >
                      Closed
                    </span>
                  </div>
                </div>

                <!-- Branch Info -->
                <div class="mt-2 text-xs">
                  <span class="px-2 py-1 bg-gray-100 rounded font-mono">
                    {{ pr.head.ref }}
                  </span>
                  <span class="mx-2 text-muted-foreground">→</span>
                  <span class="px-2 py-1 bg-gray-100 rounded font-mono">
                    {{ pr.base.ref }}
                  </span>
                </div>

                <!-- Action Buttons -->
                <div class="mt-3 flex items-center gap-2">
                  <Button
                    @click="handleSwitchBranch(pr)"
                    size="sm"
                    class="gap-2"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
                    </svg>
                    Switch to Branch
                  </Button>
                  <Button
                    @click="handleViewOnGitHub(pr)"
                    size="sm"
                    variant="outline"
                    class="gap-2"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on GitHub
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'

interface Props {
  repo?: string
  open?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'switch-branch': [pr: any]
}>()

const isOpen = ref(props.open || false)
const loading = ref(false)
const pullRequests = ref<any[]>([])
const selectedState = ref<'open' | 'closed' | 'all'>('open')

watch(() => props.open, (value) => {
  isOpen.value = value || false
  if (value) {
    loadPullRequests()
  }
})

watch(isOpen, (value) => {
  emit('update:open', value)
})

watch(selectedState, () => {
  loadPullRequests()
})

const loadPullRequests = async () => {
  if (!props.repo) return

  loading.value = true
  try {
    const [owner, repoName] = props.repo.split('/')
    const response = await $fetch('/api/github/pr/list', {
      query: {
        owner,
        repo: repoName,
        state: selectedState.value,
        per_page: 50
      }
    })
    pullRequests.value = response.pullRequests
  } catch (error) {
    console.error('[PR Browser] Failed to load PRs:', error)
    pullRequests.value = []
  } finally {
    loading.value = false
  }
}

const handleSwitchBranch = (pr: any) => {
  // Emit event to parent to switch branch
  emit('switch-branch', pr)
  // Close dialog after switching
  isOpen.value = false
}

const handleViewOnGitHub = (pr: any) => {
  // Open PR in new tab
  window.open(pr.html_url, '_blank')
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}
</script>
