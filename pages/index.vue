<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="border-b bg-card">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">ComfyUI Templates</h1>
            <p class="text-sm text-muted-foreground">Browse and manage workflow templates</p>
          </div>

          <div class="flex items-center gap-4">
            <LoginButton />

            <Button
              v-if="status === 'authenticated' && isMounted"
              @click="navigateTo('/admin/edit/new')"
              size="lg"
              :disabled="!canEditCurrentRepo"
              :title="canEditCurrentRepo ? 'Create a new template' : 'Select a branch with write access to create templates'"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Template
            </Button>
          </div>
        </div>
      </div>
    </header>

    <!-- Permission Notice Banner (only show if no write access to repository at all) -->
    <div v-if="isMounted && status === 'authenticated' && !hasRepoWriteAccess && !noticeDismissed" class="border-b bg-blue-50">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm text-blue-900 font-medium">Read-only mode</p>
            <p class="text-xs text-blue-800 mt-1">
              You're viewing <span class="font-mono font-semibold">{{ selectedRepo }}</span> / <span class="font-mono font-semibold">{{ selectedBranch }}</span> in read-only mode.
              To create or edit templates:
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Button
                v-if="!hasFork"
                size="sm"
                variant="outline"
                class="h-7 text-xs bg-white hover:bg-blue-50"
                @click="scrollToSidebar"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Fork repository
              </Button>
              <Button
                v-else
                size="sm"
                variant="outline"
                class="h-7 text-xs bg-white hover:bg-blue-50"
                @click="scrollToSidebar"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Switch to your fork
              </Button>
            </div>
          </div>
          <button @click="dismissNotice" class="text-blue-600 hover:text-blue-800">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content with Sidebar -->
    <div class="w-full px-4 py-6">
      <div class="flex gap-6 max-w-[1920px] mx-auto">
        <!-- Sidebar -->
        <aside class="w-64 flex-shrink-0 hidden lg:block" id="sidebar">
          <div class="sticky top-6 space-y-4">
            <!-- Repository & Branch Switcher (only when logged in) -->
            <RepoAndBranchSwitcher v-if="isMounted && status === 'authenticated'" />

            <Card>
              <CardHeader>
                <CardTitle class="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent class="p-0">
                <div class="space-y-1">
                  <!-- All Categories -->
                  <button
                    @click="selectedCategory = 'all'"
                    :class="[
                      'w-full flex items-center justify-between px-4 py-2 text-sm transition-colors',
                      selectedCategory === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    ]"
                  >
                    <span>All Templates</span>
                    <span class="text-xs opacity-70">{{ allTemplates.length }}</span>
                  </button>

                  <!-- Category List -->
                  <button
                    v-for="category in categories"
                    :key="category.title"
                    @click="selectedCategory = category.title"
                    :class="[
                      'w-full flex items-center justify-between px-4 py-2 text-sm transition-colors',
                      selectedCategory === category.title
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    ]"
                  >
                    <span>{{ category.title }}</span>
                    <span class="text-xs opacity-70">{{ category.templates?.length || 0 }}</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <!-- Search and Sort -->
          <div class="flex flex-col sm:flex-row gap-4 mb-4">
            <!-- Search -->
            <div class="flex-1">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  v-model="searchQuery"
                  placeholder="Search templates..."
                  class="pl-10"
                />
              </div>
            </div>

            <!-- Sort -->
            <Select v-model="sortBy">
              <SelectTrigger class="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (from index.json)</SelectItem>
                <SelectItem value="latest">Latest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Filters Row -->
          <div class="flex flex-wrap gap-4 mb-6 items-center">
            <!-- Model Filter -->
            <Select v-model="selectedModel">
              <SelectTrigger class="w-[200px]">
                <SelectValue placeholder="Model Filter" />
              </SelectTrigger>
              <SelectContent class="max-h-[300px]">
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem v-for="model in allModels" :key="model" :value="model">
                  {{ model }}
                </SelectItem>
              </SelectContent>
            </Select>

            <!-- Tag Filter (Use Case) -->
            <Select v-model="selectedTag">
              <SelectTrigger class="w-[200px]">
                <SelectValue placeholder="Use Case" />
              </SelectTrigger>
              <SelectContent class="max-h-[300px]">
                <SelectItem value="all">All Tags</SelectItem>
                <SelectItem v-for="tag in allTags" :key="tag" :value="tag">
                  {{ tag }}
                </SelectItem>
              </SelectContent>
            </Select>

            <!-- Type Filter -->
            <Select v-model="selectedRunsOn">
              <SelectTrigger class="w-[200px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="opensource">Open Source</SelectItem>
              </SelectContent>
            </Select>

            <!-- Diff Status Filter (only show when authenticated and viewing a branch) -->
            <Select v-if="isMounted && status === 'authenticated' && selectedBranch" v-model="selectedDiffStatus">
              <SelectTrigger class="w-[220px]">
                <SelectValue placeholder="Changes vs Main" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                <SelectItem value="new">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span>
                    <span>New vs Main</span>
                  </div>
                </SelectItem>
                <SelectItem value="modified">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span>Modified vs Main</span>
                  </div>
                </SelectItem>
                <SelectItem value="deleted">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>Deleted vs Main</span>
                  </div>
                </SelectItem>
                <SelectItem value="unchanged">Identical to Main</SelectItem>
              </SelectContent>
            </Select>

            <!-- Clear Filters Button -->
            <Button
              v-if="selectedModel !== 'all' || selectedTag !== 'all' || selectedRunsOn !== 'all' || selectedDiffStatus !== 'all' || searchQuery"
              variant="outline"
              size="sm"
              @click="clearFilters"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Filters
            </Button>
          </div>

          <!-- Debug Panel (only in development) -->
          <div v-if="false" class="mb-4 p-4 bg-gray-100 rounded text-xs font-mono">
            <div><strong>Current Repo:</strong> {{ selectedRepo }}</div>
            <div><strong>Current Branch:</strong> {{ selectedBranch }}</div>
            <div><strong>Categories loaded:</strong> {{ categories.length }}</div>
            <div><strong>Diff Stats:</strong> {{ JSON.stringify(diffStats) }}</div>
            <div><strong>Sample template diffStatus:</strong> {{ categories[0]?.templates?.[0]?.diffStatus }}</div>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <span>{{ filteredTemplates.length }} templates</span>
            <span v-if="selectedCategory !== 'all'">in {{ categoryTitle }}</span>

            <!-- Diff Stats -->
            <div v-if="isMounted && status === 'authenticated' && selectedRepo && selectedBranch" class="flex items-center gap-3 ml-auto">
              <span class="text-xs">
                <span class="font-mono">{{ selectedRepo }}</span> /
                <span class="font-mono font-semibold">{{ selectedBranch }}</span>
              </span>
              <span v-if="diffStats.new > 0" class="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium" title="Templates added compared to main branch">
                +{{ diffStats.new }} new vs main
              </span>
              <span v-if="diffStats.modified > 0" class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium" title="Templates modified compared to main branch">
                ~{{ diffStats.modified }} modified vs main
              </span>
              <span v-if="diffStats.deleted > 0" class="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium" title="Templates deleted compared to main branch">
                -{{ diffStats.deleted }} deleted vs main
              </span>
              <span v-if="diffStats.new === 0 && diffStats.modified === 0 && diffStats.deleted === 0" class="text-xs text-muted-foreground">
                ✓ Identical to main
              </span>
              <Button
                variant="ghost"
                size="sm"
                @click="refreshTemplates"
                :disabled="loading"
                class="h-7 px-2"
                title="Refresh and compare with main branch"
              >
                <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-4 text-muted-foreground">Loading templates...</p>
      </div>

          <!-- Empty State -->
          <div v-else-if="filteredTemplates.length === 0" class="text-center py-12">
            <svg class="mx-auto w-12 h-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-lg font-medium mb-2">No templates found</h3>
            <p class="text-muted-foreground mb-4">Try adjusting your search or filters</p>
          </div>

          <!-- Templates Grid -->
          <div v-else>
            <!-- When specific category selected, show flat grid -->
            <div v-if="selectedCategory !== 'all'" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              <TemplateCard
                v-for="template in filteredTemplates"
                :key="template.name"
                :template="template"
                :category="template.categoryTitle"
                :can-edit="isMounted && canEditCurrentRepo"
                :repo="selectedRepo"
                :branch="selectedBranch"
                :cache-bust="cacheBustTimestamp"
                @edit="editTemplate"
                @view="viewTemplate"
              />
            </div>

            <!-- When all categories, group by category -->
            <div v-else>
              <div v-for="category in displayCategories" :key="category.title" class="mb-12">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h2 class="text-xl font-semibold">{{ category.title }}</h2>
                    <p class="text-sm text-muted-foreground">{{ getCategoryTemplates(category).length }} templates</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  <TemplateCard
                    v-for="template in getCategoryTemplates(category)"
                    :key="template.name"
                    :template="template"
                    :category="category.title"
                    :can-edit="isMounted && canEditCurrentRepo"
                    :repo="selectedRepo"
                    :branch="selectedBranch"
                    :cache-bust="cacheBustTimestamp"
                    @edit="editTemplate"
                    @view="viewTemplate"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import LoginButton from '~/components/LoginButton.vue'
import TemplateCard from '~/components/TemplateCard.vue'
import RepoAndBranchSwitcher from '~/components/RepoAndBranchSwitcher.vue'

const { status } = useAuth()

// GitHub repo and branch management
const {
  selectedRepo,
  selectedBranch,
  hasRepoWriteAccess,
  canEditCurrentRepo,
  hasFork,
  hasMainRepoAccess,
  branchPermission,
  checkBranchPermission,
  initialize: initializeGitHub
} = useGitHubRepo()

// Template diff detection
const {
  categoriesWithDiff,
  diffStats,
  isLoading: diffLoading,
  loadCurrentTemplates,
  isMainBranch,
  clearCache
} = useTemplateDiff()

// State
const loading = ref(true)
const searchQuery = ref('')
const selectedCategory = ref('all')
const selectedModel = ref('all')
const selectedTag = ref('all')
const selectedRunsOn = ref('all') // all, api, opensource
const selectedDiffStatus = ref('all') // all, new, modified, deleted, unchanged
const sortBy = ref('default')
const noticeDismissed = ref(false)
const isMounted = ref(false) // Track if component is mounted (client-side only)

// Load templates from selected repository and branch
const loadTemplates = async (owner: string, repo: string, branch: string, forceRefresh = false) => {
  console.log(`[LoadTemplates] Loading from ${owner}/${repo}/${branch}`, forceRefresh ? '(force refresh)' : '')
  loading.value = true
  try {
    // Check branch permission in parallel with loading templates
    await Promise.all([
      loadCurrentTemplates(owner, repo, branch, forceRefresh),
      status.value === 'authenticated' ? checkBranchPermission(owner, repo, branch) : Promise.resolve()
    ])
    console.log('[LoadTemplates] Templates loaded successfully')
    console.log('[LoadTemplates] Categories with diff:', categoriesWithDiff.value?.length || 0)
    console.log('[LoadTemplates] Diff stats:', diffStats.value)
    console.log('[LoadTemplates] Branch permission:', branchPermission.value)
  } catch (error) {
    console.error('[LoadTemplates] Failed to load templates:', error)
  } finally {
    loading.value = false
  }
}

// Track page visibility for smart refresh
const lastVisitTime = ref(Date.now())

// Cache-busting timestamp (updated when we force refresh)
const cacheBustTimestamp = ref<number | undefined>(undefined)

// Initial load - initialize GitHub and load templates
onMounted(async () => {
  // Mark as mounted to enable client-only rendering
  isMounted.value = true

  // Initialize GitHub repo/branch management (checks permissions and fork status)
  if (status.value === 'authenticated') {
    await initializeGitHub()
  }

  // Check if we just saved a template (force refresh if so)
  let forceRefresh = false
  if (process.client && sessionStorage.getItem('template_just_saved') === 'true') {
    console.log('[Homepage] Detected recent template save, forcing refresh')
    forceRefresh = true
    cacheBustTimestamp.value = Date.now() // Set cache-bust timestamp
    sessionStorage.removeItem('template_just_saved')
  }

  // Load templates from selected repo/branch (or default to main)
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'
  const [owner, name] = repo.split('/')

  if (forceRefresh) {
    // Clear cache before loading
    clearCache(owner, name, branch)
  }

  await loadTemplates(owner, name, branch, forceRefresh)

  // Listen for page visibility changes (user returns to this page)
  if (process.client) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }
})

// Clean up event listener
onBeforeUnmount(() => {
  if (process.client) {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
})

// Handle page becoming visible again (user returned from edit page)
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    const timeSinceLastVisit = Date.now() - lastVisitTime.value

    // If user was away for more than 2 seconds, force refresh
    // This catches quick edits where user saves and immediately returns
    if (timeSinceLastVisit > 2000) {
      console.log('[Page Visible] User returned after', Math.round(timeSinceLastVisit / 1000), 'seconds - refreshing data')

      if (selectedRepo.value && selectedBranch.value) {
        const [owner, name] = selectedRepo.value.split('/')
        // Clear cache for this specific repo/branch before refreshing
        clearCache(owner, name, selectedBranch.value)
        // Update cache-bust timestamp to force fresh images
        cacheBustTimestamp.value = Date.now()
        await loadTemplates(owner, name, selectedBranch.value, true) // Force refresh
      }
    }

    lastVisitTime.value = Date.now()
  }
}

// Watch for authentication status changes
watch(status, async (newStatus) => {
  if (newStatus === 'authenticated') {
    await initializeGitHub()
  }
})

// Watch for repository or branch changes
watch([selectedRepo, selectedBranch], ([repo, branch], [oldRepo, oldBranch]) => {
  console.log('[Watch] Branch changed:', { oldRepo, oldBranch, repo, branch })
  if (repo && branch) {
    const [owner, name] = repo.split('/')
    console.log('[Watch] Loading templates for:', owner, name, branch)
    loadTemplates(owner, name, branch)
  }
}, { immediate: false })

// Manual refresh function (force refresh from API)
const refreshTemplates = async () => {
  if (selectedRepo.value && selectedBranch.value) {
    const [owner, name] = selectedRepo.value.split('/')
    console.log('[Manual Refresh] Clearing cache and reloading templates from:', owner, name, selectedBranch.value)
    // Clear cache first to ensure fresh data
    clearCache(owner, name, selectedBranch.value)
    // Update cache-bust timestamp to force fresh images
    cacheBustTimestamp.value = Date.now()
    await loadTemplates(owner, name, selectedBranch.value, true) // Force refresh
  }
}

// Computed
const categories = computed(() => {
  return categoriesWithDiff.value || []
})

const categoryTitle = computed(() => {
  const cat = categories.value.find(c => c.title === selectedCategory.value)
  return cat?.title || ''
})

const allTemplates = computed(() => {
  const templates: any[] = []
  categories.value.forEach((category: any) => {
    category.templates?.forEach((template: any) => {
      const enrichedTemplate = {
        ...template,
        categoryTitle: category.title
      }
      templates.push(enrichedTemplate)
    })
  })

  return templates
})

const allModels = computed(() => {
  const models = new Set<string>()
  allTemplates.value.forEach(t => {
    if (t.models && Array.isArray(t.models)) {
      t.models.forEach((model: string) => models.add(model))
    }
  })
  return Array.from(models).sort()
})

const allTags = computed(() => {
  const tags = new Set<string>()
  allTemplates.value.forEach(t => {
    if (t.tags && Array.isArray(t.tags)) {
      t.tags.forEach((tag: string) => tags.add(tag))
    }
  })
  return Array.from(tags).sort()
})

const filteredTemplates = computed(() => {
  let templates = allTemplates.value

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    templates = templates.filter(t =>
      t.name?.toLowerCase().includes(query) ||
      t.title?.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    )
  }

  // Filter by category
  if (selectedCategory.value !== 'all') {
    templates = templates.filter(t => t.categoryTitle === selectedCategory.value)
  }

  // Filter by model
  if (selectedModel.value !== 'all') {
    templates = templates.filter(t =>
      t.models && Array.isArray(t.models) && t.models.includes(selectedModel.value)
    )
  }

  // Filter by tag
  if (selectedTag.value !== 'all') {
    templates = templates.filter(t =>
      t.tags && Array.isArray(t.tags) && t.tags.includes(selectedTag.value)
    )
  }

  // Filter by runs on (API vs Open Source)
  if (selectedRunsOn.value === 'api') {
    templates = templates.filter(t => t.openSource === false)
  } else if (selectedRunsOn.value === 'opensource') {
    templates = templates.filter(t => t.openSource !== false)
  }

  // Filter by diff status
  if (selectedDiffStatus.value !== 'all') {
    templates = templates.filter(t => t.diffStatus === selectedDiffStatus.value)
  }

  // Sort
  if (sortBy.value === 'default') {
    // Keep natural order from index.json (preserves the order from your branch)
    console.log('[filteredTemplates] Using default order from index.json. First 5 templates:',
      templates.slice(0, 5).map(t => t.name))
  } else if (sortBy.value === 'latest') {
    templates.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateB - dateA
    })
  } else if (sortBy.value === 'oldest') {
    templates.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateA - dateB
    })
  } else if (sortBy.value === 'name') {
    templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }

  return templates
})

const displayCategories = computed(() => {
  if (selectedCategory.value !== 'all') {
    return categories.value.filter((c: any) => c.title === selectedCategory.value)
  }

  // Filter categories that have matching templates
  return categories.value.filter((c: any) => {
    return getCategoryTemplates(c).length > 0
  })
})

// Methods
const clearFilters = () => {
  selectedModel.value = 'all'
  selectedTag.value = 'all'
  selectedRunsOn.value = 'all'
  selectedDiffStatus.value = 'all'
  searchQuery.value = ''
}

const getCategoryTemplates = (category: any) => {
  return filteredTemplates.value.filter(t => t.categoryTitle === category.title)
}

const editTemplate = (template: any) => {
  if (status.value !== 'authenticated') {
    alert('Please sign in to edit templates')
    return
  }
  navigateTo(`/admin/edit/${template.name}`)
}

const viewTemplate = (template: any) => {
  // Open workflow in new tab using current repo and branch
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'
  const url = `https://github.com/${repo}/blob/${branch}/templates/${template.name}.json`
  console.log('[View Template] Opening:', url)
  window.open(url, '_blank')
}

const scrollToSidebar = () => {
  const sidebar = document.getElementById('sidebar')
  if (sidebar) {
    sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Highlight the sidebar briefly
    sidebar.classList.add('ring-2', 'ring-blue-500', 'rounded-lg')
    setTimeout(() => {
      sidebar.classList.remove('ring-2', 'ring-blue-500', 'rounded-lg')
    }, 2000)
  }
}

const dismissNotice = () => {
  noticeDismissed.value = true
}

// Reset notice when user gains write access to repository
watch(hasRepoWriteAccess, (hasAccess) => {
  if (hasAccess) {
    noticeDismissed.value = false
  }
})

useHead({
  title: 'ComfyUI Templates - Browse & Manage'
})
</script>
