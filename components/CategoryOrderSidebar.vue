<template>
  <div class="w-80 border-r bg-muted/30 min-h-[calc(100vh-140px)] sticky top-[140px] overflow-y-auto">
    <div class="p-4">
      <h2 class="text-sm font-semibold mb-2">Category Order</h2>
      <p class="text-xs text-muted-foreground mb-4">{{ categoryTitle }}</p>

      <div class="space-y-2">
        <div
          v-for="(template, index) in templates"
          :key="template.name"
          :draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover="onDragOver($event, index)"
          @drop="onDrop($event, index)"
          @dragend="onDragEnd"
          class="p-2 rounded-lg cursor-move transition-all relative"
          :class="{
            'bg-primary/5 border-2 border-primary/20': template.name === currentTemplateName,
            'bg-background hover:bg-accent hover:shadow border border-transparent': template.name !== currentTemplateName,
            'opacity-50': draggedIndex === index
          }"
        >
          <div class="flex items-center gap-3">
            <!-- Drag Handle -->
            <svg class="w-4 h-4 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div class="text-xs font-medium truncate">
                {{ template.title || template.name }}
              </div>
            </div>

            <!-- Current Badge -->
            <div
              v-if="template.name === currentTemplateName"
              class="flex-shrink-0 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-full"
            >
              Current
            </div>

            <!-- Position Change Indicator -->
            <div
              v-else-if="positionChanges.has(template.name)"
              class="flex items-center gap-1 flex-shrink-0"
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
}>()

// Drag and drop state
const draggedIndex = ref<number | null>(null)
const originalTemplates = ref<Template[]>([...props.templates])

// Watch for prop changes to update internal state
watch(
  () => props.templates,
  (newTemplates, oldTemplates) => {
    // Only update if it's a new category or initial load
    // Don't update if user is reordering
    if (draggedIndex.value === null) {
      // Check if this is a genuine external update (not from our own emit)
      // by comparing template names - if the set of templates changed, it's external
      const oldNames = oldTemplates?.map(t => t.name).join(',') || ''
      const newNames = newTemplates.map(t => t.name).join(',')

      // Only reset originalTemplates if the set of templates actually changed
      // (e.g., switched category, added/removed templates)
      // Don't reset if it's just a reorder (same templates, different order)
      if (oldNames !== newNames) {
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

// Expose method to reset original templates (called after save)
const resetOriginalTemplates = () => {
  originalTemplates.value = [...props.templates]
}

defineExpose({
  resetOriginalTemplates
})
</script>
