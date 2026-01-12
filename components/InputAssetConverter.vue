<template>
  <div class="space-y-4">
    <!-- Loading State -->
    <div v-if="isImageLoading" class="p-8 border rounded-lg bg-muted/30 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
      <p class="text-sm text-muted-foreground">Loading image...</p>
      <p class="text-xs text-muted-foreground mt-1">{{ originalFileSize }}</p>
    </div>

    <!-- Before/After Comparison (like ThumbnailConverter) -->
    <div v-else-if="previewUrl" class="grid grid-cols-2 gap-3">
      <!-- Before (Original) -->
      <div class="space-y-2">
        <Label class="text-xs">Before (Original)</Label>
        <div class="relative border rounded-lg p-2 bg-muted/30">
          <img
            :src="previewUrl"
            alt="Original"
            class="w-full h-48 object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
            @click="openImageInNewTab(previewUrl)"
            title="Click to open in new tab"
          />
          <div class="mt-2 text-xs text-center space-y-1">
            <div class="font-medium">{{ originalFileSize }}</div>
            <div class="text-muted-foreground">{{ originalDimensions }}</div>
          </div>
        </div>
      </div>

      <!-- After (Converted) -->
      <div class="space-y-2">
        <Label class="text-xs">After ({{ isConverting ? 'Converting...' : 'Converted' }})</Label>
        <div v-if="convertedPreviewUrl" class="relative border rounded-lg p-2" :class="getSizeWarningClass()">
          <img
            :src="convertedPreviewUrl"
            alt="Converted"
            class="w-full h-48 object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
            @click="openImageInNewTab(convertedPreviewUrl)"
            title="Click to open in new tab"
          />
          <div class="mt-2 text-xs text-center space-y-1">
            <div class="font-medium">{{ convertedFileSize }}</div>
            <div class="text-muted-foreground">{{ convertedDimensions }}</div>
            <div class="font-semibold" :class="getSavingsColor()">{{ sizeSavings }}</div>
          </div>
        </div>
        <div v-else class="relative border rounded-lg p-2 bg-muted/30 h-48 flex items-center justify-center">
          <div class="text-center px-4">
            <div v-if="isConverting" class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <svg v-else class="w-12 h-12 mx-auto mb-2 text-muted-foreground opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p class="text-sm text-muted-foreground font-medium">{{ isConverting ? 'Converting...' : 'Ready to Convert' }}</p>
            <p v-if="!isConverting" class="text-xs text-muted-foreground mt-1">Click "Refresh Preview" below</p>
          </div>
        </div>
      </div>
    </div>

    <!-- File Info -->
    <div class="p-3 bg-muted rounded-lg">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-medium">Target Format</div>
        <div class="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
          {{ targetFormat.toUpperCase() }}
        </div>
      </div>
      <div class="text-xs text-muted-foreground">
        Auto-detected from filename: {{ props.targetFilename || sourceFile?.name }}
      </div>
    </div>

    <!-- Resize Options -->
    <div class="space-y-2">
      <Label>Resize Options</Label>
      <Select v-model="resizeMode">
        <SelectTrigger>
          <SelectValue placeholder="Select resize mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Keep original size</SelectItem>
          <SelectItem value="percentage">Resize by percentage</SelectItem>
          <SelectItem value="dimensions">Specific dimensions</SelectItem>
          <SelectItem value="maxDimension">Max dimension (maintain aspect ratio)</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Percentage Resize -->
    <div v-if="resizeMode === 'percentage'" class="space-y-2">
      <Label>Scale Percentage ({{ resizePercentage }}%)</Label>
      <input
        type="range"
        v-model.number="resizePercentage"
        min="10"
        max="100"
        step="5"
        class="w-full"
      />
      <p class="text-xs text-muted-foreground">
        New size: {{ Math.round(originalWidth * resizePercentage / 100) }}×{{ Math.round(originalHeight * resizePercentage / 100) }}px
      </p>
    </div>

    <!-- Specific Dimensions -->
    <div v-if="resizeMode === 'dimensions'" class="space-y-2">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <Label>Width (px)</Label>
          <Input type="number" v-model.number="targetWidth" min="1" />
        </div>
        <div>
          <Label>Height (px)</Label>
          <Input type="number" v-model.number="targetHeight" min="1" />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <input type="checkbox" v-model="maintainAspectRatio" id="aspectRatio" class="rounded" />
        <Label for="aspectRatio" class="text-xs cursor-pointer">Maintain aspect ratio</Label>
      </div>
    </div>

    <!-- Max Dimension -->
    <div v-if="resizeMode === 'maxDimension'" class="space-y-2">
      <Label>Maximum Dimension (px)</Label>
      <Input type="number" v-model.number="maxDimension" min="100" step="100" />
      <p class="text-xs text-muted-foreground">
        Image will be scaled down if any dimension exceeds this value (maintains aspect ratio)
      </p>
    </div>

    <!-- Quality/Compression -->
    <div class="space-y-2">
      <Label>Quality ({{ quality }}%)</Label>
      <input
        type="range"
        v-model.number="quality"
        min="60"
        max="100"
        step="5"
        class="w-full"
        :disabled="targetFormat === 'png'"
      />
      <p class="text-xs text-muted-foreground">
        <span v-if="targetFormat === 'png'" class="text-amber-600">
          ⓘ PNG is lossless - quality adjustment not available. Use WebP or JPEG for compression.
        </span>
        <span v-else>
          Higher quality = larger file size. Recommended: 85-95 for most images
        </span>
      </p>
    </div>

    <!-- Size Warning Message -->
    <div v-if="getSizeWarning()" class="p-3 rounded-lg" :class="getSizeWarningClass()">
      <div class="text-sm font-medium">{{ getSizeWarning() }}</div>
    </div>

    <!-- PNG Warning Message -->
    <div v-if="targetFormat === 'png'" class="p-3 rounded-lg bg-amber-50 border border-amber-200">
      <div class="text-sm font-medium text-amber-800">⚠️ PNG Compression Limitation</div>
      <div class="text-xs text-amber-700 mt-1">
        PNG is a lossless format. Converting PNG to PNG may result in <strong>larger file sizes</strong> due to re-encoding.
      </div>
      <div class="text-xs text-amber-600 mt-2">
        💡 <strong>Recommendation:</strong> For better compression, consider changing the filename extension to <code class="bg-amber-100 px-1 rounded">.webp</code> or <code class="bg-amber-100 px-1 rounded">.jpg</code> in the workflow JSON.
      </div>
    </div>

    <!-- Conversion Error Message -->
    <div v-if="conversionError" class="p-3 rounded-lg bg-red-50 border border-red-200">
      <div class="text-sm font-medium text-red-800">❌ Conversion Failed</div>
      <div class="text-xs text-red-700 mt-1">{{ conversionError }}</div>
      <div class="text-xs text-red-600 mt-2">
        Please try uploading a different file or contact support if the issue persists.
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-2">
      <Button
        @click="handleConvert"
        :disabled="isConverting || isImageLoading || !sourceFile"
        variant="outline"
        class="flex-1"
      >
        <svg v-if="isConverting || isImageLoading" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ isImageLoading ? 'Loading Image...' : isConverting ? 'Converting...' : 'Refresh Preview' }}
      </Button>

      <Button
        @click="handleUseConversion"
        :disabled="!convertedFile || isConverting || isImageLoading"
        class="flex-1"
        size="lg"
      >
        Use This Conversion
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  initialFile?: File | null
  targetFilename?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  converted: [file: File]
}>()

// State
const sourceFile = ref<File | null>(null)
const targetFormat = ref<'webp' | 'jpeg' | 'png'>('webp')
const resizeMode = ref<'none' | 'percentage' | 'dimensions' | 'maxDimension'>('none')
const resizePercentage = ref(100)
const targetWidth = ref(800)
const targetHeight = ref(600)
const maxDimension = ref(1920)
const maintainAspectRatio = ref(true)
const quality = ref(90)
const isConverting = ref(false)
const isImageLoading = ref(false)
const conversionError = ref<string>('')
const previewUrl = ref<string>('')
const convertedPreviewUrl = ref<string>('')
const convertedFile = ref<File | null>(null)
const originalWidth = ref(0)
const originalHeight = ref(0)
const convertedWidth = ref(0)
const convertedHeight = ref(0)
const convertedFileSizeBytes = ref(0)

// Computed
const originalFileSize = computed(() => {
  if (!sourceFile.value) return ''
  return formatFileSize(sourceFile.value.size)
})

const originalDimensions = computed(() => {
  if (originalWidth.value === 0) return ''
  return `${originalWidth.value}×${originalHeight.value}px`
})

const convertedFileSize = computed(() => {
  if (convertedFileSizeBytes.value === 0) return ''
  return formatFileSize(convertedFileSizeBytes.value)
})

const convertedDimensions = computed(() => {
  if (convertedWidth.value === 0) return ''
  return `${convertedWidth.value}×${convertedHeight.value}px`
})

const sizeSavings = computed(() => {
  if (!sourceFile.value || convertedFileSizeBytes.value === 0) return ''
  const diff = sourceFile.value.size - convertedFileSizeBytes.value
  const percent = Math.round((diff / sourceFile.value.size) * 100)
  if (diff > 0) {
    return `↓ ${formatFileSize(diff)} saved (${percent}% smaller)`
  } else {
    return `↑ ${formatFileSize(Math.abs(diff))} larger (${Math.abs(percent)}% bigger)`
  }
})

// Helpers
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const getSizeWarningClass = () => {
  const sizeMB = convertedFileSizeBytes.value / (1024 * 1024)
  const isImage = targetFormat.value !== 'webp' || sourceFile.value?.type.startsWith('image/')

  if (isImage && sizeMB > 2) {
    return 'bg-red-50 border border-red-200 text-red-800'
  } else if (isImage && sizeMB > 1) {
    return 'bg-amber-50 border border-amber-200 text-amber-800'
  } else {
    return 'bg-green-50 border border-green-200 text-green-800'
  }
}

const getSizeWarning = () => {
  const sizeMB = convertedFileSizeBytes.value / (1024 * 1024)
  const isImage = targetFormat.value !== 'webp' || sourceFile.value?.type.startsWith('image/')

  if (isImage && sizeMB > 2) {
    return '⚠️ File is too large (> 2MB). Consider reducing quality or dimensions.'
  } else if (isImage && sizeMB > 1) {
    return '⚠️ File is larger than recommended (> 1MB). Consider reducing quality.'
  }
  return ''
}

const getSavingsColor = () => {
  const diff = sourceFile.value ? sourceFile.value.size - convertedFileSizeBytes.value : 0
  if (diff > 0) {
    return 'text-green-600'
  } else if (diff < 0) {
    return 'text-red-600'
  }
  return 'text-muted-foreground'
}

const openImageInNewTab = (url: string) => {
  window.open(url, '_blank')
}

// Auto-detect format from target filename
const detectFormatFromFilename = (filename: string): 'webp' | 'jpeg' | 'png' => {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'webp') return 'webp'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (ext === 'png') return 'png'

  // Default to webp if unknown
  return 'webp'
}

// Calculate target dimensions based on resize mode
const calculateTargetDimensions = (): { width: number; height: number } => {
  let width = originalWidth.value
  let height = originalHeight.value

  if (resizeMode.value === 'percentage') {
    width = Math.round(originalWidth.value * resizePercentage.value / 100)
    height = Math.round(originalHeight.value * resizePercentage.value / 100)
  } else if (resizeMode.value === 'dimensions') {
    width = targetWidth.value
    height = targetHeight.value

    if (maintainAspectRatio.value) {
      const aspectRatio = originalWidth.value / originalHeight.value
      if (width / height > aspectRatio) {
        width = Math.round(height * aspectRatio)
      } else {
        height = Math.round(width / aspectRatio)
      }
    }
  } else if (resizeMode.value === 'maxDimension') {
    const maxDim = maxDimension.value
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round(height * (maxDim / width))
        width = maxDim
      } else {
        width = Math.round(width * (maxDim / height))
        height = maxDim
      }
    }
  }

  return { width, height }
}

// Convert image
const handleConvert = async () => {
  if (!sourceFile.value) return

  isConverting.value = true
  conversionError.value = ''

  let width = 0
  let height = 0
  let imgUrl = ''

  try {
    // Load image from source file to get accurate dimensions
    const img = new Image()
    imgUrl = URL.createObjectURL(sourceFile.value)
    img.src = imgUrl

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('Failed to load image'))
    })

    // Now we have accurate dimensions from the loaded image
    if (img.width === 0 || img.height === 0) {
      throw new Error('Image has zero dimensions')
    }

    // Update original dimensions if not set
    if (originalWidth.value === 0) {
      originalWidth.value = img.width
      originalHeight.value = img.height
      targetWidth.value = img.width
      targetHeight.value = img.height
    }

    // Calculate target dimensions
    const dimensions = calculateTargetDimensions()
    width = dimensions.width
    height = dimensions.height
    convertedWidth.value = width
    convertedHeight.value = height

    console.log('[InputAssetConverter] Starting conversion:', {
      format: targetFormat.value,
      originalSize: `${img.width}x${img.height}`,
      targetSize: `${width}x${height}`,
      quality: quality.value
    })

    // Create canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // Enable high quality scaling
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Draw image
    ctx.drawImage(img, 0, 0, width, height)

    // Convert to blob
    const mimeType = targetFormat.value === 'jpeg' ? 'image/jpeg' : targetFormat.value === 'png' ? 'image/png' : 'image/webp'

    // PNG doesn't support quality parameter (lossless format)
    const qualityParam = targetFormat.value === 'png' ? undefined : quality.value / 100

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Canvas conversion failed'))
          }
        },
        mimeType,
        qualityParam
      )
    })

    console.log('[InputAssetConverter] Conversion complete:', blob.size, 'bytes')

    // Update state
    convertedFileSizeBytes.value = blob.size
    convertedWidth.value = width
    convertedHeight.value = height

    // Create File object
    const ext = targetFormat.value === 'jpeg' ? 'jpg' : targetFormat.value
    const filename = props.targetFilename || `converted.${ext}`
    const file = new File([blob], filename, { type: mimeType })
    convertedFile.value = file

    // Update preview URL
    if (convertedPreviewUrl.value) {
      URL.revokeObjectURL(convertedPreviewUrl.value)
    }
    convertedPreviewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    console.error('[InputAssetConverter] Conversion error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    conversionError.value = `${errorMessage} (Format: ${targetFormat.value}, Size: ${width}x${height})`
  } finally {
    // Clean up temporary image URL
    if (imgUrl) {
      URL.revokeObjectURL(imgUrl)
    }
    isConverting.value = false
  }
}

// Handle use conversion button
const handleUseConversion = () => {
  if (convertedFile.value) {
    emit('converted', convertedFile.value)
  }
}

// Load initial file
watch(() => props.initialFile, async (file) => {
  if (!file) return

  // Reset state
  sourceFile.value = file
  originalWidth.value = 0
  originalHeight.value = 0
  convertedPreviewUrl.value = ''
  convertedFile.value = null
  conversionError.value = ''
  isImageLoading.value = true

  // Auto-detect format from target filename
  if (props.targetFilename) {
    targetFormat.value = detectFormatFromFilename(props.targetFilename)
  }

  // Create preview URL for original
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = URL.createObjectURL(file)

  // Load image to get dimensions
  if (file.type.startsWith('image/')) {
    const img = new Image()
    img.src = previewUrl.value

    img.onload = () => {
      console.log('[InputAssetConverter] Image loaded:', img.width, 'x', img.height)

      originalWidth.value = img.width
      originalHeight.value = img.height
      targetWidth.value = img.width
      targetHeight.value = img.height
      isImageLoading.value = false

      // Don't auto-convert - let user click "Refresh Preview" after reading warnings
    }

    img.onerror = () => {
      console.error('[InputAssetConverter] Failed to load image')
      isImageLoading.value = false
      conversionError.value = 'Failed to load image. The file may be corrupted or in an unsupported format.'
    }
  } else {
    // Not an image file
    isImageLoading.value = false
  }
}, { immediate: true })

// Watch aspect ratio changes
watch(maintainAspectRatio, (maintain) => {
  if (maintain && resizeMode.value === 'dimensions') {
    const aspectRatio = originalWidth.value / originalHeight.value
    targetHeight.value = Math.round(targetWidth.value / aspectRatio)
  }
})

watch(targetWidth, (newWidth) => {
  if (maintainAspectRatio.value && resizeMode.value === 'dimensions') {
    const aspectRatio = originalWidth.value / originalHeight.value
    targetHeight.value = Math.round(newWidth / aspectRatio)
  }
})

watch(targetHeight, (newHeight) => {
  if (maintainAspectRatio.value && resizeMode.value === 'dimensions') {
    const aspectRatio = originalWidth.value / originalHeight.value
    targetWidth.value = Math.round(newHeight * aspectRatio)
  }
})
</script>
