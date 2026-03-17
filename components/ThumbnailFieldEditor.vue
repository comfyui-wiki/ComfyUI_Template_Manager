<template>
  <Dialog v-model:open="isOpen">
    <DialogScrollContent class="max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
      <DialogHeader class="flex-shrink-0">
        <DialogTitle>Edit Thumbnail Field</DialogTitle>
        <DialogDescription>
          <code class="text-xs bg-muted px-1 rounded">{{ template?.name }}</code>
          <span class="ml-1">
            (variant: <code class="text-xs bg-muted px-1 rounded">{{ template?.thumbnailVariant || 'none' }}</code>)
            — {{ needsTwoImages ? '2 images required (before / after)' : '1 image' }}
          </span>
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto min-h-0 space-y-6 py-4">
        <!-- Slot editor -->
        <div
          v-for="(slot, idx) in visibleSlots"
          :key="idx"
          class="border rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-medium text-sm">
              {{ needsTwoImages ? (idx === 0 ? 'Image 1 — Before' : 'Image 2 — After') : 'Image' }}
            </h3>
            <button
              v-if="slot.value"
              @click="clearSlot(idx)"
              class="text-xs text-red-500 hover:text-red-700"
            >
              Clear
            </button>
          </div>

          <!-- Current value + preview -->
          <div v-if="slot.value" class="space-y-2">
            <video
              v-if="/\.(mp4|webm)$/i.test(slot.value)"
              :src="slot.previewUrl || `https://raw.githubusercontent.com/${repo}/${branch}/${slot.value}`"
              class="w-full max-h-48 rounded border bg-muted"
              controls
              muted
              playsinline
            />
            <img
              v-else
              :src="slot.previewUrl || `https://raw.githubusercontent.com/${repo}/${branch}/${slot.value}`"
              class="w-full max-h-48 object-contain rounded border bg-muted"
              :alt="slot.value"
            />
            <div class="flex items-center gap-2 px-2 py-1.5 bg-muted rounded text-xs font-mono">
              <svg class="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ slot.value }}
            </div>
          </div>
          <div v-else class="px-2 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground italic">
            Not set
          </div>

          <!-- Source selector tabs -->
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="source in ['input', 'output', 'thumbnail']"
              :key="source"
              @click="toggleSource(idx, source)"
              :class="[
                'px-2.5 py-1 text-xs border rounded transition-colors',
                slot.activeSource === source
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted border-muted-foreground/30'
              ]"
            >
              {{ source }}/
            </button>
            <button
              @click="toggleSource(idx, 'upload')"
              :class="[
                'px-2.5 py-1 text-xs border rounded transition-colors',
                slot.activeSource === 'upload'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted border-muted-foreground/30'
              ]"
            >
              Upload new → thumbnail/
            </button>
          </div>

          <!-- Folder file dropdown with search -->
          <div v-if="slot.activeSource && slot.activeSource !== 'upload'" class="space-y-1">
            <div v-if="loadingFolders.has(slot.activeSource)" class="text-xs text-muted-foreground">
              Loading…
            </div>
            <div v-else-if="!folderFiles[slot.activeSource]?.length" class="text-xs text-muted-foreground italic">
              No image files found in {{ slot.activeSource }}/
            </div>
            <template v-else>
              <input
                :value="slot.searchQuery"
                @input="slots[idx].searchQuery = ($event.target as HTMLInputElement).value"
                type="text"
                placeholder="Search files…"
                class="w-full text-xs border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div class="max-h-40 overflow-y-auto border rounded bg-background">
                <div
                  v-for="file in folderFiles[slot.activeSource].filter(f => !slot.searchQuery || f.toLowerCase().includes(slot.searchQuery.toLowerCase()))"
                  :key="file"
                  @click="selectFile(idx, `${slot.activeSource}/${file}`)"
                  :class="[
                    'px-2 py-1.5 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground truncate',
                    slot.value === `${slot.activeSource}/${file}` ? 'bg-primary/10 font-medium' : ''
                  ]"
                >
                  {{ file }}
                </div>
                <div
                  v-if="!folderFiles[slot.activeSource].filter(f => !slot.searchQuery || f.toLowerCase().includes(slot.searchQuery.toLowerCase())).length"
                  class="px-2 py-2 text-xs text-muted-foreground italic text-center"
                >
                  No matches
                </div>
              </div>
            </template>
          </div>

          <!-- Upload area -->
          <div v-if="slot.activeSource === 'upload'">
            <input
              :ref="(el) => { if (el) fileInputRefs[idx] = el as HTMLInputElement }"
              type="file"
              accept="image/*,video/webm,video/mp4"
              style="display: none"
              @change="e => handleUpload(idx, e)"
            />
            <div
              class="border-2 border-dashed rounded p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              @click="fileInputRefs[idx]?.click()"
            >
              <div v-if="slot.pendingFile" class="text-xs text-green-700 font-medium">
                {{ slot.pendingFile.name }} ({{ (slot.pendingFile.size / 1024).toFixed(1) }} KB) — will upload to thumbnail/
              </div>
              <div v-else class="text-xs text-muted-foreground">
                Click to select an image / video
              </div>
            </div>
          </div>
        </div>

        <!-- Result preview -->
        <div v-if="thumbnailValue.length" class="text-xs text-muted-foreground">
          Will save: <code class="bg-muted px-1 rounded">{{ JSON.stringify(thumbnailValue) }}</code>
        </div>

        <!-- Feedback (inside scrollable area so it's never clipped) -->
        <div v-if="feedback" :class="['px-3 py-2 rounded text-xs', feedback.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800']">
          {{ feedback.message }}
        </div>
      </div>

      <DialogFooter class="flex-shrink-0">
        <Button variant="outline" @click="isOpen = false">Cancel</Button>
        <Button @click="save" :disabled="isSaving">
          <svg v-if="isSaving" class="w-3.5 h-3.5 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          {{ isSaving ? 'Saving…' : 'Save' }}
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>

  <!-- Main Branch Warning -->
  <MainBranchWarningDialog
    v-model:open="showMainBranchWarning"
    :repo="repo"
    :branch="branch"
    action-type="Commit"
    timing="saving"
    @confirm="save"
    @cancel="showMainBranchWarning = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import MainBranchWarningDialog from '@/components/MainBranchWarningDialog.vue'

const TWO_IMAGE_VARIANTS = new Set(['compareSlider', 'hoverDissolve'])

interface SlotState {
  value: string
  activeSource: string
  pendingFile: File | null
  previewUrl: string  // object URL created before Vue proxying
  searchQuery: string
}

const props = defineProps<{
  open: boolean
  template: any
  repo: string
  branch: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [template: any]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const needsTwoImages = computed(() =>
  TWO_IMAGE_VARIANTS.has(props.template?.thumbnailVariant)
)

const slots = ref<SlotState[]>([
  { value: '', activeSource: '', pendingFile: null, previewUrl: '', searchQuery: '' },
  { value: '', activeSource: '', pendingFile: null, previewUrl: '', searchQuery: '' }
])

// Plain object (non-reactive) — only used to trigger .click(), no reactivity needed
const fileInputRefs: Record<number, HTMLInputElement> = {}

// Only expose the slots that are relevant
const visibleSlots = computed(() =>
  needsTwoImages.value ? slots.value : slots.value.slice(0, 1)
)

const folderFiles = ref<Record<string, string[]>>({})
const loadingFolders = ref<Set<string>>(new Set())
const isSaving = ref(false)
const feedback = ref<{ ok: boolean; message: string } | null>(null)
const showMainBranchWarning = ref(false)

watch(() => props.open, (opened) => {
  if (!opened) return
  feedback.value = null
  const existing: string[] = props.template?.thumbnail || []
  slots.value = [
    { value: existing[0] || '', activeSource: '', pendingFile: null, previewUrl: '', searchQuery: '' },
    { value: existing[1] || '', activeSource: '', pendingFile: null, previewUrl: '', searchQuery: '' }
  ]

  // input / output: read directly from the io field (no API call needed)
  const io = props.template?.io
  folderFiles.value['input'] = (io?.inputs ?? []).map((i: any) => i.file).filter(Boolean)
  folderFiles.value['output'] = (io?.outputs ?? []).map((o: any) => o.file).filter(Boolean)

  // thumbnail/ still needs an API call
  loadFolderFiles('thumbnail')
}, { immediate: true })

async function loadFolderFiles(folder: string) {
  if (folderFiles.value[folder] !== undefined) return
  loadingFolders.value.add(folder)
  try {
    const res = await fetch(
      `/api/github/folder-files?repo=${encodeURIComponent(props.repo)}&branch=${encodeURIComponent(props.branch)}&folder=${folder}`
    )
    const data = await res.json()
    folderFiles.value[folder] = data.files || []
  } catch {
    folderFiles.value[folder] = []
  } finally {
    loadingFolders.value.delete(folder)
  }
}

function toggleSource(idx: number, source: string) {
  const slot = slots.value[idx]
  slots.value[idx] = { ...slot, activeSource: slot.activeSource === source ? '' : source }
}

function selectFile(idx: number, path: string) {
  const old = slots.value[idx]
  if (old.previewUrl) URL.revokeObjectURL(old.previewUrl)
  slots.value[idx] = { ...old, value: path, pendingFile: null, previewUrl: '' }
}

function clearSlot(idx: number) {
  const old = slots.value[idx]
  if (old.previewUrl) URL.revokeObjectURL(old.previewUrl)
  slots.value[idx] = { value: '', activeSource: '', pendingFile: null, previewUrl: '', searchQuery: '' }
}

function handleUpload(idx: number, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const old = slots.value[idx]
  if (old.previewUrl) URL.revokeObjectURL(old.previewUrl)
  const previewUrl = URL.createObjectURL(file)  // create before Vue proxies the File
  slots.value[idx] = { ...old, pendingFile: file, value: `thumbnail/${file.name}`, previewUrl }
}

// Only include slots that are visible; if single-image mode, strip slot 2
const thumbnailValue = computed(() => {
  const values = needsTwoImages.value
    ? slots.value.map(s => s.value)
    : [slots.value[0].value]
  return values.filter(Boolean)
})

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function save() {
  // Check if on main branch and warn
  const isMainBranch = props.branch === 'main' || props.branch === 'master'
  if (isMainBranch && !showMainBranchWarning.value) {
    showMainBranchWarning.value = true
    return
  }
  showMainBranchWarning.value = false

  isSaving.value = true
  feedback.value = null
  try {
    const newFiles: Array<{ filename: string; content: string }> = []
    const slotsToProcess = needsTwoImages.value ? slots.value : slots.value.slice(0, 1)
    for (const slot of slotsToProcess) {
      if (slot.pendingFile && slot.value.startsWith('thumbnail/')) {
        const content = await fileToBase64(slot.pendingFile)
        newFiles.push({ filename: slot.pendingFile.name, content })
      }
    }

    const response = await fetch('/api/github/template/thumbnail-field', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: props.repo,
        branch: props.branch,
        templateName: props.template.name,
        thumbnail: thumbnailValue.value,
        newFiles: newFiles.length > 0 ? newFiles : undefined
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.statusMessage || data.message || 'Save failed')

    feedback.value = { ok: true, message: `Saved! Commit: ${data.commit.sha.substring(0, 7)}` }
    emit('saved', { ...props.template, thumbnail: thumbnailValue.value })
    setTimeout(() => { isOpen.value = false }, 1200)
  } catch (err: any) {
    feedback.value = { ok: false, message: err.message || 'Unknown error' }
  } finally {
    isSaving.value = false
  }
}
</script>
