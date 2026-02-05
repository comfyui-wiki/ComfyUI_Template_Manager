<template>
  <!-- Main Content with Sidebar -->
  <div class="w-full px-4 py-6">
    <div class="flex gap-6 max-w-[1920px] mx-auto">
      <!-- Sidebar -->
      <aside class="w-64 flex-shrink-0 hidden lg:block" id="sidebar">
        <div class="sidebar-scroll sticky top-6 space-y-4 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2">
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
                  @click="$emit('update:selectedCategory', 'all')"
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
                  @click="$emit('update:selectedCategory', category.title)"
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
                :model-value="searchQuery"
                @update:model-value="$emit('update:searchQuery', $event)"
                placeholder="Search templates..."
                class="pl-10"
              />
            </div>
          </div>

          <!-- Sort -->
          <Select :model-value="sortBy" @update:model-value="$emit('update:sortBy', $event)">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest First</SelectItem>
              <SelectItem value="usage">Usage (High to Low)</SelectItem>
              <SelectItem value="default">Default (from index.json)</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Filters Row -->
        <div class="flex flex-wrap gap-4 mb-6 items-center">
          <!-- Model Filter -->
          <Select :model-value="selectedModel" @update:model-value="$emit('update:selectedModel', $event)">
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
          <Select :model-value="selectedTag" @update:model-value="$emit('update:selectedTag', $event)">
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
          <Select :model-value="selectedRunsOn" @update:model-value="$emit('update:selectedRunsOn', $event)">
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
          <Select
            v-if="isMounted && status === 'authenticated' && selectedBranch"
            :model-value="selectedDiffStatus"
            @update:model-value="$emit('update:selectedDiffStatus', $event)"
          >
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
            @click="$emit('clear-filters')"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Filters
          </Button>
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
              @click="$emit('refresh')"
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

        <!-- Templates Grid - Always show flat grid for proper sorting -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          <TemplateCard
            v-for="template in filteredTemplates"
            :key="template.name"
            :template="template"
            :category="template.categoryTitle"
            :can-edit="isMounted && canEditCurrentRepo && !isViewingPR"
            :repo="selectedRepo"
            :branch="selectedBranch"
            :cache-bust="cacheBust"
            :commit-sha="commitSha"
            :pr-templates="prTemplates"
            :logo-mapping="logoMapping"
            :repo-base-url="repoBaseUrl"
            @edit="$emit('edit-template', template)"
            @view="$emit('view-template', template)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import RepoAndBranchSwitcher from '~/components/RepoAndBranchSwitcher.vue'
import TemplateCard from '~/components/TemplateCard.vue'

const { status } = useAuth()

// Props
const props = defineProps<{
  isMounted: boolean
  categories: any[]
  allTemplates: any[]
  filteredTemplates: any[]
  allModels: string[]
  allTags: string[]
  selectedCategory: string
  selectedModel: string
  selectedTag: string
  selectedRunsOn: string
  selectedDiffStatus: string
  searchQuery: string
  sortBy: string
  loading: boolean
  selectedRepo: string | null
  selectedBranch: string | null
  diffStats: { new: number; modified: number; deleted: number }
  canEditCurrentRepo: boolean
  isViewingPR: boolean
  cacheBust?: number
  commitSha?: string
  prTemplates?: string[]
  logoMapping: Record<string, string>
  repoBaseUrl: string
}>()

// Emits
defineEmits<{
  'update:selectedCategory': [value: string]
  'update:selectedModel': [value: string]
  'update:selectedTag': [value: string]
  'update:selectedRunsOn': [value: string]
  'update:selectedDiffStatus': [value: string]
  'update:searchQuery': [value: string]
  'update:sortBy': [value: string]
  'clear-filters': []
  'refresh': []
  'edit-template': [template: any]
  'view-template': [template: any]
}>()

// Computed
const categoryTitle = computed(() => {
  const cat = props.categories.find(c => c.title === props.selectedCategory)
  return cat?.title || ''
})
</script>

<style scoped>
/* Custom scrollbar styles */
.sidebar-scroll::-webkit-scrollbar {
  width: 6px;
}

.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Firefox scrollbar */
.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}
</style>
