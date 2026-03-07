<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MainBranchWarningDialog from '~/components/MainBranchWarningDialog.vue'

const props = defineProps<{
  open: boolean
  indexData: any[] // categories array from index.json
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

// ─── State ───────────────────────────────────────────────────────────────────

const saving = ref(false)
const saveSuccess = ref<{ commitSha: string; commitUrl: string } | null>(null)
const saveError = ref<string | null>(null)
const activeTab = ref<'tags' | 'models'>('tags')
const searchQuery = ref('')

// Selection (for batch operations)
const selectedItems = ref<Set<string>>(new Set())

// Pending deletions
const pendingDeletes = ref<Set<string>>(new Set())

// Pending renames: oldKey → { newKey, type }
const pendingRenames = ref<Map<string, { newKey: string; type: 'tag' | 'model' }>>(new Map())

// Inline rename editing state
const editingItem = ref<string | null>(null)
const renameInputValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

// Main branch warning
const showMainBranchWarning = ref(false)
const warningTiming = ref<'opening' | 'saving'>('opening')
const pendingSave = ref(false)

// ─── GitHub repo ──────────────────────────────────────────────────────────────

const { selectedRepo, selectedBranch } = useGitHubRepo()

// ─── Derived data ─────────────────────────────────────────────────────────────

const allTemplates = computed(() => {
  const templates: any[] = []
  if (!props.indexData) return templates
  for (const category of props.indexData) {
    if (category.templates && Array.isArray(category.templates)) {
      for (const tpl of category.templates) templates.push(tpl)
    }
  }
  return templates
})

const tagUsageMap = computed(() => {
  const map = new Map<string, number>()
  for (const tpl of allTemplates.value) {
    for (const tag of tpl.tags ?? []) map.set(tag, (map.get(tag) || 0) + 1)
  }
  return map
})

const modelUsageMap = computed(() => {
  const map = new Map<string, number>()
  for (const tpl of allTemplates.value) {
    for (const model of tpl.models ?? []) map.set(model, (map.get(model) || 0) + 1)
  }
  return map
})

const tagsList = computed(() =>
  Array.from(tagUsageMap.value.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.count - b.count || a.key.localeCompare(b.key))
)

const modelsList = computed(() =>
  Array.from(modelUsageMap.value.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.count - b.count || a.key.localeCompare(b.key))
)

const filteredTags = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return q ? tagsList.value.filter(i => i.key.toLowerCase().includes(q)) : tagsList.value
})

const filteredModels = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return q ? modelsList.value.filter(i => i.key.toLowerCase().includes(q)) : modelsList.value
})

// ─── Pending change summaries ─────────────────────────────────────────────────

const pendingTagDeletes = computed(() =>
  Array.from(pendingDeletes.value).filter(k => tagUsageMap.value.has(k))
)
const pendingModelDeletes = computed(() =>
  Array.from(pendingDeletes.value).filter(k => modelUsageMap.value.has(k))
)
const pendingTagRenames = computed(() =>
  Array.from(pendingRenames.value.entries()).filter(([, v]) => v.type === 'tag')
)
const pendingModelRenames = computed(() =>
  Array.from(pendingRenames.value.entries()).filter(([, v]) => v.type === 'model')
)

const hasPendingChanges = computed(
  () => pendingDeletes.value.size > 0 || pendingRenames.value.size > 0
)

const pendingSummary = computed(() => {
  const parts: string[] = []
  if (pendingDeletes.value.size > 0) parts.push(`${pendingDeletes.value.size} deletion${pendingDeletes.value.size !== 1 ? 's' : ''}`)
  if (pendingRenames.value.size > 0) parts.push(`${pendingRenames.value.size} rename${pendingRenames.value.size !== 1 ? 's' : ''}`)
  return parts.join(', ')
})

// ─── Selection helpers ────────────────────────────────────────────────────────

// Active preview key: which selected item's templates to show in the right panel
const activePreviewKey = ref<string | null>(null)

const toggleSelection = (key: string) => {
  if (editingItem.value === key) return
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key)
    if (activePreviewKey.value === key) {
      const remaining = Array.from(selectedItems.value)
      activePreviewKey.value = remaining.length > 0 ? remaining[remaining.length - 1] : null
    }
  } else {
    selectedItems.value.add(key)
    activePreviewKey.value = key
  }
}

const markSelectedForDeletion = () => {
  for (const key of selectedItems.value) {
    pendingDeletes.value.add(key)
    pendingRenames.value.delete(key)
  }
  selectedItems.value.clear()
  activePreviewKey.value = null
}

const clearAllPending = () => {
  pendingDeletes.value.clear()
  pendingRenames.value.clear()
}

const undoDelete = (key: string) => pendingDeletes.value.delete(key)

const undoRename = (oldKey: string) => pendingRenames.value.delete(oldKey)

// ─── Inline rename ────────────────────────────────────────────────────────────

const startRename = async (key: string) => {
  // Can't rename items pending deletion
  if (pendingDeletes.value.has(key)) return

  // If already has a pending rename, start from the pending new name
  const existing = pendingRenames.value.get(key)
  renameInputValue.value = existing ? existing.newKey : key
  editingItem.value = key
  selectedItems.value.delete(key)

  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

const confirmRename = () => {
  if (!editingItem.value) return
  const oldKey = editingItem.value
  const newKey = renameInputValue.value.trim()

  if (newKey && newKey !== oldKey) {
    const type: 'tag' | 'model' = tagUsageMap.value.has(oldKey) ? 'tag' : 'model'
    pendingRenames.value.set(oldKey, { newKey, type })
  }
  editingItem.value = null
}

const cancelRename = () => {
  editingItem.value = null
  renameInputValue.value = ''
}

// ─── Preview panel ────────────────────────────────────────────────────────────

const previewKey = computed(() => {
  if (editingItem.value) return editingItem.value
  if (activePreviewKey.value && selectedItems.value.has(activePreviewKey.value)) return activePreviewKey.value
  if (selectedItems.value.size > 0) return Array.from(selectedItems.value)[0]
  return null
})

const previewTemplates = computed(() => {
  if (!previewKey.value) return []
  const key = previewKey.value
  return allTemplates.value.filter(tpl => {
    if (activeTab.value === 'tags') return tpl.tags?.includes(key)
    return tpl.models?.includes(key)
  })
})

const getThumbnailUrl = (tpl: any) => {
  const [owner, repoName] = (selectedRepo.value || 'Comfy-Org/workflow_templates').split('/')
  const branch = selectedBranch.value || 'main'
  const mediaSubtype = tpl.mediaSubtype || 'webp'
  return `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/${tpl.name}-1.${mediaSubtype}`
}

// ─── Save logic ───────────────────────────────────────────────────────────────

const doSave = async () => {
  saving.value = true
  saveSuccess.value = null
  saveError.value = null

  const repo = selectedRepo.value
  const branch = selectedBranch.value

  try {
    let lastCommit: { sha: string; url: string } | null = null

    // 1. Renames first
    if (pendingRenames.value.size > 0) {
      const renames = Array.from(pendingRenames.value.entries()).map(([oldKey, { newKey, type }]) => ({
        oldKey, newKey, type
      }))

      const res = await $fetch('/api/github/tags-models/rename', {
        method: 'POST',
        body: { repo, branch, renames }
      })

      if (res.success && res.commit) lastCommit = res.commit
      pendingRenames.value.clear()
    }

    // 2. Deletions
    if (pendingDeletes.value.size > 0) {
      const deleteTags = pendingTagDeletes.value
      const deleteModels = pendingModelDeletes.value

      const res = await $fetch('/api/github/tags-models/update', {
        method: 'POST',
        body: { repo, branch, deleteTags, deleteModels }
      })

      if (res.success && res.commit) lastCommit = res.commit
      pendingDeletes.value.clear()
    }

    selectedItems.value.clear()
    saveSuccess.value = lastCommit
      ? { commitSha: lastCommit.sha, commitUrl: lastCommit.url }
      : { commitSha: '', commitUrl: '' }
  } catch (error: any) {
    console.error('[TagModelManager] Save failed:', error)
    const status = error.data?.statusCode || error.statusCode
    if (status === 401) {
      saveError.value = 'GitHub token expired. Please sign out and sign in again.'
    } else {
      saveError.value = error.data?.message || error.message || 'Failed to save changes'
    }
  } finally {
    saving.value = false
    pendingSave.value = false
  }
}

const handleSave = () => {
  if (!hasPendingChanges.value) return

  const branch = selectedBranch.value || 'main'
  if (branch === 'main' || branch === 'master') {
    warningTiming.value = 'saving'
    pendingSave.value = true
    showMainBranchWarning.value = true
    return
  }

  doSave()
}

const handleWarningContinue = () => {
  showMainBranchWarning.value = false
  if (warningTiming.value === 'saving' && pendingSave.value) doSave()
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    searchQuery.value = ''
    selectedItems.value.clear()
    editingItem.value = null
    saveSuccess.value = null
    saveError.value = null
  } else {
    const branch = selectedBranch.value || 'main'
    if (branch === 'main' || branch === 'master') {
      warningTiming.value = 'opening'
      showMainBranchWarning.value = true
    }
  }
})

watch(activeTab, () => {
  selectedItems.value.clear()
  activePreviewKey.value = null
  editingItem.value = null
  searchQuery.value = ''
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const usageBadgeVariant = (count: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (count === 1) return 'destructive'
  if (count <= 3) return 'outline'
  return 'secondary'
}

// Display name for a key (show pending rename arrow if applicable)
const displayKey = (key: string) => {
  const rename = pendingRenames.value.get(key)
  return rename ? rename.newKey : key
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-5xl w-full h-[85vh] flex flex-col p-0 gap-0">
      <DialogHeader class="px-6 pt-6 pb-4 border-b flex-shrink-0">
        <DialogTitle>Tag & Model Manager</DialogTitle>
        <DialogDescription>
          Browse, audit, rename, and remove tags and models across all templates.
        </DialogDescription>
      </DialogHeader>

      <!-- Main Content -->
      <div class="flex flex-1 min-h-0">
        <!-- ── Left Panel: List ── -->
        <div class="flex flex-col w-[360px] flex-shrink-0 border-r">
          <Tabs v-model="activeTab" class="flex flex-col flex-1 min-h-0">
            <div class="px-4 pt-3 pb-2 border-b flex-shrink-0 space-y-3">
              <TabsList class="w-full">
                <TabsTrigger value="tags" class="flex-1 gap-1.5">
                  Tags
                  <Badge variant="secondary" class="text-xs px-1.5 py-0 h-5">{{ tagsList.length }}</Badge>
                </TabsTrigger>
                <TabsTrigger value="models" class="flex-1 gap-1.5">
                  Models
                  <Badge variant="secondary" class="text-xs px-1.5 py-0 h-5">{{ modelsList.length }}</Badge>
                </TabsTrigger>
              </TabsList>

              <Input v-model="searchQuery" placeholder="Search..." class="h-8 text-sm" />
            </div>

            <!-- Tags List -->
            <TabsContent value="tags" class="flex-1 min-h-0 mt-0">
              <div class="h-full overflow-y-auto">
                <template v-for="item in filteredTags" :key="item.key">
                  <!-- Inline rename editing row -->
                  <div
                    v-if="editingItem === item.key"
                    class="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border-b border-border/40"
                  >
                    <Input
                      ref="renameInputRef"
                      v-model="renameInputValue"
                      class="h-7 text-sm font-mono flex-1"
                      @keyup.enter="confirmRename"
                      @keyup.esc="cancelRename"
                    />
                    <button
                      class="text-green-600 hover:text-green-800 text-sm font-medium px-1 flex-shrink-0"
                      title="Confirm rename (Enter)"
                      @click="confirmRename"
                    >✓</button>
                    <button
                      class="text-muted-foreground hover:text-foreground text-sm px-1 flex-shrink-0"
                      title="Cancel (Esc)"
                      @click="cancelRename"
                    >✕</button>
                  </div>

                  <!-- Normal row -->
                  <div
                    v-else
                    class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 border-b border-border/40 transition-colors group"
                    :class="{
                      'bg-accent': selectedItems.has(item.key),
                      'bg-red-50 hover:bg-red-100': pendingDeletes.has(item.key),
                      'bg-amber-50 hover:bg-amber-100': pendingRenames.has(item.key)
                    }"
                    @click="toggleSelection(item.key)"
                  >
                    <input
                      type="checkbox"
                      class="w-4 h-4 cursor-pointer flex-shrink-0"
                      :checked="selectedItems.has(item.key)"
                      :disabled="pendingDeletes.has(item.key) || pendingRenames.has(item.key)"
                      @click.stop
                      @change="toggleSelection(item.key)"
                    />
                    <!-- Key display -->
                    <div class="flex-1 min-w-0 text-sm font-mono">
                      <template v-if="pendingRenames.has(item.key)">
                        <span class="text-muted-foreground line-through text-xs">{{ item.key }}</span>
                        <span class="mx-1 text-amber-600">→</span>
                        <span class="text-amber-700 font-medium">{{ pendingRenames.get(item.key)!.newKey }}</span>
                      </template>
                      <span
                        v-else
                        class="truncate block"
                        :class="pendingDeletes.has(item.key) ? 'line-through text-muted-foreground' : ''"
                      >{{ item.key }}</span>
                    </div>
                    <Badge :variant="usageBadgeVariant(item.count)" class="text-xs flex-shrink-0">{{ item.count }}</Badge>
                    <!-- Undo buttons -->
                    <button
                      v-if="pendingDeletes.has(item.key)"
                      class="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Undo deletion"
                      @click.stop="undoDelete(item.key)"
                    >↩</button>
                    <button
                      v-else-if="pendingRenames.has(item.key)"
                      class="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Undo rename"
                      @click.stop="undoRename(item.key)"
                    >↩</button>
                    <!-- Rename button (shows on hover) -->
                    <button
                      v-else
                      class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground flex-shrink-0 transition-opacity"
                      title="Rename"
                      @click.stop="startRename(item.key)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </template>
                <div v-if="filteredTags.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
                  No tags found
                </div>
              </div>
            </TabsContent>

            <!-- Models List -->
            <TabsContent value="models" class="flex-1 min-h-0 mt-0">
              <div class="h-full overflow-y-auto">
                <template v-for="item in filteredModels" :key="item.key">
                  <!-- Inline rename editing row -->
                  <div
                    v-if="editingItem === item.key"
                    class="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border-b border-border/40"
                  >
                    <Input
                      ref="renameInputRef"
                      v-model="renameInputValue"
                      class="h-7 text-sm font-mono flex-1"
                      @keyup.enter="confirmRename"
                      @keyup.esc="cancelRename"
                    />
                    <button
                      class="text-green-600 hover:text-green-800 text-sm font-medium px-1 flex-shrink-0"
                      title="Confirm rename (Enter)"
                      @click="confirmRename"
                    >✓</button>
                    <button
                      class="text-muted-foreground hover:text-foreground text-sm px-1 flex-shrink-0"
                      title="Cancel (Esc)"
                      @click="cancelRename"
                    >✕</button>
                  </div>

                  <!-- Normal row -->
                  <div
                    v-else
                    class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 border-b border-border/40 transition-colors group"
                    :class="{
                      'bg-accent': selectedItems.has(item.key),
                      'bg-red-50 hover:bg-red-100': pendingDeletes.has(item.key),
                      'bg-amber-50 hover:bg-amber-100': pendingRenames.has(item.key)
                    }"
                    @click="toggleSelection(item.key)"
                  >
                    <input
                      type="checkbox"
                      class="w-4 h-4 cursor-pointer flex-shrink-0"
                      :checked="selectedItems.has(item.key)"
                      :disabled="pendingDeletes.has(item.key) || pendingRenames.has(item.key)"
                      @click.stop
                      @change="toggleSelection(item.key)"
                    />
                    <div class="flex-1 min-w-0 text-sm font-mono">
                      <template v-if="pendingRenames.has(item.key)">
                        <span class="text-muted-foreground line-through text-xs">{{ item.key }}</span>
                        <span class="mx-1 text-amber-600">→</span>
                        <span class="text-amber-700 font-medium">{{ pendingRenames.get(item.key)!.newKey }}</span>
                      </template>
                      <span
                        v-else
                        class="truncate block"
                        :class="pendingDeletes.has(item.key) ? 'line-through text-muted-foreground' : ''"
                      >{{ item.key }}</span>
                    </div>
                    <Badge :variant="usageBadgeVariant(item.count)" class="text-xs flex-shrink-0">{{ item.count }}</Badge>
                    <button
                      v-if="pendingDeletes.has(item.key)"
                      class="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Undo deletion"
                      @click.stop="undoDelete(item.key)"
                    >↩</button>
                    <button
                      v-else-if="pendingRenames.has(item.key)"
                      class="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Undo rename"
                      @click.stop="undoRename(item.key)"
                    >↩</button>
                    <button
                      v-else
                      class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground flex-shrink-0 transition-opacity"
                      title="Rename"
                      @click.stop="startRename(item.key)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </template>
                <div v-if="filteredModels.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
                  No models found
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <!-- ── Right Panel ── -->
        <div class="flex flex-col flex-1 min-w-0">
          <!-- Action bar -->
          <div class="px-5 py-3 border-b flex-shrink-0 flex items-center gap-3 flex-wrap min-h-[52px]">
            <span class="text-sm text-muted-foreground flex-1 min-w-0">
              <template v-if="selectedItems.size > 0">
                {{ selectedItems.size }} selected
              </template>
              <template v-else-if="hasPendingChanges">
                <span class="font-medium text-foreground">Pending: </span>
                <span v-if="pendingTagRenames.length > 0" class="text-amber-600">{{ pendingTagRenames.length }} tag rename{{ pendingTagRenames.length !== 1 ? 's' : '' }}</span>
                <span v-if="pendingTagRenames.length > 0 && pendingModelRenames.length > 0">, </span>
                <span v-if="pendingModelRenames.length > 0" class="text-amber-600">{{ pendingModelRenames.length }} model rename{{ pendingModelRenames.length !== 1 ? 's' : '' }}</span>
                <span v-if="(pendingTagRenames.length > 0 || pendingModelRenames.length > 0) && pendingDeletes.size > 0">, </span>
                <span v-if="pendingDeletes.size > 0" class="text-red-600">{{ pendingDeletes.size }} deletion{{ pendingDeletes.size !== 1 ? 's' : '' }}</span>
              </template>
              <template v-else>
                Select or hover an item to manage it.
              </template>
            </span>

            <!-- Batch: mark for deletion -->
            <Button
              v-if="selectedItems.size > 0"
              size="sm"
              variant="destructive"
              @click="markSelectedForDeletion"
            >
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete ({{ selectedItems.size }})
            </Button>

            <!-- Batch: rename single selected -->
            <Button
              v-if="selectedItems.size === 1"
              size="sm"
              variant="outline"
              @click="startRename(Array.from(selectedItems)[0])"
            >
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Rename
            </Button>

            <Button
              v-if="hasPendingChanges"
              size="sm"
              variant="outline"
              @click="clearAllPending"
              :disabled="saving"
            >
              Clear All
            </Button>

            <Button
              v-if="hasPendingChanges"
              size="sm"
              @click="handleSave"
              :disabled="saving"
            >
              <svg v-if="saving" class="animate-spin w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ saving ? 'Saving...' : 'Commit Changes' }}
            </Button>
          </div>

          <!-- Success / Error messages -->
          <div v-if="saveSuccess" class="mx-5 mt-3 flex-shrink-0 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800 flex items-start gap-2">
            <svg class="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              Changes committed successfully!
              <a v-if="saveSuccess.commitUrl" :href="saveSuccess.commitUrl" target="_blank" class="ml-2 underline text-green-700 hover:text-green-900 font-mono text-xs">
                {{ saveSuccess.commitSha.substring(0, 7) }}
              </a>
            </div>
          </div>

          <div v-if="saveError" class="mx-5 mt-3 flex-shrink-0 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800 flex items-start gap-2">
            <svg class="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ saveError }}
          </div>

          <!-- Preview panel: associated templates -->
          <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <template v-if="previewKey">
              <!-- Multi-select chips: click to switch active preview -->
              <div v-if="selectedItems.size > 1" class="mb-3 flex flex-wrap gap-1.5">
                <button
                  v-for="key in selectedItems"
                  :key="key"
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border transition-colors"
                  :class="key === previewKey
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'"
                  @click="activePreviewKey = key"
                >
                  {{ key }}
                  <span class="opacity-70">({{ allTemplates.filter(t => activeTab === 'tags' ? t.tags?.includes(key) : t.models?.includes(key)).length }})</span>
                </button>
              </div>

              <div class="mb-3 flex items-center gap-2">
                <span class="text-sm font-medium">
                  Templates using
                  <code class="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{{ previewKey }}</code>
                </span>
                <Badge variant="secondary" class="text-xs">{{ previewTemplates.length }}</Badge>
              </div>

              <div v-if="previewTemplates.length === 0" class="text-sm text-muted-foreground py-4">
                No templates found using this {{ activeTab === 'tags' ? 'tag' : 'model' }}.
              </div>

              <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div
                  v-for="tpl in previewTemplates"
                  :key="tpl.name"
                  class="border rounded-md overflow-hidden bg-card hover:bg-accent/30 transition-colors"
                >
                  <div class="aspect-square bg-muted overflow-hidden">
                    <img
                      :src="getThumbnailUrl(tpl)"
                      :alt="tpl.title"
                      class="w-full h-full object-cover"
                      loading="lazy"
                      @error="($event.target as HTMLImageElement).style.display = 'none'"
                    />
                  </div>
                  <div class="px-2 py-1.5">
                    <p class="text-xs font-medium truncate leading-tight">{{ tpl.title || tpl.name }}</p>
                    <p class="text-xs text-muted-foreground truncate font-mono mt-0.5">{{ tpl.name }}</p>
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-16">
                <svg class="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p class="text-sm font-medium">No item selected</p>
                <p class="text-xs mt-1">Select or hover an item to preview its associated templates</p>
                <div class="mt-8 text-left space-y-2">
                  <p class="text-xs font-medium text-foreground/60 uppercase tracking-wide">Usage count legend</p>
                  <div class="flex items-center gap-2 text-xs">
                    <Badge variant="destructive" class="text-xs px-1.5">1</Badge>
                    <span>Used only once — candidate for removal</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs">
                    <Badge variant="outline" class="text-xs px-1.5">2–3</Badge>
                    <span>Low usage</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" class="text-xs px-1.5">4+</Badge>
                    <span>Commonly used</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <MainBranchWarningDialog
    v-model:open="showMainBranchWarning"
    :repo="selectedRepo || 'Comfy-Org/workflow_templates'"
    :branch="selectedBranch || 'main'"
    :timing="warningTiming"
    @confirm="handleWarningContinue"
    @cancel="() => { showMainBranchWarning = false; pendingSave = false }"
  />
</template>
