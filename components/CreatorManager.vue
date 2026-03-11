<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
      <DialogHeader class="px-6 py-4 border-b flex-shrink-0">
        <DialogTitle>Creator Manager</DialogTitle>
        <DialogDescription>
          Assign creators to templates. Changes are saved in a single commit.
        </DialogDescription>
      </DialogHeader>

      <!-- Toolbar -->
      <div class="px-6 py-3 border-b flex-shrink-0 flex items-center gap-3">
        <Input
          v-model="searchQuery"
          placeholder="Search templates..."
          class="flex-1 h-8 text-sm"
        />
        <!-- Changes badge -->
        <span v-if="pendingCount > 0" class="text-xs text-amber-600 font-medium whitespace-nowrap">
          {{ pendingCount }} unsaved change{{ pendingCount > 1 ? 's' : '' }}
        </span>
        <!-- Save button -->
        <Button
          size="sm"
          :disabled="pendingCount === 0 || saving"
          @click="handleSave"
          class="h-8 text-xs whitespace-nowrap"
        >
          <svg v-if="saving" class="w-3 h-3 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </Button>
      </div>

      <!-- Main branch warning dialog -->
      <MainBranchWarningDialog
        :open="showMainBranchWarning"
        :repo="selectedRepo || 'Comfy-Org/workflow_templates'"
        :branch="selectedBranch || 'main'"
        action-type="Commit"
        timing="saving"
        @update:open="showMainBranchWarning = $event"
        @confirm="doSave"
        @cancel="showMainBranchWarning = false"
      />

      <!-- Success / Error messages -->
      <div v-if="saveSuccess" class="mx-6 mt-3 flex-shrink-0 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800 flex items-center gap-2">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Saved successfully!</span>
        <a :href="saveSuccess.commitUrl" target="_blank" class="font-mono text-blue-600 hover:underline text-xs">
          {{ saveSuccess.commitSha.substring(0, 7) }}
        </a>
      </div>
      <div v-if="saveError" class="mx-6 mt-3 flex-shrink-0 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
        {{ saveError }}
      </div>

      <!-- Template list -->
      <div class="flex-1 overflow-y-auto px-6 py-3">
        <div v-if="filteredTemplates.length === 0" class="text-center py-12 text-muted-foreground text-sm">
          No templates found
        </div>

        <div v-else class="space-y-1">
          <div
            v-for="template in filteredTemplates"
            :key="template.name"
            class="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/40 transition-colors"
            :class="pendingChanges.has(template.name) ? 'bg-amber-50 hover:bg-amber-50' : ''"
          >
            <!-- Thumbnail -->
            <div class="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-muted">
              <img
                :src="getThumbnailUrl(template)"
                :alt="template.title"
                class="w-full h-full object-cover"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
            </div>

            <!-- Title + category -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ template.title || template.name }}</div>
              <div class="text-xs text-muted-foreground truncate">{{ template.name }}</div>
            </div>

            <!-- Changed indicator -->
            <span v-if="pendingChanges.has(template.name)" class="text-[10px] font-medium text-amber-600 flex-shrink-0">
              ●
            </span>

            <!-- Creator selector -->
            <div class="relative flex-shrink-0" style="width: 180px">
              <div
                class="flex items-center gap-1.5 border rounded px-2 py-1 cursor-pointer hover:border-primary/50 bg-background text-sm h-8"
                @click="toggleDropdown(template.name)"
              >
                <img
                  v-if="getEffectiveUsername(template) && creatorsData?.[getEffectiveUsername(template)!]"
                  :src="getAvatarUrl(getEffectiveUsername(template)!)"
                  class="w-5 h-5 rounded-full object-cover flex-shrink-0"
                />
                <div v-else class="w-5 h-5 rounded-full bg-muted flex-shrink-0" />
                <span class="flex-1 truncate text-xs" :class="getEffectiveUsername(template) ? '' : 'text-muted-foreground'">
                  {{ getEffectiveUsername(template) && creatorsData?.[getEffectiveUsername(template)!]
                    ? creatorsData[getEffectiveUsername(template)!].displayName
                    : (getEffectiveUsername(template) || 'None') }}
                </span>
                <svg class="w-3 h-3 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </div>

              <!-- Dropdown -->
              <div
                v-if="openDropdown === template.name"
                class="absolute z-50 right-0 top-full mt-1 w-48 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto"
              >
                <!-- None -->
                <div
                  class="flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent cursor-pointer border-b"
                  @mousedown.prevent="setCreator(template.name, null)"
                >
                  <div class="w-5 h-5 rounded-full bg-muted flex-shrink-0" />
                  <span class="text-muted-foreground">None</span>
                </div>
                <!-- Creator options -->
                <div
                  v-for="(creator, handle) in creatorsData"
                  :key="handle"
                  class="flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent cursor-pointer"
                  @mousedown.prevent="setCreator(template.name, handle as string)"
                >
                  <img
                    :src="getAvatarUrl(handle as string)"
                    :alt="creator.displayName"
                    class="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  />
                  <span class="flex-1 truncate">{{ creator.displayName }}</span>
                  <span v-if="getEffectiveUsername(template) === handle" class="text-primary">✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import MainBranchWarningDialog from '@/components/MainBranchWarningDialog.vue'

const props = defineProps<{
  open: boolean
  indexData: any[]
  creatorsData: Record<string, { displayName: string; handle: string; avatarUrl: string }>
  repo?: string
  branch?: string
  repoBaseUrl?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const { selectedRepo, selectedBranch } = useGitHubRepo()

// State
const searchQuery = ref('')
const saving = ref(false)
const saveSuccess = ref<{ commitSha: string; commitUrl: string } | null>(null)
const saveError = ref<string | null>(null)
const openDropdown = ref<string | null>(null)
const showMainBranchWarning = ref(false)

// pendingChanges: templateName -> new username (null = remove)
const pendingChanges = ref<Map<string, string | null>>(new Map())

const pendingCount = computed(() => pendingChanges.value.size)

const allTemplates = computed(() => {
  const templates: any[] = []
  for (const category of props.indexData ?? []) {
    for (const tpl of category.templates ?? []) {
      templates.push(tpl)
    }
  }
  return templates
})

const filteredTemplates = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return allTemplates.value
  return allTemplates.value.filter(t =>
    t.name?.toLowerCase().includes(q) ||
    t.title?.toLowerCase().includes(q)
  )
})

// Get the effective username for a template (pending change takes priority)
const getEffectiveUsername = (template: any): string | null => {
  if (pendingChanges.value.has(template.name)) {
    return pendingChanges.value.get(template.name) ?? null
  }
  return template.username ?? null
}

const setCreator = (templateName: string, username: string | null) => {
  // Find original value
  const original = allTemplates.value.find(t => t.name === templateName)?.username ?? null
  if (username === original) {
    pendingChanges.value.delete(templateName)
  } else {
    pendingChanges.value.set(templateName, username)
  }
  openDropdown.value = null
}

const toggleDropdown = (templateName: string) => {
  openDropdown.value = openDropdown.value === templateName ? null : templateName
}

const getThumbnailUrl = (template: any) => {
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'
  return `https://raw.githubusercontent.com/${repo}/${branch}/templates/${template.name}-1.webp`
}

const getAvatarUrl = (handle: string) => {
  const creator = props.creatorsData?.[handle]
  if (!creator) return ''
  const filename = creator.avatarUrl.split('/').pop()
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'
  return `https://raw.githubusercontent.com/${repo}/${branch}/site/avatars/${filename}`
}

// Close dropdown when clicking outside
const handleClickOutside = () => {
  openDropdown.value = null
}

const handleSave = () => {
  if (pendingChanges.value.size === 0) return

  const branch = selectedBranch.value || 'main'
  if (branch === 'main' || branch === 'master') {
    showMainBranchWarning.value = true
    return
  }

  doSave()
}

const doSave = async () => {
  saving.value = true
  saveSuccess.value = null
  saveError.value = null

  try {
    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'

    const updates = Array.from(pendingChanges.value.entries()).map(([templateName, username]) => ({
      templateName,
      username: username || null
    }))

    const res = await $fetch('/api/github/creator/bulk-update', {
      method: 'POST',
      body: { repo, branch, updates }
    })

    if (res.success && res.commit) {
      saveSuccess.value = { commitSha: res.commit.sha, commitUrl: res.commit.url }
    } else {
      saveSuccess.value = { commitSha: '', commitUrl: '' }
    }

    pendingChanges.value.clear()
    emit('saved')
  } catch (error: any) {
    console.error('[CreatorManager] Save failed:', error)
    const status = error.data?.statusCode || error.statusCode
    if (status === 401) {
      saveError.value = 'GitHub token expired. Please sign out and sign in again.'
    } else {
      saveError.value = error.data?.message || error.message || 'Failed to save changes'
    }
  } finally {
    saving.value = false
  }
}

// Reset state when closed
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    searchQuery.value = ''
    pendingChanges.value.clear()
    openDropdown.value = null
    saveSuccess.value = null
    saveError.value = null
  }
})
</script>
