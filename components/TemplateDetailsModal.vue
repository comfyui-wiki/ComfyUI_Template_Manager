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

          <!-- High-res Thumbnails (from thumbnail field) -->
          <Card v-if="thumbnails.length > 0">
            <CardHeader>
              <CardTitle class="text-base">High-res Thumbnails</CardTitle>
              <p class="text-xs text-muted-foreground mt-1">Full-resolution media files for this template</p>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div
                  v-for="(thumb, index) in thumbnails"
                  :key="index"
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3"
                >
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <!-- Preview thumbnail -->
                    <div class="w-16 h-16 rounded bg-gray-200 flex-shrink-0 overflow-hidden">
                      <video
                        v-if="/\.(mp4|webm)$/i.test(thumb.filename)"
                        :src="thumb.url"
                        class="w-full h-full object-cover"
                        muted
                        playsinline
                      />
                      <img
                        v-else
                        :src="thumb.url"
                        :alt="thumb.filename"
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-sm truncate">{{ thumb.filename }}</p>
                      <p class="text-xs text-muted-foreground">{{ thumb.type }}</p>
                      <p class="text-xs text-muted-foreground font-mono truncate">{{ thumb.path }}</p>
                    </div>
                  </div>
                  <Button @click="downloadThumbnail(thumb)" size="sm" variant="outline" class="gap-2 flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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
import { ref, watch, computed } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

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

  const thumbPaths: string[] = props.template.thumbnail || []
  if (thumbPaths.length === 0) return

  const cacheBust = Date.now()
  for (const path of thumbPaths) {
    const filename = path.split('/').pop() || path
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const isVideo = ['mp4', 'webm'].includes(ext)
    const type = isVideo
      ? `${ext.toUpperCase()} Video`
      : ext ? `${ext.toUpperCase()} Image` : 'Image'
    const url = `https://raw.githubusercontent.com/${props.repo}/${props.branch}/${path}?t=${cacheBust}`

    thumbnails.value.push({ filename, url, type, path })
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
    // Use a clean URL without cache-bust param for download
    const cleanUrl = `https://raw.githubusercontent.com/${props.repo}/${props.branch}/${thumb.path}`
    const response = await fetch(cleanUrl)

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
