<template>
  <div class="w-80 border-r bg-muted/30 h-[calc(100vh-140px)] sticky top-[140px] flex flex-col overflow-hidden">
    <div class="p-4 flex-shrink-0">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold">Category Order</h2>
        <button
          type="button"
          class="p-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          @click="refreshOrder"
          :disabled="isRefreshing"
          :title="isRefreshing ? 'Refreshing...' : 'Refresh order from GitHub'"
        >
          <svg
            class="w-4 h-4 transition-transform"
            :class="{ 'animate-spin': isRefreshing }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      <p class="text-xs text-muted-foreground mb-3">{{ categoryTitle }}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 text-xs py-1.5 px-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          @click="sortByUsage"
        >
          Sort by usage
        </button>
        <button
          type="button"
          class="flex-1 text-xs py-1.5 px-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          @click="restoreOrder"
        >
          Restore order
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <div class="space-y-2">
        <div
          v-for="(template, index) in templates"
          :key="template.name"
          :draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover="onDragOver($event, index)"
          @drop="onDrop($event, index)"
          @dragend="onDragEnd"
          class="group p-2 rounded-lg cursor-move transition-all relative"
          :class="{
            'bg-primary/5 border-2 border-primary/20': template.name === currentTemplateName,
            'bg-background hover:bg-accent hover:shadow border border-transparent': template.name !== currentTemplateName,
            'opacity-50': draggedIndex === index
          }"
        >
          <div class="flex items-start gap-3">
            <!-- Drag Handle -->
            <svg class="w-4 h-4 flex-shrink-0 opacity-50 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>

            <!-- Thumbnail -->
            <div class="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
              <img
                :src="getTemplateThumbnailUrl(template)"
                :alt="template.title || template.name"
                class="w-full h-full object-cover"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
            </div>

            <!-- Template Info -->
            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium break-words leading-tight">
                {{ template.title || template.name }}
              </div>
            </div>

            <!-- Current Badge -->
            <div
              v-if="template.name === currentTemplateName"
              class="flex-shrink-0 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-full mt-0.5"
            >
              Current
            </div>

            <!-- Position Change Indicator -->
            <div
              v-else-if="positionChanges.has(template.name)"
              class="flex items-center gap-1 flex-shrink-0 mt-0.5"
            >
              <div
                class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold"
                :class="{
                  'bg-green-500 text-white': positionChanges.get(template.name)!.change > 0,
                  'bg-red-500 text-white': positionChanges.get(template.name)!.change < 0
                }"
              >
                <!-- Up arrow for moved up (positive change) -->
                <svg
                  v-if="positionChanges.get(template.name)!.change > 0"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7" />
                </svg>
                <!-- Down arrow for moved down (negative change) -->
                <svg
                  v-else
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
                </svg>
                <span>{{ Math.abs(positionChanges.get(template.name)!.change) }}</span>
              </div>
            </div>

            <!-- Quick move up/down (visible on hover) -->
            <div class="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
              <button
                type="button"
                class="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                :disabled="index === 0"
                :aria-label="'Move up'"
                @click.stop="moveUp(index)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                class="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                :disabled="index === templates.length - 1"
                :aria-label="'Move down'"
                @click.stop="moveDown(index)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
          <!-- Usage bar: relative to max in category -->
          <div
            v-if="maxUsageInCategory > 0"
            class="mt-1.5 flex items-center gap-2"
          >
            <span class="text-[10px] text-muted-foreground flex-shrink-0">usage</span>
            <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-0">
              <div
                class="h-full rounded-full bg-primary/60 transition-[width] duration-300"
                :style="{ width: `${getUsagePercent(template)}%` }"
              />
            </div>
            <span class="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
              {{ formatUsage(template.usage) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Template {
  name: string
  title?: string
  thumbnailVariant?: string
  mediaSubtype?: string
  usage?: number
}

interface Props {
  templates: Template[]
  currentTemplateName: string
  currentTemplateTitle?: string
  currentTemplateThumbnail?: string
  categoryTitle: string
  repo: string
  branch: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  reorder: [templates: Template[]]
  refresh: []
}>()

// Drag and drop state
const draggedIndex = ref<number | null>(null)
const originalTemplates = ref<Template[]>([...props.templates])
const isRefreshing = ref(false)

// Watch for prop changes to update internal state
watch(
  () => props.templates,
  (newTemplates, oldTemplates) => {
    // Only update if it's a new category or initial load (set of templates changed)
    // Don't update if user is reordering or sort-by-usage (same set, different order)
    if (draggedIndex.value === null) {
      const oldSet = new Set((oldTemplates ?? []).map(t => t.name))
      const newSet = new Set(newTemplates.map(t => t.name))
      const setChanged =
        oldSet.size !== newSet.size || [...newSet].some((n) => !oldSet.has(n))

      // Only reset originalTemplates when the set of templates changed
      // (e.g. switched category, added/removed template), not on reorder/sort
      if (setChanged) {
        originalTemplates.value = [...newTemplates]
      }
    }
  },
  { deep: true }
)

// Watch for template title/thumbnail changes and update the list
watch(
  [() => props.currentTemplateTitle, () => props.currentTemplateThumbnail],
  () => {
    // Don't update during drag operations
    if (draggedIndex.value !== null) {
      return
    }

    const index = props.templates.findIndex(t => t.name === props.currentTemplateName)
    if (index !== -1 && props.currentTemplateTitle) {
      // Update the title in the current template list
      const updatedTemplates = [...props.templates]
      updatedTemplates[index] = {
        ...updatedTemplates[index],
        title: props.currentTemplateTitle
      }
      emit('reorder', updatedTemplates)
    }
  }
)

// Max usage in current category (for progress bar 100%)
const maxUsageInCategory = computed(() => {
  if (!props.templates.length) return 0
  return Math.max(...props.templates.map(t => t.usage ?? 0), 0)
})

// Usage as percentage of category max (0–100)
const getUsagePercent = (template: Template): number => {
  const u = template.usage ?? 0
  if (maxUsageInCategory.value <= 0 || u <= 0) return 0
  return Math.round((u / maxUsageInCategory.value) * 100)
}

// Format usage count for display (e.g. 1.2k, 1.5M)
const formatUsage = (usage?: number): string => {
  const n = usage ?? 0
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// Computed: Calculate position changes
const positionChanges = computed(() => {
  const changes = new Map<string, { oldIndex: number; newIndex: number; change: number }>()

  originalTemplates.value.forEach((template, oldIndex) => {
    const newIndex = props.templates.findIndex(t => t.name === template.name)
    if (newIndex !== -1 && newIndex !== oldIndex) {
      changes.set(template.name, {
        oldIndex,
        newIndex,
        change: oldIndex - newIndex // positive = moved up, negative = moved down
      })
    }
  })

  return changes
})

// Get thumbnail URL for a template
const getTemplateThumbnailUrl = (template: Template): string => {
  // If this is the current template and we have a local thumbnail, use it
  if (template.name === props.currentTemplateName && props.currentTemplateThumbnail) {
    return props.currentTemplateThumbnail
  }

  const [owner, repoName] = props.repo.split('/')
  const mediaSubtype = template.mediaSubtype || 'webp'
  return `https://raw.githubusercontent.com/${owner}/${repoName}/${props.branch}/templates/${template.name}-1.${mediaSubtype}`
}

// Drag and drop handlers
const onDragStart = (event: DragEvent, index: number) => {
  draggedIndex.value = index
  event.dataTransfer!.effectAllowed = 'move'
  console.log('[CategoryOrderSidebar] Drag started:', index)
}

const onDragOver = (event: DragEvent, index: number) => {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
}

const onDrop = (event: DragEvent, targetIndex: number) => {
  event.preventDefault()

  if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
    console.log('[CategoryOrderSidebar] Drop ignored - same position or no drag')
    return
  }

  console.log('[CategoryOrderSidebar] Dropping from', draggedIndex.value, 'to', targetIndex)

  // Reorder the templates array
  const newTemplates = [...props.templates]
  const [draggedTemplate] = newTemplates.splice(draggedIndex.value, 1)
  newTemplates.splice(targetIndex, 0, draggedTemplate)

  console.log('[CategoryOrderSidebar] New order:', newTemplates.map(t => t.name).join(', '))

  emit('reorder', newTemplates)
}

const onDragEnd = () => {
  console.log('[CategoryOrderSidebar] Drag ended')
  draggedIndex.value = null
}

// Sort templates by usage (high to low) and emit new order
const sortByUsage = () => {
  const sorted = [...props.templates].sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0))
  emit('reorder', sorted)
}

// Restore templates to original (saved) order
const restoreOrder = () => {
  emit('reorder', [...originalTemplates.value])
}

// Move template up/down by one position
const moveUp = (index: number) => {
  if (index <= 0) return
  const newTemplates = [...props.templates]
  ;[newTemplates[index - 1], newTemplates[index]] = [newTemplates[index], newTemplates[index - 1]]
  emit('reorder', newTemplates)
}

const moveDown = (index: number) => {
  if (index >= props.templates.length - 1) return
  const newTemplates = [...props.templates]
  ;[newTemplates[index], newTemplates[index + 1]] = [newTemplates[index + 1], newTemplates[index]]
  emit('reorder', newTemplates)
}

// Refresh order from GitHub (clear cache and reload)
const refreshOrder = async () => {
  if (isRefreshing.value) return

  isRefreshing.value = true
  console.log('[CategoryOrderSidebar] Refreshing order from GitHub...')

  try {
    // Emit refresh event to parent component
    emit('refresh')

    // Wait a bit for the refresh to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
  } finally {
    isRefreshing.value = false
  }
}

// Expose method to reset original templates (called after save)
const resetOriginalTemplates = () => {
  originalTemplates.value = [...props.templates]
}

defineExpose({
  resetOriginalTemplates
})
</script>
