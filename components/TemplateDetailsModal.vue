<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>{{ template?.title || template?.name }}</DialogTitle>
        <DialogDescription>
          Template Details and Downloads
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto">
        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>

        <!-- Content -->
        <div v-else class="space-y-6">
          <!-- Download Workflow JSON -->
          <Card>
            <CardHeader>
              <CardTitle class="text-base">Workflow File</CardTitle>
            </CardHeader>
            <CardContent class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                  <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p class="font-medium">{{ template?.name }}.json</p>
                    <p class="text-xs text-muted-foreground">ComfyUI Workflow</p>
                  </div>
                </div>
                <Button @click="downloadWorkflow" size="sm" class="gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Input Files -->
          <Card v-if="inputFiles.length > 0">
            <CardHeader>
              <CardTitle class="text-base">Input Files</CardTitle>
              <p class="text-xs text-muted-foreground mt-1">Files required by this workflow</p>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div
                  v-for="file in inputFiles"
                  :key="file.filename"
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3"
                >
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <!-- Image preview or icon -->
                    <div class="w-16 h-16 rounded bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img
                        v-if="isImageFile(file.filename)"
                        :src="file.url"
                        :alt="file.filename"
                        class="w-full h-full object-cover"
                      />
                      <svg v-else class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-sm truncate">{{ file.filename }}</p>
                      <div class="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{{ file.nodeType }}</span>
                        <span>•</span>
                        <span>{{ formatFileSize(file.size) }}</span>
                      </div>
                    </div>
                  </div>
                  <Button @click="downloadInputFile(file)" size="sm" variant="outline" class="gap-2 flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Output Files -->
          <Card v-if="outputFiles.length > 0">
            <CardHeader>
              <CardTitle class="text-base">Output Files</CardTitle>
              <p class="text-xs text-muted-foreground mt-1">Files produced by this workflow</p>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div
                  v-for="file in outputFiles"
                  :key="file.nodeId"
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3"
                >
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <!-- Icon by mediaType -->
                    <div class="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <svg v-if="file.mediaType === 'image'" class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <svg v-else-if="file.mediaType === 'video'" class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.277A1 1 0 0121 8.623v6.754a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                      <svg v-else-if="file.mediaType === 'audio'" class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                      </svg>
                      <svg v-else class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-sm truncate">{{ file.nodeType }}</p>
                      <div class="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>Node #{{ file.nodeId }}</span>
                        <span>•</span>
                        <span class="capitalize">{{ file.mediaType || 'unknown' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Thumbnails -->
          <Card v-if="thumbnails.length > 0">
            <CardHeader>
              <CardTitle class="text-base">Thumbnails & Media</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <!-- Large Preview Area -->
              <div
                class="relative w-full rounded-lg overflow-hidden bg-muted border select-none"
                style="aspect-ratio: 1 / 1; max-height: 320px;"
                ref="previewContainer"
                @mouseenter="previewHovered = true"
                @mouseleave="previewHovered = false"
              >
                <!-- hoverDissolve variant -->
                <template v-if="thumbnailVariant === 'hoverDissolve' && thumbnails.length >= 2">
                  <img
                    :src="thumbnails[0].url"
                    alt="Thumbnail 1"
                    class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                    :class="previewHovered ? 'opacity-0' : 'opacity-100'"
                    draggable="false"
                  />
                  <img
                    :src="thumbnails[1].url"
                    alt="Thumbnail 2"
                    class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                    :class="previewHovered ? 'opacity-100' : 'opacity-0'"
                    draggable="false"
                  />
                  <div class="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded backdrop-blur-sm pointer-events-none">
                    Hover Dissolve — hover to preview
                  </div>
                </template>

                <!-- compareSlider variant -->
                <template v-else-if="thumbnailVariant === 'compareSlider' && thumbnails.length >= 2">
                  <img
                    :src="thumbnails[0].url"
                    alt="Thumbnail 1"
                    class="absolute inset-0 w-full h-full object-cover"
                    draggable="false"
                  />
                  <img
                    :src="thumbnails[1].url"
                    alt="Thumbnail 2"
                    class="absolute inset-0 w-full h-full object-cover"
                    :style="{ clipPath: `inset(0 ${100 - previewSlider}% 0 0)` }"
                    draggable="false"
                  />
                  <div
                    class="absolute inset-y-0 w-0.5 bg-white/60 backdrop-blur-sm pointer-events-none z-10"
                    :style="{ left: previewSlider + '%' }"
                  />
                  <div class="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded backdrop-blur-sm pointer-events-none">
                    Compare Slider — move mouse to compare
                  </div>
                </template>

                <!-- Single / default -->
                <template v-else>
                  <img
                    :src="thumbnails[0].url"
                    alt="Thumbnail"
                    class="w-full h-full object-cover cursor-zoom-in"
                    draggable="false"
                    @click="openLightbox(0)"
                  />
                </template>

                <!-- Fullscreen button -->
                <button
                  class="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded transition-colors z-20"
                  title="View fullscreen"
                  @click="openLightbox(0)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>

              <!-- Download list -->
              <div class="space-y-2">
                <div
                  v-for="(thumb, index) in thumbnails"
                  :key="index"
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div class="flex items-center gap-3">
                    <img
                      v-if="thumb.url"
                      :src="thumb.url"
                      :alt="`Thumbnail ${index + 1}`"
                      class="w-14 h-14 object-cover rounded cursor-zoom-in hover:opacity-80 transition-opacity"
                      @click="openLightbox(index)"
                    />
                    <svg v-else class="w-14 h-14 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p class="font-medium text-sm">{{ thumb.filename }}</p>
                      <p class="text-xs text-muted-foreground">{{ thumb.type }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Button @click="openLightbox(index)" size="sm" variant="ghost" class="gap-1 px-2 h-8 text-xs" title="Preview">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Button>
                    <Button @click="downloadThumbnail(thumb)" size="sm" variant="outline" class="gap-2">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Lightbox -->
          <Teleport to="body">
            <div
              v-if="lightboxOpen"
              class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
              @click.self="closeLightbox"
              @keydown.esc="closeLightbox"
            >
              <!-- Navigation: prev -->
              <button
                v-if="thumbnails.length > 1"
                class="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
                @click="lightboxIndex = (lightboxIndex - 1 + thumbnails.length) % thumbnails.length"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <!-- Image -->
              <div class="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3">
                <img
                  :src="thumbnails[lightboxIndex]?.url"
                  :alt="`Thumbnail ${lightboxIndex + 1}`"
                  class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                />
                <div class="flex items-center gap-3 text-white/80 text-sm">
                  <span>{{ thumbnails[lightboxIndex]?.filename }}</span>
                  <span v-if="thumbnails.length > 1">{{ lightboxIndex + 1 }} / {{ thumbnails.length }}</span>
                </div>
              </div>

              <!-- Navigation: next -->
              <button
                v-if="thumbnails.length > 1"
                class="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
                @click="lightboxIndex = (lightboxIndex + 1) % thumbnails.length"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <!-- Close button -->
              <button
                class="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                @click="closeLightbox"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <!-- Dot indicators -->
              <div v-if="thumbnails.length > 1" class="absolute bottom-4 flex items-center gap-2">
                <button
                  v-for="(_, i) in thumbnails"
                  :key="i"
                  class="w-2 h-2 rounded-full transition-colors"
                  :class="i === lightboxIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'"
                  @click="lightboxIndex = i"
                />
              </div>
            </div>
          </Teleport>

          <!-- Branch Information -->
          <Card>
            <CardHeader>
              <CardTitle class="text-base">Source Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="space-y-2 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Repository</span>
                  <span class="font-mono text-xs">{{ repo }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Branch</span>
                  <span class="font-mono text-xs">{{ branch }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Template Information (moved to bottom) -->
          <Card>
            <CardHeader>
              <CardTitle class="text-base">Template Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="space-y-3 text-sm">
                <div v-if="template?.description" class="pb-3 border-b">
                  <p class="text-muted-foreground">{{ template.description }}</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div v-if="template?.category">
                    <p class="text-xs font-medium text-muted-foreground mb-1">Category</p>
                    <p class="font-medium">{{ template.categoryTitle || template.category }}</p>
                  </div>

                  <div v-if="template?.date">
                    <p class="text-xs font-medium text-muted-foreground mb-1">Date</p>
                    <p class="font-medium">{{ formatDate(template.date) }}</p>
                  </div>

                  <div v-if="template?.comfyuiVersion">
                    <p class="text-xs font-medium text-muted-foreground mb-1">ComfyUI Version</p>
                    <p class="font-mono text-xs">{{ template.comfyuiVersion }}</p>
                  </div>

                  <div v-if="template?.openSource !== undefined">
                    <p class="text-xs font-medium text-muted-foreground mb-1">Type</p>
                    <p class="font-medium">{{ template.openSource === false ? 'API' : 'Open Source' }}</p>
                  </div>
                </div>

                <div v-if="template?.models && template.models.length > 0" class="pt-3 border-t">
                  <p class="text-xs font-medium text-muted-foreground mb-2">Models</p>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="model in template.models"
                      :key="model"
                      class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                    >
                      {{ model }}
                    </span>
                  </div>
                </div>

                <div v-if="template?.tags && template.tags.length > 0" class="pt-3 border-t">
                  <p class="text-xs font-medium text-muted-foreground mb-2">Tags</p>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="tag in template.tags"
                      :key="tag"
                      class="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>

                <div v-if="template?.tutorialUrl" class="pt-3 border-t">
                  <p class="text-xs font-medium text-muted-foreground mb-2">Tutorial</p>
                  <a
                    :href="template.tutorialUrl"
                    target="_blank"
                    class="text-blue-600 hover:text-blue-800 underline text-sm flex items-center gap-1"
                  >
                    {{ template.tutorialUrl }}
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

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
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useMouseInElement } from '@vueuse/core'

interface Props {
  open?: boolean
  template: any
  repo: string
  branch: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = ref(props.open || false)
const loading = ref(false)
const thumbnails = ref<any[]>([])
const inputFiles = ref<any[]>([])

// Preview state
const previewContainer = ref<HTMLElement | null>(null)
const previewHovered = ref(false)
const previewSlider = ref(50)
const { elementX, elementWidth, isOutside } = useMouseInElement(previewContainer)

watch(
  [previewHovered, elementX, elementWidth, isOutside],
  ([hovered, x, width, outside]) => {
    if (!hovered || thumbnailVariant.value !== 'compareSlider') return
    if (!outside && width > 0) {
      previewSlider.value = (x / width) * 100
    }
  }
)

// Lightbox state
const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

const openLightbox = (index: number) => {
  lightboxIndex.value = index
  lightboxOpen.value = true
}

const closeLightbox = () => {
  lightboxOpen.value = false
}

// Handle keyboard navigation in lightbox
const handleKeydown = (e: KeyboardEvent) => {
  if (!lightboxOpen.value) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowLeft') lightboxIndex.value = (lightboxIndex.value - 1 + thumbnails.value.length) % thumbnails.value.length
  if (e.key === 'ArrowRight') lightboxIndex.value = (lightboxIndex.value + 1) % thumbnails.value.length
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const outputFiles = computed(() => {
  if (!props.template?.io?.outputs || !Array.isArray(props.template.io.outputs)) return []
  return props.template.io.outputs
})

const thumbnailVariant = computed(() => {
  return props.template?.thumbnailVariant || 'none'
})

watch(() => props.open, (value) => {
  isOpen.value = value || false
  if (value) {
    loadThumbnails()
    loadInputFiles()
  }
})

watch(isOpen, (value) => {
  emit('update:open', value)
})

const loadThumbnails = () => {
  thumbnails.value = []

  if (!props.template) return

  const variant = props.template.thumbnailVariant || 'none'
  const mediaSubtype = props.template.mediaSubtype || 'webp'

  // Determine how many thumbnails based on variant
  let count = 1
  if (variant === 'hoverDissolve' || variant === 'compareSlider') {
    count = 2
  }

  // Load thumbnails
  const cacheBust = Date.now()
  for (let i = 1; i <= count; i++) {
    const filename = `${props.template.name}-${i}.${mediaSubtype}`
    const url = `https://raw.githubusercontent.com/${props.repo}/${props.branch}/templates/${filename}?t=${cacheBust}`

    thumbnails.value.push({
      index: i,
      filename,
      url,
      type: mediaSubtype === 'webp' ? 'WebP Image' : `${mediaSubtype.toUpperCase()} ${mediaSubtype.includes('mp4') ? 'Video' : 'Image'}`
    })
  }
}

const downloadWorkflow = async () => {
  if (!props.template?.name) return

  try {
    const url = `https://raw.githubusercontent.com/${props.repo}/${props.branch}/templates/${props.template.name}.json?t=${Date.now()}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Failed to download workflow')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${props.template.name}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('[Download Workflow] Error:', error)
    alert('Failed to download workflow file')
  }
}

const downloadThumbnail = async (thumb: any) => {
  try {
    const response = await fetch(thumb.url)

    if (!response.ok) {
      throw new Error('Failed to download thumbnail')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = thumb.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('[Download Thumbnail] Error:', error)
    alert('Failed to download thumbnail')
  }
}

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

const loadInputFiles = async () => {
  inputFiles.value = []

  if (!props.template?.name) return

  try {
    // Load workflow JSON
    const workflowUrl = `https://raw.githubusercontent.com/${props.repo}/${props.branch}/templates/${props.template.name}.json?t=${Date.now()}`
    const workflowResponse = await fetch(workflowUrl)

    if (!workflowResponse.ok) {
      console.warn('[TemplateDetailsModal] Failed to load workflow')
      return
    }

    const workflowText = await workflowResponse.text()
    const data = JSON.parse(workflowText)
    const nodes = data.nodes || []

    // Asset node types that require input files
    const ASSET_NODE_TYPES = ['LoadImage', 'LoadAudio', 'LoadVideo', 'VHS_LoadVideo']

    // Parse workflow for input files
    const inputFileRefs: any[] = []

    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue

      const nodeType = node.type
      if (ASSET_NODE_TYPES.includes(nodeType)) {
        const widgetsValues = node.widgets_values
        let filename: string | null = null

        // Handle different widgets_values formats
        if (nodeType === 'VHS_LoadVideo') {
          // VHS_LoadVideo uses object format: { video: "filename.mp4", ... }
          if (widgetsValues && typeof widgetsValues === 'object' && !Array.isArray(widgetsValues)) {
            filename = widgetsValues.video
          }
        } else {
          // Standard nodes use array format: ["filename.png"]
          if (Array.isArray(widgetsValues) && widgetsValues.length > 0) {
            filename = widgetsValues[0]
          }
        }

        if (filename) {
          // Check if already added
          if (!inputFileRefs.find(f => f.filename === filename)) {
            inputFileRefs.push({
              filename,
              nodeId: node.id,
              nodeType: nodeType
            })
          }
        }
      }
    }

    console.log('[TemplateDetailsModal] Found input files:', inputFileRefs)

    // Check if files exist in input/ folder
    for (const fileRef of inputFileRefs) {
      const fileUrl = `https://raw.githubusercontent.com/${props.repo}/${props.branch}/input/${fileRef.filename}?t=${Date.now()}`

      try {
        const response = await fetch(fileUrl, { method: 'HEAD' })
        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          fileRef.exists = true
          fileRef.size = contentLength ? parseInt(contentLength) : 0
          fileRef.url = fileUrl
        } else {
          fileRef.exists = false
        }
      } catch {
        fileRef.exists = false
      }
    }

    inputFiles.value = inputFileRefs.filter(f => f.exists)
    console.log('[TemplateDetailsModal] Input files with existence:', inputFiles.value)
  } catch (error) {
    console.error('[TemplateDetailsModal] Error loading input files:', error)
  }
}

const downloadInputFile = async (file: any) => {
  try {
    const response = await fetch(file.url)

    if (!response.ok) {
      throw new Error('Failed to download input file')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = file.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('[Download Input File] Error:', error)
    alert('Failed to download input file')
  }
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const isImageFile = (filename: string) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))
}
</script>
