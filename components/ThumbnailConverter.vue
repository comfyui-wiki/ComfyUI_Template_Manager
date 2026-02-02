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

          <div v-if="!ffmpegLoadError" class="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" :style="{ width: ffmpegLoadProgress + '%' }"></div>
          </div>

          <Button v-if="ffmpegLoadError" @click="retryFFmpegLoad" size="sm" variant="outline" class="w-full mt-2">
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
          <Button v-if="sourceFile" variant="outline" size="sm" @click="clearFile">Clear</Button>
        </div>
        <p class="text-xs text-muted-foreground">
          Supported: JPG, PNG, MP4, MOV (videos will be converted to animated WebP)
        </p>
      </div>

      <!-- Crop Preview for Images -->
      <div v-if="sourceFile && isImage && fitMode === 'crop'" class="space-y-2">
        <Label>Crop Area (drag the box to adjust position)</Label>
        <div class="relative inline-block bg-muted/30 p-4 rounded">
          <div
            ref="imageContainer"
            class="relative border border-border overflow-hidden"
            :style="{ width: imagePreviewWidth + 'px', height: imagePreviewHeight + 'px' }"
          >
            <!-- Background image -->
            <img
              :src="sourcePreviewUrl"
              class="absolute inset-0 w-full h-full object-contain"
              alt="Source"
            />

            <!-- Mask overlay with hole for crop box -->
            <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
              <defs>
                <mask :id="'cropMaskImage'">
                  <rect width="100%" height="100%" fill="white"/>
                  <rect
                    :x="imageCropBoxX"
                    :y="imageCropBoxY"
                    :width="imageCropBoxSize"
                    :height="imageCropBoxSize"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.5)" :mask="'url(#cropMaskImage)'"/>
            </svg>

            <!-- Crop box (draggable) -->
            <div
              class="absolute border-2 border-white cursor-move bg-transparent"
              :style="{
                left: imageCropBoxX + 'px',
                top: imageCropBoxY + 'px',
                width: imageCropBoxSize + 'px',
                height: imageCropBoxSize + 'px',
                zIndex: 2
              }"
              @mousedown="startDragImageCropBox"
            >
              <!-- Corner handles -->
              <div class="absolute w-3 h-3 bg-white rounded-full -top-1.5 -left-1.5"></div>
              <div class="absolute w-3 h-3 bg-white rounded-full -top-1.5 -right-1.5"></div>
              <div class="absolute w-3 h-3 bg-white rounded-full -bottom-1.5 -left-1.5"></div>
              <div class="absolute w-3 h-3 bg-white rounded-full -bottom-1.5 -right-1.5"></div>
            </div>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          Drag the white box to select which part of the image to keep. The darkened area will be cropped out.
        </p>
      </div>

      <!-- Crop Preview for Videos -->
      <div v-if="sourceFile && isVideo && fitMode === 'crop'" class="space-y-2">
        <Label>Crop Area (drag the box to adjust position)</Label>
        <div class="relative inline-block bg-muted/30 p-4 rounded">
          <div
            ref="videoContainer"
            class="relative border border-border overflow-hidden"
            :style="{ width: videoPreviewWidth + 'px', height: videoPreviewHeight + 'px' }"
          >
            <!-- Background video -->
            <video
              ref="cropVideoPreview"
              :src="sourcePreviewUrl"
              class="absolute inset-0 w-full h-full object-contain"
              muted
              autoplay
              @loadedmetadata="onCropVideoLoaded"
              @timeupdate="onVideoTimeUpdate"
            />

            <!-- Mask overlay with hole for crop box -->
            <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
              <defs>
                <mask :id="'cropMaskVideo'">
                  <rect width="100%" height="100%" fill="white"/>
                  <rect
                    :x="cropBoxX"
                    :y="cropBoxY"
                    :width="cropBoxSize"
                    :height="cropBoxSize"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.5)" :mask="'url(#cropMaskVideo)'"/>
            </svg>

            <!-- Crop box (draggable) -->
            <div
              class="absolute border-2 border-white cursor-move bg-transparent"
              :style="{
                left: cropBoxX + 'px',
                top: cropBoxY + 'px',
                width: cropBoxSize + 'px',
                height: cropBoxSize + 'px',
                zIndex: 2
              }"
              @mousedown="startDragCropBox"
            >
              <!-- Corner handles -->
              <div class="absolute w-3 h-3 bg-white rounded-full -top-1.5 -left-1.5"></div>
              <div class="absolute w-3 h-3 bg-white rounded-full -top-1.5 -right-1.5"></div>
              <div class="absolute w-3 h-3 bg-white rounded-full -bottom-1.5 -left-1.5"></div>
              <div class="absolute w-3 h-3 bg-white rounded-full -bottom-1.5 -right-1.5"></div>
            </div>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          Drag the white box to select which part of the video to keep. The darkened area will be cropped out.
        </p>
      </div>

      <!-- Source Info (compact for when not cropping) -->
      <div v-if="sourceFile && fitMode !== 'crop'" class="space-y-2">
        <Label>Source Info</Label>
        <div class="flex gap-3 items-start">
          <div class="w-24 h-24 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
            <img v-if="isImage" :src="sourcePreviewUrl" alt="Source" class="w-full h-full object-cover" />
            <video 
              v-else-if="isVideo" 
              ref="sourceInfoVideo"
              :src="sourcePreviewUrl" 
              class="w-full h-full object-cover" 
              muted 
              autoplay
              @loadedmetadata="onSourceInfoVideoLoaded"
              @timeupdate="onSourceInfoVideoTimeUpdate"
            />
          </div>
          <div class="flex-1 space-y-1 text-xs">
            <div><strong>Name:</strong> {{ sourceFile.name }}</div>
            <div><strong>Size:</strong> {{ formatFileSize(sourceFile.size) }}</div>
            <div v-if="sourceDimensions"><strong>Dimensions:</strong> {{ sourceDimensions.width }}x{{ sourceDimensions.height }}</div>
            <div v-if="isVideo && videoDuration"><strong>Duration:</strong> {{ videoDuration.toFixed(2) }}s</div>
          </div>
        </div>
      </div>

      <!-- Conversion Settings -->
      <div v-if="sourceFile" class="space-y-3 p-3 border rounded-lg bg-muted/30">
        <h3 class="text-sm font-semibold">Conversion Settings</h3>

        <!-- Target Size (Display Only) -->
        <div class="space-y-2">
          <Label>Target Size</Label>
          <div class="px-3 py-2 bg-muted rounded-md text-sm">
            {{ isVideo ? '350x350 (Video)' : '400x400 (Image)' }}
          </div>
        </div>

        <!-- Fit Mode -->
        <div class="space-y-2">
          <Label>Fit Mode</Label>
          <Select v-model="fitMode">
            <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="crop">Crop (fill entire square)</SelectItem>
              <SelectItem value="pad">Pad (fit with letterbox)</SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            {{ fitMode === 'crop' ? 'Crop to fill the square - drag above to adjust' : 'Fit within square with black bars' }}
          </p>
        </div>

        <!-- Quality Setting -->
        <div class="space-y-2">
          <Label>Quality ({{ quality }}%)</Label>
          <input type="range" v-model.number="quality" min="60" max="100" step="5" class="w-full" />
          <p class="text-xs text-muted-foreground">Higher quality = larger file size</p>
        </div>

        <!-- Video Timeline Trimming -->
        <div v-if="isVideo && videoDuration" class="space-y-3">
          <Label>Video Timeline</Label>
          
          <!-- Timeline Visualization -->
          <div class="space-y-2">
            <div class="relative h-12 bg-muted rounded-lg overflow-hidden border border-border">
              <!-- Timeline track -->
              <div class="absolute inset-0 bg-gradient-to-r from-blue-100 to-blue-200"></div>
              
              <!-- Time tick marks -->
              <div class="absolute inset-0">
                <div 
                  v-for="i in Math.min(Math.floor(videoDuration), 20)" 
                  :key="i"
                  class="absolute top-0 bottom-0 w-px bg-gray-300 opacity-50"
                  :style="{ left: (i / videoDuration * 100) + '%' }"
                ></div>
              </div>
              
              <!-- Selected range highlight -->
              <div 
                class="absolute top-0 bottom-0 bg-blue-500 opacity-30"
                :style="{
                  left: (videoStartTime / videoDuration * 100) + '%',
                  width: ((videoEndTime - videoStartTime) / videoDuration * 100) + '%'
                }"
              ></div>
              
              <!-- Time markers -->
              <div class="absolute inset-0 flex items-center justify-between px-2 text-xs font-mono text-gray-600">
                <span>0:00</span>
                <span>{{ formatTime(videoDuration) }}</span>
              </div>
              
              <!-- Start handle -->
              <div
                class="absolute top-0 bottom-0 w-1 bg-green-500 cursor-ew-resize hover:w-2 transition-all z-10"
                :style="{ left: (videoStartTime / videoDuration * 100) + '%' }"
                @mousedown="startDragTimelineHandle('start', $event)"
              >
                <div class="absolute top-1/2 -translate-y-1/2 -left-2 w-4 h-8 bg-green-500 rounded shadow-lg flex items-center justify-center">
                  <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 10l5-5v10l-5-5z" />
                  </svg>
                </div>
              </div>
              
              <!-- End handle -->
              <div
                class="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize hover:w-2 transition-all z-10"
                :style="{ left: (videoEndTime / videoDuration * 100) + '%' }"
                @mousedown="startDragTimelineHandle('end', $event)"
              >
                <div class="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-8 bg-red-500 rounded shadow-lg flex items-center justify-center">
                  <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M15 10l-5 5V5l5 5z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <!-- Timeline info -->
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1">
                  <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                  Start: {{ formatTime(videoStartTime) }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <span class="w-2 h-2 bg-red-500 rounded-full"></span>
                  End: {{ formatTime(videoEndTime) }}
                </span>
              </div>
              <span class="font-semibold text-blue-600">
                Duration: {{ formatTime(videoEndTime - videoStartTime) }}
              </span>
            </div>
          </div>
          
          <!-- Manual time inputs -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <Label class="text-xs">Start Time (seconds)</Label>
              <Input 
                type="number" 
                v-model.number="videoStartTime" 
                :min="0" 
                :max="Math.max(0, videoDuration - 0.5)"
                step="0.1"
                class="h-8 text-sm"
                @input="constrainTimeRange"
              />
            </div>
            <div class="space-y-1">
              <Label class="text-xs">End Time (seconds)</Label>
              <Input 
                type="number" 
                v-model.number="videoEndTime" 
                :min="Math.min(videoStartTime + 0.5, videoDuration)"
                :max="videoDuration"
                step="0.1"
                class="h-8 text-sm"
                @input="constrainTimeRange"
              />
            </div>
          </div>
          
          <!-- Quick duration presets -->
          <div class="flex items-center gap-2 text-xs">
            <span class="text-muted-foreground">Quick select:</span>
            <Button 
              v-for="preset in [1, 2, 3, 5]" 
              :key="preset"
              variant="outline" 
              size="sm" 
              class="h-6 px-2 text-xs"
              :disabled="preset > videoDuration"
              @click="applyDurationPreset(preset)"
            >
              {{ preset }}s
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              class="h-6 px-2 text-xs"
              @click="resetTimeline"
            >
              Reset
            </Button>
          </div>
          
          <p class="text-xs text-muted-foreground">
            🎬 Drag the green and red handles to select the video segment to keep
          </p>
          
          <!-- Duration warning -->
          <div v-if="(videoEndTime - videoStartTime) > 5" class="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            ⚠️ Video duration exceeds 5 seconds. Consider shortening it to reduce file size.
          </div>
        </div>

        <!-- FPS for video -->
        <div v-if="isVideo" class="space-y-2">
          <Label>Frame Rate ({{ videoFps }} fps)</Label>
          <input type="range" v-model.number="videoFps" min="10" max="30" step="5" class="w-full" />
          <p class="text-xs text-muted-foreground">Lower FPS = smaller file. 15 fps recommended</p>
        </div>

        <div v-if="isVideo" class="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          ✨ Video will be converted to <strong>animated WebP</strong> (looping)
        </div>
      </div>

      <!-- Convert Button -->
      <div v-if="sourceFile">
        <Button @click="convertToWebP" :disabled="isConverting || (isVideo && !ffmpegLoaded)" class="w-full">
          <svg v-if="isConverting" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isConverting ? conversionProgress : (isVideo && !ffmpegLoaded ? 'Loading converter...' : 'Convert to WebP') }}
        </Button>
      </div>

      <!-- Before/After Comparison -->
      <div v-if="convertedFile" class="space-y-2">
        <Label>Before/After Comparison - 250x250 preview</Label>
        <div class="flex gap-4">
          <!-- Before (Original) -->
          <div class="flex-1 space-y-2">
            <div class="flex items-center justify-between px-2">
              <div class="text-xs font-medium">Before (Original)</div>
              <button
                v-if="beforePreviewOffsetX !== 0 || beforePreviewOffsetY !== 0"
                @click="beforePreviewOffsetX = 0; beforePreviewOffsetY = 0"
                class="text-xs text-blue-600 hover:text-blue-800"
              >
                Reset
              </button>
            </div>
            <div class="relative rounded overflow-hidden border border-border hover:border-blue-400 transition-colors" style="width: 250px; height: 250px; background: black;">
              <img
                v-if="isImage"
                :src="sourcePreviewUrl"
                alt="Before"
                class="w-full h-full select-none"
                :style="beforePreviewStyle"
                @mousedown="startDragBeforePreview"
                draggable="false"
              />
              <video
                v-else-if="isVideo"
                ref="beforeComparisonVideo"
                :src="sourcePreviewUrl"
                class="w-full h-full select-none"
                :style="beforePreviewStyle"
                @mousedown="startDragBeforePreview"
                @loadedmetadata="onBeforeComparisonVideoLoaded"
                @timeupdate="onBeforeComparisonVideoTimeUpdate"
                muted
                autoplay
                playsinline
              />
            </div>
            <div class="text-xs text-muted-foreground text-center">
              Original: {{ formatFileSize(sourceFile.size) }}<br>
              <span class="text-[10px] text-gray-500">Drag to adjust position</span>
            </div>
          </div>

          <!-- After (Converted) -->
          <div class="flex-1 space-y-2">
            <div class="text-xs font-medium text-center">After (WebP)</div>
            <div class="relative rounded overflow-hidden border border-border" style="width: 250px; height: 250px; background: black;">
              <img :src="convertedPreviewUrl" alt="After" class="w-full h-full object-cover" />
            </div>
            <div class="text-xs text-muted-foreground text-center">
              Converted: {{ formatFileSize(convertedFile.size) }}
            </div>
          </div>
        </div>

        <!-- File info -->
        <div class="space-y-1 text-xs">
          <div><strong>Name:</strong> {{ convertedFile.name }}</div>
          <div><strong>Size:</strong> {{ formatFileSize(convertedFile.size) }}</div>
          <div><strong>Final Dimensions:</strong> {{ targetSize }}x{{ targetSize }}</div>
          <div><strong>Preview:</strong> {{ targetSize }}x{{ targetSize }} (for comparison)</div>
          <div class="font-semibold" :class="{ 'text-green-600': compressionRatio > 0, 'text-red-600': compressionRatio < 0 }">
            {{ compressionRatio > 0 ? '↓' : '↑' }} {{ Math.abs(compressionRatio).toFixed(1) }}% size change
          </div>
        </div>

        <!-- Size recommendation -->
        <!-- Video warnings -->
        <div v-if="isVideo && convertedFile.size > 4 * 1024 * 1024" class="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          🚫 Video size exceeds 4MB limit! Please reduce quality setting significantly.
        </div>
        <div v-else-if="isVideo && convertedFile.size > 1 * 1024 * 1024" class="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          ⚠️ Video size exceeds 1MB (recommended). Consider reducing quality for better performance.
        </div>
        <div v-else-if="isVideo" class="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
          ✓ Video size is optimal (under 1MB).
        </div>

        <!-- Image warnings -->
        <div v-if="isImage && convertedFile.size > 200 * 1024" class="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          🚫 Image size exceeds 200KB limit! Please reduce quality setting significantly.
        </div>
        <div v-else-if="isImage && convertedFile.size > 100 * 1024" class="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          ⚠️ Image size exceeds 100KB (recommended). Consider reducing quality for better performance.
        </div>
        <div v-else-if="isImage" class="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
          ✓ Image size is optimal (under 100KB).
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
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{
  initialFile?: File | null
}>()

const emit = defineEmits<{
  converted: [file: File]
}>()

const fileInput = ref<HTMLInputElement>()
const sourceFile = ref<File | null>(null)
const sourcePreviewUrl = ref('')
const sourceDimensions = ref<{ width: number; height: number } | null>(null)
const videoDuration = ref<number | null>(null)

const fitMode = ref('crop')
const quality = ref(95)
const videoMaxDuration = ref(3) // Kept for backward compatibility, but now derived from timeline
const videoFps = ref(15)
const videoStartTime = ref(0)
const videoEndTime = ref(3)

const isConverting = ref(false)
const conversionProgress = ref('Converting...')
const convertedFile = ref<File | null>(null)
const convertedPreviewUrl = ref('')
const error = ref('')

// Crop area state for images
const imageContainer = ref<HTMLDivElement>()
const sourceImage = ref<HTMLImageElement>()
const imageCropBoxX = ref(0)
const imageCropBoxY = ref(0)
const imageCropBoxSize = ref(0)
const isDraggingImageCropBox = ref(false)
const imageDragStartX = ref(0)
const imageDragStartY = ref(0)
const imagePreviewWidth = ref(500)
const imagePreviewHeight = ref(500)

// Crop area state for videos
const videoContainer = ref<HTMLDivElement>()
const cropVideoPreview = ref<HTMLVideoElement>()
const sourceInfoVideo = ref<HTMLVideoElement>()
const beforeComparisonVideo = ref<HTMLVideoElement>()
const cropBoxX = ref(0)
const cropBoxY = ref(0)
const cropBoxSize = ref(0)
const isDraggingCropBox = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const videoPreviewWidth = ref(500)
const videoPreviewHeight = ref(500)

// Before preview drag state
const beforePreviewOffsetX = ref(0)
const beforePreviewOffsetY = ref(0)
const isDraggingBeforePreview = ref(false)
const beforeDragStartX = ref(0)
const beforeDragStartY = ref(0)

// Timeline drag state
const isDraggingTimeline = ref(false)
const timelineDragHandle = ref<'start' | 'end' | null>(null)
const timelineElement = ref<HTMLElement | null>(null)


// FFmpeg instance
const ffmpeg = ref<FFmpeg | null>(null)
const ffmpegLoaded = ref(false)
const ffmpegLoadError = ref(false)
const ffmpegLoadProgress = ref(0)
const ffmpegLoadingMessage = ref('Initializing...')

// Load FFmpeg function
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

    ffmpegInstance.on('progress', ({ progress }) => {
      if (isConverting.value && isVideo.value) {
        conversionProgress.value = `Processing video... ${Math.round(progress * 100)}%`
      }
    })

    ffmpegLoadingMessage.value = 'Loading FFmpeg core...'
    ffmpegLoadProgress.value = 30

    console.log('[FFmpeg] Loading FFmpeg with default configuration...')

    ffmpegLoadProgress.value = 70
    ffmpegLoadingMessage.value = 'Initializing (may take 30s)...'

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

const retryFFmpegLoad = () => {
  console.log('[FFmpeg] Retrying load...')
  loadFFmpeg()
}

onMounted(() => {
  loadFFmpeg()
})

const isImage = computed(() => {
  return sourceFile.value?.type.startsWith('image/')
})

const isVideo = computed(() => {
  return sourceFile.value?.type.startsWith('video/')
})

const targetSize = computed(() => {
  return isVideo.value ? '350' : '400'
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

// Initialize crop box for images
const initializeImageCropBox = () => {
  if (!sourceDimensions.value) return

  const { width, height } = sourceDimensions.value
  const maxSize = 500

  // Calculate preview dimensions
  let previewWidth = width
  let previewHeight = height
  if (width > maxSize || height > maxSize) {
    const scale = Math.min(maxSize / width, maxSize / height)
    previewWidth = width * scale
    previewHeight = height * scale
  }

  imagePreviewWidth.value = previewWidth
  imagePreviewHeight.value = previewHeight

  // Initialize crop box (centered square)
  const boxSize = Math.min(previewWidth, previewHeight)
  imageCropBoxSize.value = boxSize
  imageCropBoxX.value = (previewWidth - boxSize) / 2
  imageCropBoxY.value = (previewHeight - boxSize) / 2
}

// Initialize crop box for videos
const initializeVideoCropBox = () => {
  if (!sourceDimensions.value) return

  const { width, height } = sourceDimensions.value
  const maxSize = 500

  // Calculate preview dimensions
  let previewWidth = width
  let previewHeight = height
  if (width > maxSize || height > maxSize) {
    const scale = Math.min(maxSize / width, maxSize / height)
    previewWidth = width * scale
    previewHeight = height * scale
  }

  videoPreviewWidth.value = previewWidth
  videoPreviewHeight.value = previewHeight

  // Initialize crop box (centered square)
  const boxSize = Math.min(previewWidth, previewHeight)
  cropBoxSize.value = boxSize
  cropBoxX.value = (previewWidth - boxSize) / 2
  cropBoxY.value = (previewHeight - boxSize) / 2
}

// Crop box drag handlers for images
const startDragImageCropBox = (e: MouseEvent) => {
  e.preventDefault()
  isDraggingImageCropBox.value = true
  imageDragStartX.value = e.clientX - imageCropBoxX.value
  imageDragStartY.value = e.clientY - imageCropBoxY.value
}

const updateDragImageCropBox = (e: MouseEvent) => {
  if (!isDraggingImageCropBox.value) return

  const newX = e.clientX - imageDragStartX.value
  const newY = e.clientY - imageDragStartY.value

  // Constrain to container bounds
  imageCropBoxX.value = Math.max(0, Math.min(newX, imagePreviewWidth.value - imageCropBoxSize.value))
  imageCropBoxY.value = Math.max(0, Math.min(newY, imagePreviewHeight.value - imageCropBoxSize.value))
}

const endDragImageCropBox = () => {
  isDraggingImageCropBox.value = false
}

// Crop box drag handlers for videos
const startDragCropBox = (e: MouseEvent) => {
  e.preventDefault()
  isDraggingCropBox.value = true
  dragStartX.value = e.clientX - cropBoxX.value
  dragStartY.value = e.clientY - cropBoxY.value
}

const updateDragCropBox = (e: MouseEvent) => {
  if (!isDraggingCropBox.value) return

  const newX = e.clientX - dragStartX.value
  const newY = e.clientY - dragStartY.value

  // Constrain to container bounds
  cropBoxX.value = Math.max(0, Math.min(newX, videoPreviewWidth.value - cropBoxSize.value))
  cropBoxY.value = Math.max(0, Math.min(newY, videoPreviewHeight.value - cropBoxSize.value))
}

const endDragCropBox = () => {
  isDraggingCropBox.value = false
}

// Before preview drag handlers
const startDragBeforePreview = (e: MouseEvent) => {
  e.preventDefault()
  isDraggingBeforePreview.value = true
  beforeDragStartX.value = e.clientX - beforePreviewOffsetX.value
  beforeDragStartY.value = e.clientY - beforePreviewOffsetY.value
}

const updateDragBeforePreview = (e: MouseEvent) => {
  if (!isDraggingBeforePreview.value) return

  const newX = e.clientX - beforeDragStartX.value
  const newY = e.clientY - beforeDragStartY.value

  // Allow dragging in any direction (no bounds)
  beforePreviewOffsetX.value = newX
  beforePreviewOffsetY.value = newY
}

const endDragBeforePreview = () => {
  isDraggingBeforePreview.value = false
}

// Timeline drag handlers
const startDragTimelineHandle = (handle: 'start' | 'end', e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDraggingTimeline.value = true
  timelineDragHandle.value = handle
  
  // Find timeline element
  const target = e.currentTarget as HTMLElement
  timelineElement.value = target.closest('.relative') as HTMLElement
}

const updateDragTimeline = (e: MouseEvent) => {
  if (!isDraggingTimeline.value || !timelineElement.value || !videoDuration.value) return
  
  const rect = timelineElement.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const percentage = x / rect.width
  const newTime = percentage * videoDuration.value
  
  if (timelineDragHandle.value === 'start') {
    // Ensure start time doesn't exceed end time (leave at least 0.5s gap)
    videoStartTime.value = Math.max(0, Math.min(newTime, videoEndTime.value - 0.5))
    
    // Update video preview in real-time while dragging
    if (cropVideoPreview.value) cropVideoPreview.value.currentTime = videoStartTime.value
    if (sourceInfoVideo.value) sourceInfoVideo.value.currentTime = videoStartTime.value
    if (beforeComparisonVideo.value) beforeComparisonVideo.value.currentTime = videoStartTime.value
  } else if (timelineDragHandle.value === 'end') {
    // Ensure end time doesn't go below start time (leave at least 0.5s gap)
    videoEndTime.value = Math.max(videoStartTime.value + 0.5, Math.min(newTime, videoDuration.value))
    
    // Update video preview to show end time while dragging end handle
    if (cropVideoPreview.value) cropVideoPreview.value.currentTime = videoEndTime.value
    if (sourceInfoVideo.value) sourceInfoVideo.value.currentTime = videoEndTime.value
    if (beforeComparisonVideo.value) beforeComparisonVideo.value.currentTime = videoEndTime.value
  }
  
  // Round to 2 decimal places for cleaner values
  videoStartTime.value = Math.round(videoStartTime.value * 100) / 100
  videoEndTime.value = Math.round(videoEndTime.value * 100) / 100
  
  // Update videoMaxDuration for compatibility
  videoMaxDuration.value = videoEndTime.value - videoStartTime.value
}

const endDragTimeline = () => {
  isDraggingTimeline.value = false
  timelineDragHandle.value = null
  timelineElement.value = null
  
  // After dragging ends, reset video previews to start time and resume playing
  if (cropVideoPreview.value) {
    cropVideoPreview.value.currentTime = videoStartTime.value
    cropVideoPreview.value.play().catch(() => {})
  }
  if (sourceInfoVideo.value) {
    sourceInfoVideo.value.currentTime = videoStartTime.value
    sourceInfoVideo.value.play().catch(() => {})
  }
  if (beforeComparisonVideo.value) {
    beforeComparisonVideo.value.currentTime = videoStartTime.value
    beforeComparisonVideo.value.play().catch(() => {})
  }
}

// Timeline utility methods
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(1)
  return `${mins}:${secs.padStart(4, '0')}`
}

const constrainTimeRange = () => {
  if (!videoDuration.value) return
  
  // Constrain start time
  videoStartTime.value = Math.max(0, Math.min(videoStartTime.value, videoDuration.value - 0.5))
  
  // Constrain end time
  videoEndTime.value = Math.max(videoStartTime.value + 0.5, Math.min(videoEndTime.value, videoDuration.value))
  
  // Update videoMaxDuration for compatibility
  videoMaxDuration.value = videoEndTime.value - videoStartTime.value
}

const applyDurationPreset = (duration: number) => {
  if (!videoDuration.value) return
  
  // Start from current start time, or reset to 0
  const start = videoStartTime.value
  const end = Math.min(start + duration, videoDuration.value)
  
  videoStartTime.value = start
  videoEndTime.value = end
  constrainTimeRange()
}

const resetTimeline = () => {
  if (!videoDuration.value) return
  
  videoStartTime.value = 0
  videoEndTime.value = Math.min(3, videoDuration.value)
  constrainTimeRange()
}

// Video preview time sync
const onCropVideoLoaded = () => {
  if (cropVideoPreview.value) {
    cropVideoPreview.value.currentTime = videoStartTime.value
  }
}

const updateVideoPreviewTime = () => {
  if (!isDraggingTimeline.value) {
    // Set all video previews to start time when not dragging
    if (cropVideoPreview.value) {
      cropVideoPreview.value.currentTime = videoStartTime.value
    }
    if (sourceInfoVideo.value) {
      sourceInfoVideo.value.currentTime = videoStartTime.value
    }
    if (beforeComparisonVideo.value) {
      beforeComparisonVideo.value.currentTime = videoStartTime.value
    }
  }
}

const onVideoTimeUpdate = () => {
  if (!cropVideoPreview.value) return
  
  // Loop the selected segment: if video reaches end time, jump back to start
  if (cropVideoPreview.value.currentTime >= videoEndTime.value) {
    cropVideoPreview.value.currentTime = videoStartTime.value
  } else if (cropVideoPreview.value.currentTime < videoStartTime.value) {
    // Also ensure we're not before start time
    cropVideoPreview.value.currentTime = videoStartTime.value
  }
}

// Source info video preview time sync
const onSourceInfoVideoLoaded = () => {
  if (sourceInfoVideo.value) {
    sourceInfoVideo.value.currentTime = videoStartTime.value
  }
}

const onSourceInfoVideoTimeUpdate = () => {
  if (!sourceInfoVideo.value) return
  
  // Loop the selected segment
  if (sourceInfoVideo.value.currentTime >= videoEndTime.value) {
    sourceInfoVideo.value.currentTime = videoStartTime.value
  } else if (sourceInfoVideo.value.currentTime < videoStartTime.value) {
    sourceInfoVideo.value.currentTime = videoStartTime.value
  }
}

// Before comparison video preview time sync
const onBeforeComparisonVideoLoaded = () => {
  if (beforeComparisonVideo.value) {
    beforeComparisonVideo.value.currentTime = videoStartTime.value
  }
}

const onBeforeComparisonVideoTimeUpdate = () => {
  if (!beforeComparisonVideo.value) return
  
  // Loop the selected segment
  if (beforeComparisonVideo.value.currentTime >= videoEndTime.value) {
    beforeComparisonVideo.value.currentTime = videoStartTime.value
  } else if (beforeComparisonVideo.value.currentTime < videoStartTime.value) {
    beforeComparisonVideo.value.currentTime = videoStartTime.value
  }
}

// Computed style for before preview with drag offset
const beforePreviewStyle = computed(() => {
  return {
    objectFit: 'cover' as const,
    transform: `translate(${beforePreviewOffsetX.value}px, ${beforePreviewOffsetY.value}px)`,
    cursor: 'move',
    userSelect: 'none' as const
  }
})

onMounted(() => {
  document.addEventListener('mousemove', updateDragImageCropBox)
  document.addEventListener('mouseup', endDragImageCropBox)
  document.addEventListener('mousemove', updateDragCropBox)
  document.addEventListener('mouseup', endDragCropBox)
  document.addEventListener('mousemove', updateDragBeforePreview)
  document.addEventListener('mouseup', endDragBeforePreview)
  document.addEventListener('mousemove', updateDragTimeline)
  document.addEventListener('mouseup', endDragTimeline)
})

// Load file programmatically (for initial file prop)
const loadFile = async (file: File) => {
  sourceFile.value = file
  sourcePreviewUrl.value = URL.createObjectURL(file)
  error.value = ''
  convertedFile.value = null
  convertedPreviewUrl.value = ''

  if (file.type.startsWith('image/')) {
    await loadImageDimensions(file)
  } else if (file.type.startsWith('video/')) {
    await loadVideoDimensions(file)
  }
}

const onFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  await loadFile(file)
}

const loadImageDimensions = (file: File): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      sourceDimensions.value = { width: img.width, height: img.height }
      sourceImage.value = img
      initializeImageCropBox()
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
      
      // Initialize timeline values
      videoStartTime.value = 0
      videoEndTime.value = Math.min(3, video.duration)
      videoMaxDuration.value = videoEndTime.value - videoStartTime.value
      
      initializeVideoCropBox()
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
  sourceImage.value = undefined
  beforePreviewOffsetX.value = 0
  beforePreviewOffsetY.value = 0
  
  // Reset timeline values
  videoStartTime.value = 0
  videoEndTime.value = 3
  videoMaxDuration.value = 3

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const convertToWebP = async () => {
  if (!sourceFile.value) return

  isConverting.value = true
  error.value = ''
  conversionProgress.value = 'Converting...'
  beforePreviewOffsetX.value = 0
  beforePreviewOffsetY.value = 0

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
  if (!sourceFile.value || !sourceImage.value) return

  conversionProgress.value = 'Processing image...'

  const size = parseInt(targetSize.value)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Set high-quality image smoothing for better downscaling
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  canvas.width = size
  canvas.height = size

  const img = sourceImage.value

  if (fitMode.value === 'crop') {
    // Calculate actual crop coordinates from preview
    const scaleX = img.width / imagePreviewWidth.value
    const scaleY = img.height / imagePreviewHeight.value

    const cropXActual = imageCropBoxX.value * scaleX
    const cropYActual = imageCropBoxY.value * scaleY
    const cropSizeActual = imageCropBoxSize.value * Math.min(scaleX, scaleY)

    ctx.drawImage(
      img,
      cropXActual,
      cropYActual,
      cropSizeActual,
      cropSizeActual,
      0,
      0,
      size,
      size
    )
  } else {
    let dWidth = size
    let dHeight = size
    let dx = 0
    let dy = 0

    if (img.width > img.height) {
      dHeight = (img.height * size) / img.width
      dy = (size - dHeight) / 2
    } else {
      dWidth = (img.width * size) / img.height
      dx = (size - dWidth) / 2
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 1)'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, dx, dy, dWidth, dHeight)
  }

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
    const startTime = videoStartTime.value
    const duration = videoEndTime.value - videoStartTime.value
    const fps = videoFps.value
    const inputFileName = 'input' + sourceFile.value.name.substring(sourceFile.value.name.lastIndexOf('.'))
    const outputFileName = 'output.webp'

    conversionProgress.value = 'Loading video file...'
    await ffmpeg.value.writeFile(inputFileName, await fetchFile(sourceFile.value))

    conversionProgress.value = 'Converting to animated WebP...'

    // For libwebp, higher q:v = better quality (0-100 scale)
    // Use quality value directly (0-100 range)
    const qualityValue = Math.round(quality.value)

    let videoFilter
    if (fitMode.value === 'crop' && sourceDimensions.value) {
      // Calculate crop position from the crop box
      const scaleX = sourceDimensions.value.width / videoPreviewWidth.value
      const scaleY = sourceDimensions.value.height / videoPreviewHeight.value

      const cropXActual = Math.round(cropBoxX.value * scaleX)
      const cropYActual = Math.round(cropBoxY.value * scaleY)
      const cropSizeActual = Math.round(cropBoxSize.value * Math.min(scaleX, scaleY))

      // Use lanczos for high-quality scaling
      videoFilter = `fps=${fps},crop=${cropSizeActual}:${cropSizeActual}:${cropXActual}:${cropYActual},scale=${size}:${size}:flags=lanczos`
    } else {
      // Use lanczos for high-quality scaling
      videoFilter = `fps=${fps},scale=${size}:${size}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black`
    }

    // Build FFmpeg command with start time (-ss) and duration (-t)
    const ffmpegArgs = [
      '-ss', startTime.toString(), // Seek to start time
      '-i', inputFileName,
      '-t', duration.toString(), // Duration to extract
      '-vf', videoFilter,
      '-vcodec', 'libwebp',
      '-lossless', '0',
      '-compression_level', '4',
      '-q:v', qualityValue.toString(),
      '-loop', '0',
      '-preset', 'default',
      '-an',
      '-vsync', '0',
      outputFileName
    ]

    console.log('[Video Conversion] FFmpeg command:', ffmpegArgs.join(' '))
    await ffmpeg.value.exec(ffmpegArgs)

    conversionProgress.value = 'Reading output...'

    const data = await ffmpeg.value.readFile(outputFileName)
    const blob = new Blob([data], { type: 'image/webp' })

    const fileName = sourceFile.value.name.replace(/\.[^/.]+$/, '') + '.webp'
    convertedFile.value = new File([blob], fileName, { type: 'image/webp' })
    convertedPreviewUrl.value = URL.createObjectURL(convertedFile.value)

    await ffmpeg.value.deleteFile(inputFileName)
    await ffmpeg.value.deleteFile(outputFileName)

    error.value = ''
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

// Watch for fit mode changes
watch(fitMode, () => {
  if (fitMode.value === 'crop') {
    if (sourceImage.value && isImage.value) {
      nextTick(() => {
        initializeImageCropBox()
      })
    }
    if (sourceDimensions.value && isVideo.value) {
      nextTick(() => {
        initializeVideoCropBox()
      })
    }
  }

  if (convertedFile.value) {
    convertedFile.value = null
    convertedPreviewUrl.value = ''
    beforePreviewOffsetX.value = 0
    beforePreviewOffsetY.value = 0
  }
})

// Watch for other settings changes
watch([quality, videoStartTime, videoEndTime, videoFps], () => {
  if (convertedFile.value) {
    convertedFile.value = null
    convertedPreviewUrl.value = ''
    beforePreviewOffsetX.value = 0
    beforePreviewOffsetY.value = 0
  }
})

// Watch for initialFile prop and auto-load it
watch(() => props.initialFile, async (file) => {
  if (file) {
    await loadFile(file)
  }
}, { immediate: true })

// Watch for video timeline changes and update preview
watch([videoStartTime, videoEndTime], () => {
  updateVideoPreviewTime()
})
</script>
