<template>
  <div class="space-y-4">
      <!-- FFmpeg Loading Status with Progress -->
      <div v-if="!ffmpegLoaded" class="space-y-2">
        <div class="p-2.5 bg-blue-50 border border-blue-200 rounded">
          <div class="flex items-center gap-2 mb-2">
            <svg v-if="!ffmpegLoadError" class="w-4 h-4 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span class="text-sm font-medium" :class="ffmpegLoadError ? 'text-red-800' : 'text-blue-800'">
              {{ ffmpegLoadingMessage }}
            </span>
          </div>

          <!-- Progress Bar -->
          <div v-if="!ffmpegLoadError" class="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: ffmpegLoadProgress + '%' }"
            ></div>
          </div>

          <!-- Retry Button -->
          <Button
            v-if="ffmpegLoadError"
            @click="retryFFmpegLoad"
            size="sm"
            variant="outline"
            class="w-full mt-2"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Loading FFmpeg
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          📦 {{ ffmpegLoadError ? 'Failed to load video converter.' : 'Loading video converter (~31 MB, first time only).' }} Image conversion works without FFmpeg.
        </p>
      </div>

      <!-- File Upload -->
      <div class="space-y-2">
        <Label>Source File</Label>
        <div class="flex gap-2">
          <Input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/jpg,image/png,video/mp4,video/quicktime"
            @change="onFileSelect"
            class="flex-1"
          />
          <Button
            v-if="sourceFile"
            variant="outline"
            size="sm"
            @click="clearFile"
          >
            Clear
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          Supported: JPG, PNG, MP4, MOV (videos will be converted to animated WebP)
        </p>
      </div>

      <!-- Source Preview -->
      <div v-if="sourceFile" class="space-y-2">
        <Label>Source Preview</Label>
        <div class="flex gap-3 items-start">
          <div class="w-24 h-24 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
            <img
              v-if="isImage"
              :src="sourcePreviewUrl"
              alt="Source"
              class="w-full h-full object-cover"
            />
            <video
              v-else-if="isVideo"
              :src="sourcePreviewUrl"
              class="w-full h-full object-cover"
              muted
              loop
              autoplay
            />
          </div>
          <div class="flex-1 space-y-1 text-xs">
            <div><strong>Name:</strong> {{ sourceFile.name }}</div>
            <div><strong>Type:</strong> {{ sourceFile.type }}</div>
            <div><strong>Size:</strong> {{ formatFileSize(sourceFile.size) }}</div>
            <div v-if="sourceDimensions">
              <strong>Dimensions:</strong> {{ sourceDimensions.width }}x{{ sourceDimensions.height }}
            </div>
            <div v-if="isVideo && videoDuration">
              <strong>Duration:</strong> {{ videoDuration.toFixed(2) }}s
            </div>
          </div>
        </div>
      </div>

      <!-- Conversion Settings -->
      <div v-if="sourceFile" class="space-y-3 p-3 border rounded-lg bg-muted/30">
        <h3 class="text-sm font-semibold">Conversion Settings</h3>

        <!-- Target Size -->
        <div class="space-y-2">
          <Label>Target Size</Label>
          <Select v-model="targetSize">
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="400">400x400 (Images - Recommended)</SelectItem>
              <SelectItem value="350">350x350 (Videos - Recommended)</SelectItem>
              <SelectItem value="300">300x300 (Compact)</SelectItem>
              <SelectItem value="512">512x512 (Large)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Quality Setting (for images) -->
        <div v-if="isImage" class="space-y-2">
          <Label>Quality ({{ quality }}%)</Label>
          <input
            type="range"
            v-model.number="quality"
            min="60"
            max="100"
            step="5"
            class="w-full"
          />
          <p class="text-xs text-muted-foreground">
            Higher quality = larger file size
          </p>
        </div>

        <!-- Video Duration (for videos) -->
        <div v-if="isVideo" class="space-y-2">
          <Label>Max Duration ({{ videoMaxDuration }}s)</Label>
          <input
            type="range"
            v-model.number="videoMaxDuration"
            min="1"
            max="5"
            step="0.5"
            class="w-full"
          />
          <p class="text-xs text-muted-foreground">
            Video will be trimmed to this duration. Shorter = smaller file size
          </p>
        </div>

        <!-- FPS for video -->
        <div v-if="isVideo" class="space-y-2">
          <Label>Frame Rate ({{ videoFps }} fps)</Label>
          <input
            type="range"
            v-model.number="videoFps"
            min="10"
            max="30"
            step="5"
            class="w-full"
          />
          <p class="text-xs text-muted-foreground">
            Lower FPS = smaller file, but less smooth animation. 15 fps recommended
          </p>
        </div>

        <div v-if="isVideo" class="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          ✨ Video will be converted to <strong>animated WebP</strong> (looping)
        </div>
      </div>

      <!-- Convert Button -->
      <div v-if="sourceFile">
        <Button
          @click="convertToWebP"
          :disabled="isConverting || (isVideo && !ffmpegLoaded)"
          class="w-full"
        >
          <svg v-if="isConverting" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isConverting ? conversionProgress : (isVideo && !ffmpegLoaded ? 'Loading converter...' : 'Convert to WebP') }}
        </Button>
      </div>

      <!-- Converted Result -->
      <div v-if="convertedFile" class="space-y-2">
        <Label>Converted WebP</Label>
        <div class="flex gap-3 items-start">
          <div class="w-24 h-24 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
            <img
              :src="convertedPreviewUrl"
              alt="Converted"
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex-1 space-y-1 text-xs">
            <div><strong>Name:</strong> {{ convertedFile.name }}</div>
            <div><strong>Size:</strong> {{ formatFileSize(convertedFile.size) }}</div>
            <div
              class="font-semibold"
              :class="{
                'text-green-600': compressionRatio > 0,
                'text-red-600': compressionRatio < 0
              }"
            >
              {{ compressionRatio > 0 ? '↓' : '↑' }}
              {{ Math.abs(compressionRatio).toFixed(1) }}% size change
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <Button @click="downloadConverted" variant="outline" size="sm" class="flex-1">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </Button>
          <Button @click="useConverted" size="sm" class="flex-1">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Use This File
          </Button>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
        {{ error }}
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const emit = defineEmits<{
  converted: [file: File]
}>()

const fileInput = ref<HTMLInputElement>()
const sourceFile = ref<File | null>(null)
const sourcePreviewUrl = ref('')
const sourceDimensions = ref<{ width: number; height: number } | null>(null)
const videoDuration = ref<number | null>(null)

const targetSize = ref('400')
const quality = ref(85)
const videoMaxDuration = ref(3)
const videoFps = ref(15)

const isConverting = ref(false)
const conversionProgress = ref('Converting...')
const convertedFile = ref<File | null>(null)
const convertedPreviewUrl = ref('')
const error = ref('')

// FFmpeg instance
const ffmpeg = ref<FFmpeg | null>(null)
const ffmpegLoaded = ref(false)
const ffmpegLoadError = ref(false)
const ffmpegLoadProgress = ref(0)
const ffmpegLoadingMessage = ref('Initializing...')
const ffmpegLoadedSize = ref('0 MB')
const ffmpegTotalSize = ref('31 MB')

// Helper to format bytes
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  return mb.toFixed(1) + ' MB'
}

// Load FFmpeg function (extracted so we can retry)
const loadFFmpeg = async () => {
  try {
    ffmpegLoadError.value = false
    ffmpegLoadProgress.value = 0
    ffmpegLoadingMessage.value = 'Initializing...'

    console.log('[FFmpeg] Initializing...')
    const ffmpegInstance = new FFmpeg()

    ffmpegInstance.on('log', ({ message }) => {
      console.log('[FFmpeg]', message)
    })

    ffmpegInstance.on('progress', ({ progress, time }) => {
      if (isConverting.value && isVideo.value) {
        conversionProgress.value = `Processing video... ${Math.round(progress * 100)}%`
      }
    })

    // Load FFmpeg - use default ESM build from jsdelivr
    // By not providing a config, it will auto-load from node_modules
    ffmpegLoadingMessage.value = 'Loading FFmpeg core...'
    ffmpegLoadProgress.value = 30

    console.log('[FFmpeg] Loading FFmpeg with default configuration...')

    ffmpegLoadProgress.value = 70
    ffmpegLoadingMessage.value = 'Initializing (may take 30s)...'

    // Add timeout for initialization - use default load() without custom URLs
    const loadPromise = ffmpegInstance.load()

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Initialization timeout after 90 seconds')), 90000)
    })

    await Promise.race([loadPromise, timeoutPromise])

    ffmpegLoadProgress.value = 100
    ffmpegLoadingMessage.value = 'Ready!'

    ffmpeg.value = ffmpegInstance
    ffmpegLoaded.value = true
    console.log('[FFmpeg] Successfully loaded and initialized!')
  } catch (err: any) {
    console.error('[FFmpeg] Failed to load:', err)
    ffmpegLoadError.value = true
    ffmpegLoadingMessage.value = `Failed: ${err.message || 'Unknown error'}`
    ffmpegLoadProgress.value = 0
    error.value = `Failed to load video converter: ${err.message}. Image conversion will still work.`
  }
}

// Retry loading FFmpeg
const retryFFmpegLoad = () => {
  console.log('[FFmpeg] Retrying load...')
  loadFFmpeg()
}

// Load FFmpeg on component mount
onMounted(() => {
  loadFFmpeg()
})

const isImage = computed(() => {
  return sourceFile.value?.type.startsWith('image/')
})

const isVideo = computed(() => {
  return sourceFile.value?.type.startsWith('video/')
})

const compressionRatio = computed(() => {
  if (!sourceFile.value || !convertedFile.value) return 0
  const original = sourceFile.value.size
  const converted = convertedFile.value.size
  return ((original - converted) / original) * 100
})

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const onFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  sourceFile.value = file
  sourcePreviewUrl.value = URL.createObjectURL(file)
  error.value = ''
  convertedFile.value = null
  convertedPreviewUrl.value = ''

  // Set default target size based on file type
  if (file.type.startsWith('image/')) {
    targetSize.value = '400'
  } else if (file.type.startsWith('video/')) {
    targetSize.value = '350'
  }

  // Get dimensions
  if (file.type.startsWith('image/')) {
    await loadImageDimensions(file)
  } else if (file.type.startsWith('video/')) {
    await loadVideoDimensions(file)
  }
}

const loadImageDimensions = (file: File): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      sourceDimensions.value = { width: img.width, height: img.height }
      resolve()
    }
    img.src = URL.createObjectURL(file)
  })
}

const loadVideoDimensions = (file: File): Promise<void> => {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.onloadedmetadata = () => {
      sourceDimensions.value = { width: video.videoWidth, height: video.videoHeight }
      videoDuration.value = video.duration
      resolve()
    }
    video.src = URL.createObjectURL(file)
  })
}

const clearFile = () => {
  sourceFile.value = null
  sourcePreviewUrl.value = ''
  sourceDimensions.value = null
  videoDuration.value = null
  convertedFile.value = null
  convertedPreviewUrl.value = ''
  error.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const convertToWebP = async () => {
  if (!sourceFile.value) return

  isConverting.value = true
  error.value = ''
  conversionProgress.value = 'Converting...'

  try {
    if (isImage.value) {
      await convertImageToWebP()
    } else if (isVideo.value) {
      await convertVideoToWebP()
    }
  } catch (err: any) {
    error.value = err.message || 'Conversion failed'
    console.error('Conversion error:', err)
  } finally {
    isConverting.value = false
  }
}

const convertImageToWebP = async () => {
  if (!sourceFile.value) return

  conversionProgress.value = 'Processing image...'

  const img = new Image()
  const imgUrl = URL.createObjectURL(sourceFile.value)

  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = imgUrl
  })

  const size = parseInt(targetSize.value)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Calculate dimensions to maintain aspect ratio and fit within target size
  let { width, height } = img
  if (width > height) {
    if (width > size) {
      height = (height * size) / width
      width = size
    }
  } else {
    if (height > size) {
      width = (width * size) / height
      height = size
    }
  }

  // Create square canvas and center image
  canvas.width = size
  canvas.height = size

  // Fill with transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0)'
  ctx.fillRect(0, 0, size, size)

  // Center the image
  const x = (size - width) / 2
  const y = (size - height) / 2
  ctx.drawImage(img, x, y, width, height)

  URL.revokeObjectURL(imgUrl)

  // Convert to WebP
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob'))
      },
      'image/webp',
      quality.value / 100
    )
  })

  const fileName = sourceFile.value.name.replace(/\.[^/.]+$/, '') + '.webp'
  convertedFile.value = new File([blob], fileName, { type: 'image/webp' })
  convertedPreviewUrl.value = URL.createObjectURL(convertedFile.value)
}

const convertVideoToWebP = async () => {
  if (!sourceFile.value || !ffmpeg.value) {
    error.value = 'FFmpeg not loaded. Please refresh the page.'
    return
  }

  conversionProgress.value = 'Preparing video...'

  try {
    const size = parseInt(targetSize.value)
    const duration = videoMaxDuration.value
    const fps = videoFps.value
    const inputFileName = 'input' + sourceFile.value.name.substring(sourceFile.value.name.lastIndexOf('.'))
    const outputFileName = 'output.webp'

    // Write input file to FFmpeg virtual filesystem
    conversionProgress.value = 'Loading video file...'
    await ffmpeg.value.writeFile(inputFileName, await fetchFile(sourceFile.value))

    conversionProgress.value = 'Converting to animated WebP...'

    // FFmpeg command to convert video to animated WebP
    // -t: duration limit
    // -vf: video filters (scale with padding to maintain aspect ratio)
    // -vcodec libwebp: use WebP encoder
    // -loop 0: infinite loop
    // -q:v: quality (0-100, lower is better quality)
    // -preset: encoding preset
    // -an: no audio
    // -vsync 0: pass through timestamps
    const qualityValue = Math.round(100 - (quality.value * 0.9)) // Invert and scale (0-100 where lower is better)

    await ffmpeg.value.exec([
      '-i', inputFileName,
      '-t', duration.toString(),
      '-vf', `fps=${fps},scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black`,
      '-vcodec', 'libwebp',
      '-lossless', '0',
      '-compression_level', '4',
      '-q:v', qualityValue.toString(),
      '-loop', '0',
      '-preset', 'default',
      '-an',
      '-vsync', '0',
      outputFileName
    ])

    conversionProgress.value = 'Reading output...'

    // Read the output file
    const data = await ffmpeg.value.readFile(outputFileName)
    const blob = new Blob([data], { type: 'image/webp' })

    const fileName = sourceFile.value.name.replace(/\.[^/.]+$/, '') + '.webp'
    convertedFile.value = new File([blob], fileName, { type: 'image/webp' })
    convertedPreviewUrl.value = URL.createObjectURL(convertedFile.value)

    // Clean up FFmpeg filesystem
    await ffmpeg.value.deleteFile(inputFileName)
    await ffmpeg.value.deleteFile(outputFileName)

    error.value = '' // Clear any previous errors
    console.log('[Video Conversion] Success:', fileName, formatFileSize(convertedFile.value.size))

  } catch (err: any) {
    console.error('[Video Conversion] Error:', err)
    error.value = `Conversion failed: ${err.message || 'Unknown error'}`
    throw err
  }
}

const downloadConverted = () => {
  if (!convertedFile.value) return

  const url = URL.createObjectURL(convertedFile.value)
  const a = document.createElement('a')
  a.href = url
  a.download = convertedFile.value.name
  a.click()
  URL.revokeObjectURL(url)
}

const useConverted = () => {
  if (!convertedFile.value) return
  emit('converted', convertedFile.value)
}

// Watch for quality/settings changes and auto-reconvert
watch([quality, targetSize, videoMaxDuration, videoFps], () => {
  // Clear converted file when settings change
  if (convertedFile.value) {
    convertedFile.value = null
    convertedPreviewUrl.value = ''
  }
})
</script>
