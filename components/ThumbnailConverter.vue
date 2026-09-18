<template>
  <div class="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:h-full">
    <section class="min-w-0 rounded-xl bg-muted/20 p-3 lg:overflow-y-auto lg:p-5" aria-label="Thumbnail canvas">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold">Thumbnail canvas</h3>
          <p class="text-xs text-muted-foreground">
            {{ isSlideshow
              ? `Looping preview at ${slideDuration.toFixed(2)}s per still. Overlays stay on every frame.`
              : 'Preview matches the exported square. Overlays sit on top of the cropped source.' }}
          </p>
        </div>
        <span class="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{{ targetSize }} × {{ targetSize }} · WebP</span>
      </div>
      <ThumbnailOverlayEditor v-if="sourceFile && sourceDimensions" ref="overlayEditor"
        :src="canvasSourceUrl"
        :reset-key="sourceResetKey"
        :video="!!isVideo" :size="Number(targetSize)"
        :crop="overlayCrop" :start="videoStartTime" :end="videoEndTime"
        :speed="playbackSpeed" :disabled="isConverting" @change="invalidateOutput" />
      <div v-if="!sourceFile" class="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-background/60 text-muted-foreground">
        <span class="text-sm font-medium text-foreground/80">No source yet</span>
        <span class="text-xs">Choose a still, several stills for a looping cover, or a video.</span>
      </div>
    </section>
    <section class="min-w-0 space-y-4 lg:overflow-y-auto lg:pr-2" aria-label="Source and export settings">

      <!-- FFmpeg Loading Status with Progress -->
      <div v-if="!ffmpegLoaded && !useNativeLocalConverter" class="space-y-2">
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
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/quicktime"
            @change="onFileSelect"
            class="flex-1"
          />
          <Button v-if="sourceFile" variant="outline" size="sm" @click="clearFile">Clear</Button>
        </div>
        <p class="text-xs text-muted-foreground">
          One still or video, or several stills (JPG, PNG, WebP) to merge into one looping animated WebP at {{ isSlideshow ? '400×400' : 'cover size' }}.
        </p>
      </div>

      <div v-if="isSlideshow" class="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div class="flex items-center justify-between gap-2">
          <Label>Slideshow frames ({{ slideFrames.length }})</Label>
          <Button type="button" variant="outline" size="xs" @click="slideshowPlaying = !slideshowPlaying">
            {{ slideshowPlaying ? 'Pause preview' : 'Play preview' }}
          </Button>
        </div>
        <p class="text-[11px] text-muted-foreground">
          Canvas loops in play order. Click a still to pause on that frame.
        </p>
        <ul class="space-y-2">
          <li
            v-for="(frame, index) in slideFrames"
            :key="frame.url"
            class="flex items-center gap-2 rounded-md border p-1.5"
            :class="previewSlideIndex === index ? 'border-sky-500 bg-sky-500/10' : 'border-border bg-background'"
          >
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="selectSlide(index)">
              <img :src="frame.url" alt="" class="h-10 w-10 shrink-0 rounded object-cover bg-zinc-900">
              <span class="min-w-0 truncate text-xs">{{ index + 1 }}. {{ frame.file.name }}</span>
            </button>
            <div class="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="xs" :disabled="index === 0" @click="moveSlide(index, -1)">Up</Button>
              <Button type="button" variant="ghost" size="xs" :disabled="index === slideFrames.length - 1" @click="moveSlide(index, 1)">Down</Button>
              <Button type="button" variant="ghost" size="xs" class="text-destructive" :disabled="slideFrames.length <= 2" @click="removeSlide(index)">Remove</Button>
            </div>
          </li>
        </ul>
        <p class="text-[11px] text-muted-foreground">Play order top to bottom. Each still is cropped or padded to 400×400.</p>
      </div>

      <!-- Crop Preview for Images -->
      <div v-if="sourceFile && isImage && !isSlideshow && fitMode === 'crop'" class="space-y-2">
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
      <div v-if="sourceFile && fitMode !== 'crop' && !isSlideshow" class="space-y-2">
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
            <div><strong>Size:</strong> {{ formatFileSize(sourceFile?.size || 0) }}</div>
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
            {{ isVideo ? '350x350 (Video)' : '400x400 (Image / slideshow)' }}
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
            {{ fitMode === 'crop'
              ? (isSlideshow ? 'Center-crop every still to fill the square' : 'Crop to fill the square - drag above to adjust')
              : 'Fit within square with black bars' }}
          </p>
        </div>

        <div v-if="isSlideshow" class="space-y-2">
          <Label>Time per still ({{ slideDuration.toFixed(2) }}s)</Label>
          <input type="range" v-model.number="slideDuration" min="0.15" max="3" step="0.05" class="w-full accent-sky-600" />
          <p class="text-xs text-muted-foreground">
            Loop length {{ (slideFrames.length * slideDuration).toFixed(1) }}s at {{ frameRateFromDuration(slideDuration) }} fps.
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
                Source: {{ formatTime(videoEndTime - videoStartTime) }}
                <span v-if="playbackSpeed > 1.001"> → Output: {{ formatTime(outputDuration) }} ({{ playbackSpeedLabel }})</span>
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
            <span class="text-muted-foreground">Trim to:</span>
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
            Drag the green and red handles to select the source segment. Trim cuts the clip. Speed below compresses it.
          </p>
          
          <!-- Duration warning -->
          <div v-if="outputDuration > 5" class="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            Output duration exceeds 5 seconds. Speed up or trim it to reduce file size.
          </div>
        </div>

        <!-- Playback speed for video -->
        <div v-if="isVideo && videoDuration" class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Playback Speed ({{ playbackSpeedLabel }})</Label>
            <span class="text-xs font-semibold text-blue-600">Output {{ outputDuration.toFixed(1) }}s</span>
          </div>
          <input
            type="range"
            v-model.number="videoSpeed"
            :min="1"
            :max="16"
            step="0.1"
            class="w-full"
          />
          <div class="flex items-center gap-2 text-xs flex-wrap">
            <span class="text-muted-foreground">Speed:</span>
            <Button
              v-for="preset in [1, 1.5, 2, 3]"
              :key="preset"
              variant="outline"
              size="sm"
              class="h-6 px-2 text-xs"
              :class="Math.abs(playbackSpeed - preset) < 0.05 ? 'border-blue-500 bg-blue-50 text-blue-700' : ''"
              @click="videoSpeed = preset"
            >
              {{ preset }}x
            </Button>
            <span class="text-muted-foreground ml-1">Fit into:</span>
            <Button
              variant="outline"
              size="sm"
              class="h-6 px-2 text-xs"
              :class="isFitTarget(1) ? 'border-blue-500 bg-blue-50 text-blue-700' : ''"
              @click="fitIntoDuration(1)"
            >
              1s
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-6 px-2 text-xs"
              :class="isFitTarget(3) ? 'border-blue-500 bg-blue-50 text-blue-700' : ''"
              @click="fitIntoDuration(3)"
            >
              3s
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            1x is original speed. Fit into 1s or 3s speeds the selected segment so the cover plays in that length.
          </p>
        </div>

        <!-- FPS for video -->
        <div v-if="isVideo" class="space-y-2">
          <Label>Frame Rate ({{ videoFps }} fps)</Label>
          <input type="range" v-model.number="videoFps" min="10" max="30" step="5" class="w-full" />
          <p class="text-xs text-muted-foreground">Lower FPS = smaller file. 15 fps recommended</p>
        </div>

        <div v-if="isVideo || isSlideshow" class="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          {{ isSlideshow
            ? 'Stills will be merged into one looping animated WebP (same cover format as video covers).'
            : 'Video will be converted to looping animated WebP.' }}
        </div>
      </div>

      <!-- Convert Button -->
      <div v-if="sourceFile">
      <Button @click="convertToWebP" :disabled="isConverting || ((isVideo || isSlideshow) && !ffmpegLoaded && !useNativeLocalConverter)" class="w-full">
          <svg v-if="isConverting" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ convertButtonLabel }}
        </Button>
      </div>

      <!-- Before/After Comparison -->
      <div v-if="convertedFile" class="space-y-2">
        <Label>Before/After Comparison - 250x250 preview</Label>
        <div class="flex flex-col gap-4">
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
              Original: {{ formatFileSize(sourceFile?.size || 0) }}<br>
              <span class="text-[10px] text-gray-500">Drag to adjust position</span>
            </div>
          </div>

          <!-- After (Converted) -->
          <div class="flex-1 space-y-2">
            <div class="text-xs font-medium text-center">After (WebP{{ isSlideshow || isVideo ? ', looping' : '' }})</div>
            <div class="relative rounded overflow-hidden border border-border" style="width: 250px; height: 250px; background: black;">
              <img :key="convertedPreviewUrl" :src="convertedPreviewUrl" alt="After" class="w-full h-full object-cover" />
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
        <div v-if="(isVideo || isSlideshow) && convertedFile.size > 4 * 1024 * 1024" class="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          Cover size exceeds 4MB. Lower quality or use fewer / shorter stills.
        </div>
        <div v-else-if="(isVideo || isSlideshow) && convertedFile.size > 1 * 1024 * 1024" class="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          Cover is over 1MB (recommended). Consider lower quality or shorter hold time.
        </div>
        <div v-else-if="isVideo || isSlideshow" class="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
          Animated cover size is under 1MB.
        </div>

        <div v-if="isImage && !isSlideshow && convertedFile.size > 200 * 1024" class="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          Image size exceeds 200KB. Please reduce quality.
        </div>
        <div v-else-if="isImage && !isSlideshow && convertedFile.size > 100 * 1024" class="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          Image size exceeds 100KB (recommended).
        </div>
        <div v-else-if="isImage && !isSlideshow" class="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
          Image size is under 100KB.
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
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import ThumbnailOverlayEditor from './ThumbnailOverlayEditor.vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  clampPlaybackSpeed,
  outputDurationSeconds,
  speedToFitDuration,
  withPlaybackSpeedFilter
} from '~/lib/webp-playback-speed'
import {
  SLIDESHOW_MAX_FRAMES,
  SLIDESHOW_MIN_FRAMES,
  SLIDESHOW_SIZE,
  clampFrameDuration,
  frameRateFromDuration,
  sequenceFrameName,
  slideshowFfmpegArgs,
  stillDrawParams,
  stillOverlayCrop,
} from '~/lib/thumbnail-slideshow'

const props = defineProps<{
  initialFile?: File | null
}>()

const emit = defineEmits<{
  converted: [file: File]
}>()

const overlayEditor = ref<InstanceType<typeof ThumbnailOverlayEditor>>()
const invalidateOutput = () => {
  if (convertedPreviewUrl.value) URL.revokeObjectURL(convertedPreviewUrl.value)
  convertedFile.value = null
  convertedPreviewUrl.value = ''
}
const overlayCrop = computed(() => {
  if (fitMode.value !== 'crop') return null
  if (slideFrames.value.length >= 2) {
    const frame = slideFrames.value[previewSlideIndex.value] || slideFrames.value[0]
    return stillOverlayCrop(frame.width, frame.height)
  }
  return isVideo.value
    ? { x: cropBoxX.value / videoPreviewWidth.value, y: cropBoxY.value / videoPreviewHeight.value, size: cropBoxSize.value / videoPreviewWidth.value }
    : { x: imageCropBoxX.value / imagePreviewWidth.value, y: imageCropBoxY.value / imagePreviewHeight.value, size: imageCropBoxSize.value / imagePreviewWidth.value }
})
const fileInput = ref<HTMLInputElement>()
const sourceFile = ref<File | null>(null)
const sourcePreviewUrl = ref('')
const sourceDimensions = ref<{ width: number; height: number } | null>(null)
const videoDuration = ref<number | null>(null)
const sourceResetKey = ref(0)
type SlideFrame = { file: File; url: string; width: number; height: number }
const slideFrames = ref<SlideFrame[]>([])
const selectedSlideIndex = ref(0)
const playbackIndex = ref(0)
const slideshowPlaying = ref(true)
const slideDuration = ref(0.5)
let slideshowTimer: ReturnType<typeof setInterval> | null = null

const fitMode = ref('crop')
const quality = ref(95)
const videoMaxDuration = ref(3) // Kept for backward compatibility, but now derived from timeline
const videoFps = ref(15)
const videoStartTime = ref(0)
const videoEndTime = ref(3)
const videoSpeed = ref(1)

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
const runtimeConfig = useRuntimeConfig()
const useNativeLocalConverter = computed(() => runtimeConfig.public.workflowTemplatesMode === 'local')

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
      if (isConverting.value && (isVideo.value || slideFrames.value.length >= 2)) {
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
  if (!useNativeLocalConverter.value) loadFFmpeg()
})

const isSlideshow = computed(() => slideFrames.value.length >= SLIDESHOW_MIN_FRAMES)

const previewSlideIndex = computed(() => {
  if (!isSlideshow.value) return 0
  return slideshowPlaying.value ? playbackIndex.value : selectedSlideIndex.value
})

const stopSlideshowPreview = () => {
  if (slideshowTimer) {
    clearInterval(slideshowTimer)
    slideshowTimer = null
  }
}

const startSlideshowPreview = () => {
  stopSlideshowPreview()
  if (!isSlideshow.value || !slideshowPlaying.value || isConverting.value) return
  const ms = Math.round(clampFrameDuration(slideDuration.value) * 1000)
  slideshowTimer = setInterval(() => {
    const count = slideFrames.value.length
    if (count < SLIDESHOW_MIN_FRAMES) return
    playbackIndex.value = (playbackIndex.value + 1) % count
  }, ms)
}

const canvasSourceUrl = computed(() => {
  if (isSlideshow.value) {
    return slideFrames.value[previewSlideIndex.value]?.url || sourcePreviewUrl.value
  }
  return sourcePreviewUrl.value
})

const convertButtonLabel = computed(() => {
  if (isConverting.value) return conversionProgress.value
  if ((isVideo.value || isSlideshow.value) && !ffmpegLoaded.value && !useNativeLocalConverter.value) {
    return 'Loading converter...'
  }
  return isSlideshow.value || isVideo.value ? 'Convert to animated WebP' : 'Convert to WebP'
})

const isImage = computed(() => {
  return !!sourceFile.value?.type.startsWith('image/')
})

const isVideo = computed(() => {
  return !!sourceFile.value?.type.startsWith('video/')
})

const playbackSpeed = computed(() => clampPlaybackSpeed(Number(videoSpeed.value) || 1))

const playbackSpeedLabel = computed(() => {
  const speed = playbackSpeed.value
  return Number.isInteger(speed) ? `${speed}x` : `${speed.toFixed(1)}x`
})

const selectedSegmentDuration = computed(() => Math.max(0.05, videoEndTime.value - videoStartTime.value))

const outputDuration = computed(() => outputDurationSeconds(selectedSegmentDuration.value, playbackSpeed.value))

const isFitTarget = (seconds: number) => Math.abs(outputDuration.value - seconds) < 0.15

const targetSize = computed(() => {
  return isVideo.value ? '350' : '400'
})

const compressionRatio = computed(() => {
  if (!convertedFile.value) return 0
  const original = isSlideshow.value
    ? slideFrames.value.reduce((sum, frame) => sum + frame.file.size, 0)
    : (sourceFile.value?.size || 0)
  if (!original) return 0
  return ((original - convertedFile.value.size) / original) * 100
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
  const maxSize = 280

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
  const maxSize = 280

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
    applyPreviewPlaybackRate()
    cropVideoPreview.value.play().catch(() => {})
  }
  if (sourceInfoVideo.value) {
    sourceInfoVideo.value.currentTime = videoStartTime.value
    applyPreviewPlaybackRate()
    sourceInfoVideo.value.play().catch(() => {})
  }
  if (beforeComparisonVideo.value) {
    beforeComparisonVideo.value.currentTime = videoStartTime.value
    applyPreviewPlaybackRate()
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
  videoSpeed.value = 1
  constrainTimeRange()
}

const fitIntoDuration = (targetSeconds: number) => {
  videoSpeed.value = speedToFitDuration(selectedSegmentDuration.value, targetSeconds)
}

const applyPreviewPlaybackRate = () => {
  const rate = playbackSpeed.value
  for (const el of [cropVideoPreview.value, sourceInfoVideo.value, beforeComparisonVideo.value]) {
    if (el) el.playbackRate = rate
  }
}

// Video preview time sync
const onCropVideoLoaded = () => {
  if (cropVideoPreview.value) {
    cropVideoPreview.value.currentTime = videoStartTime.value
    applyPreviewPlaybackRate()
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
    applyPreviewPlaybackRate()
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
    applyPreviewPlaybackRate()
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

onBeforeUnmount(() => {
  stopSlideshowPreview()
  document.removeEventListener('mousemove', updateDragImageCropBox)
  document.removeEventListener('mouseup', endDragImageCropBox)
  document.removeEventListener('mousemove', updateDragCropBox)
  document.removeEventListener('mouseup', endDragCropBox)
  document.removeEventListener('mousemove', updateDragBeforePreview)
  document.removeEventListener('mouseup', endDragBeforePreview)
  document.removeEventListener('mousemove', updateDragTimeline)
  document.removeEventListener('mouseup', endDragTimeline)
  if (sourcePreviewUrl.value) URL.revokeObjectURL(sourcePreviewUrl.value)
  invalidateOutput()
})

// Load file programmatically (for initial file prop)
const loadFile = async (file: File) => {
  clearSlides()
  if (sourcePreviewUrl.value) URL.revokeObjectURL(sourcePreviewUrl.value)
  invalidateOutput()
  sourceFile.value = file
  sourcePreviewUrl.value = URL.createObjectURL(file)
  sourceResetKey.value += 1
  error.value = ''
  convertedFile.value = null
  convertedPreviewUrl.value = ''

  if (file.type.startsWith('image/')) {
    await loadImageDimensions(file)
  } else if (file.type.startsWith('video/')) {
    await loadVideoDimensions(file)
  }
}

const decodeImageFile = (file: File): Promise<SlideFrame> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ file, url, width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not read ${file.name}`))
    }
    img.src = url
  })
}

const clearSlides = () => {
  slideFrames.value.forEach(frame => URL.revokeObjectURL(frame.url))
  slideFrames.value = []
  selectedSlideIndex.value = 0
}

const applySlideSelection = async (index: number) => {
  const frame = slideFrames.value[index]
  if (!frame) return
  selectedSlideIndex.value = index
  sourceFile.value = frame.file
  sourcePreviewUrl.value = frame.url
  sourceDimensions.value = { width: frame.width, height: frame.height }
  await loadImageDimensions(frame.file, frame.url)
}

const loadSlideshow = async (files: File[]) => {
  if (files.length > SLIDESHOW_MAX_FRAMES) {
    throw new Error(`Use at most ${SLIDESHOW_MAX_FRAMES} stills`)
  }
  if (sourcePreviewUrl.value) URL.revokeObjectURL(sourcePreviewUrl.value)
  sourcePreviewUrl.value = ''
  clearSlides()
  invalidateOutput()
  error.value = ''
  const frames: SlideFrame[] = []
  for (const file of files) {
    frames.push(await decodeImageFile(file))
  }
  slideFrames.value = frames
  sourceResetKey.value += 1
  slideshowPlaying.value = true
  playbackIndex.value = 0
  await applySlideSelection(0)
}

const selectSlide = async (index: number) => {
  slideshowPlaying.value = false
  playbackIndex.value = index
  await applySlideSelection(index)
}

const moveSlide = async (index: number, delta: number) => {
  const next = index + delta
  if (next < 0 || next >= slideFrames.value.length) return
  const copy = [...slideFrames.value]
  const [item] = copy.splice(index, 1)
  copy.splice(next, 0, item)
  slideFrames.value = copy
  await applySlideSelection(next)
  invalidateOutput()
}

const removeSlide = async (index: number) => {
  if (slideFrames.value.length <= SLIDESHOW_MIN_FRAMES) return
  const copy = [...slideFrames.value]
  const [removed] = copy.splice(index, 1)
  URL.revokeObjectURL(removed.url)
  slideFrames.value = copy
  await applySlideSelection(Math.min(index, copy.length - 1))
  invalidateOutput()
}

const onFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = ''
  if (!files.length) return

  const images = files.filter(file => file.type.startsWith('image/'))
  const videos = files.filter(file => file.type.startsWith('video/'))
  error.value = ''

  try {
    if (videos.length && images.length) {
      throw new Error('Pick either stills or one video, not both')
    }
    if (videos.length > 1) {
      throw new Error('Use a single video file')
    }
    if (videos.length === 1) {
      await loadFile(videos[0])
      return
    }
    if (images.length >= SLIDESHOW_MIN_FRAMES) {
      await loadSlideshow(images)
      return
    }
    if (images.length === 1) {
      await loadFile(images[0])
    }
  } catch (err: any) {
    error.value = err.message || 'Could not load files'
  }
}

const loadImageDimensions = (file: File, previewUrl?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      sourceDimensions.value = { width: img.width, height: img.height }
      sourceImage.value = img
      initializeImageCropBox()
      resolve()
    }
    img.onerror = () => reject(new Error(`Could not read ${file.name}`))
    img.src = previewUrl || URL.createObjectURL(file)
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
      videoSpeed.value = 1
      
      initializeVideoCropBox()
      resolve()
    }
    video.src = URL.createObjectURL(file)
  })
}

const clearFile = () => {
  if (sourcePreviewUrl.value && !slideFrames.value.some(frame => frame.url === sourcePreviewUrl.value)) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
  clearSlides()
  invalidateOutput()
  sourceFile.value = null
  sourcePreviewUrl.value = ''
  sourceDimensions.value = null
  videoDuration.value = null
  convertedFile.value = null
  convertedPreviewUrl.value = ''
  error.value = ''
  sourceImage.value = undefined
  sourceResetKey.value += 1
  beforePreviewOffsetX.value = 0
  beforePreviewOffsetY.value = 0
  
  // Reset timeline values
  videoStartTime.value = 0
  videoEndTime.value = 3
  videoMaxDuration.value = 3
  videoSpeed.value = 1

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const convertToWebP = async () => {
  if (!sourceFile.value && !isSlideshow.value) return

  isConverting.value = true
  error.value = ''
  conversionProgress.value = 'Converting...'
  beforePreviewOffsetX.value = 0
  beforePreviewOffsetY.value = 0

  try {
    if (isSlideshow.value) {
      await convertSlideshowToWebP()
    } else if (isImage.value) {
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

const rasterizeSlide = async (frame: SlideFrame, size: number) => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not decode ${frame.file.name}`))
    image.src = frame.url
  })
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, size, size)
  const draw = stillDrawParams(img.naturalWidth, img.naturalHeight, size, fitMode.value === 'pad' ? 'pad' : 'crop')
  ctx.drawImage(img, draw.sx, draw.sy, draw.sw, draw.sh, draw.dx, draw.dy, draw.dw, draw.dh)
  overlayEditor.value?.drawOverlays(ctx, size)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Failed to rasterize still')), 'image/png')
  })
}

const convertSlideshowToWebP = async () => {
  if (slideFrames.value.length < SLIDESHOW_MIN_FRAMES) return
  const size = SLIDESHOW_SIZE
  const duration = clampFrameDuration(slideDuration.value)
  const fps = frameRateFromDuration(duration)
  const qualityValue = Math.round(quality.value)
  conversionProgress.value = 'Preparing stills...'
  const pngs: Blob[] = []
  for (const [index, frame] of slideFrames.value.entries()) {
    conversionProgress.value = `Rendering still ${index + 1}/${slideFrames.value.length}...`
    pngs.push(await rasterizeSlide(frame, size))
  }

  if (useNativeLocalConverter.value) {
    const formData = new FormData()
    pngs.forEach((png, index) => formData.append('frame', png, sequenceFrameName(index)))
    formData.append('duration', String(duration))
    formData.append('quality', String(qualityValue))
    conversionProgress.value = 'Encoding animated WebP...'
    const response = await fetch('/api/local/convert-webp-sequence', { method: 'POST', body: formData })
    if (!response.ok) throw new Error(await response.text() || 'Native slideshow conversion failed')
    const blob = await response.blob()
    const fileName = slideFrames.value[0].file.name.replace(/\.[^/.]+$/, '') + '.webp'
    convertedFile.value = new File([blob], fileName, { type: 'image/webp' })
    convertedPreviewUrl.value = URL.createObjectURL(convertedFile.value)
    return
  }

  if (!ffmpeg.value) {
    throw new Error('FFmpeg not loaded. Please refresh the page.')
  }

  conversionProgress.value = 'Encoding animated WebP...'
  const outputFileName = 'output.webp'
  for (const [index, png] of pngs.entries()) {
    const name = sequenceFrameName(index)
    await ffmpeg.value.writeFile(name, new Uint8Array(await png.arrayBuffer()))
  }
  const args = slideshowFfmpegArgs({ fps, quality: qualityValue, outputFileName })
  const exitCode = await ffmpeg.value.exec(args)
  if (exitCode !== 0) throw new Error('FFmpeg slideshow conversion failed')
  const data = await ffmpeg.value.readFile(outputFileName)
  if (typeof data === 'string') throw new Error('Unexpected FFmpeg output')
  const blob = new Blob([new Uint8Array(data)], { type: 'image/webp' })
  const fileName = slideFrames.value[0].file.name.replace(/\.[^/.]+$/, '') + '.webp'
  convertedFile.value = new File([blob], fileName, { type: 'image/webp' })
  convertedPreviewUrl.value = URL.createObjectURL(convertedFile.value)
  await ffmpeg.value.deleteFile(outputFileName)
  for (let index = 0; index < pngs.length; index++) {
    await ffmpeg.value.deleteFile(sequenceFrameName(index)).catch(() => undefined)
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

  overlayEditor.value?.drawOverlays(ctx, size)

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
  const overlayPng = await overlayEditor.value?.exportPng()
  if (useNativeLocalConverter.value && sourceFile.value) {
    const formData = new FormData()
    formData.append('file', sourceFile.value)
    if (overlayPng) formData.append('overlay', overlayPng, 'overlay.png')
    formData.append('start', String(videoStartTime.value))
    formData.append('end', String(videoEndTime.value))
    formData.append('size', targetSize.value)
    formData.append('fps', String(videoFps.value))
    formData.append('quality', String(quality.value))
    formData.append('fitMode', fitMode.value)
    formData.append('speed', String(playbackSpeed.value))
    if (fitMode.value === 'crop' && sourceDimensions.value) {
      const scaleX = sourceDimensions.value.width / videoPreviewWidth.value
      const scaleY = sourceDimensions.value.height / videoPreviewHeight.value
      formData.append('cropX', String(Math.round(cropBoxX.value * scaleX)))
      formData.append('cropY', String(Math.round(cropBoxY.value * scaleY)))
      formData.append('cropSize', String(Math.round(cropBoxSize.value * Math.min(scaleX, scaleY))))
    }
    conversionProgress.value = 'Converting with native FFmpeg...'
    const response = await fetch('/api/local/convert-webp', { method: 'POST', body: formData })
    if (!response.ok) throw new Error(await response.text() || 'Native FFmpeg conversion failed')
    const blob = await response.blob()
    const fileName = sourceFile.value.name.replace(/\.[^/.]+$/, '') + '.webp'
    convertedFile.value = new File([blob], fileName, { type: 'image/webp' })
    convertedPreviewUrl.value = URL.createObjectURL(convertedFile.value)
    return
  }
  if (!sourceFile.value || !ffmpeg.value) {
    error.value = 'FFmpeg not loaded. Please refresh the page.'
    return
  }

  conversionProgress.value = 'Preparing video...'

  try {
    const size = parseInt(targetSize.value)
    const startTime = videoStartTime.value
    const sourceDuration = selectedSegmentDuration.value
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
    videoFilter = withPlaybackSpeedFilter(videoFilter, playbackSpeed.value)

    if (overlayPng) await ffmpeg.value.writeFile('overlay.png', new Uint8Array(await overlayPng.arrayBuffer()))

    // Seek to start, take the selected source segment, then speed it up in -vf
    const ffmpegArgs = [
      '-ss', startTime.toString(),
      '-t', sourceDuration.toString(),
      '-i', inputFileName,
      ...(overlayPng ? ['-i', 'overlay.png', '-filter_complex', `[0:v]${videoFilter}[base];[base][1:v]overlay=0:0:format=auto[out]`, '-map', '[out]'] : ['-vf', videoFilter]),
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
    const exitCode = await ffmpeg.value.exec(ffmpegArgs)
    if (exitCode !== 0) throw new Error('FFmpeg conversion failed')

    conversionProgress.value = 'Reading output...'

    const data = await ffmpeg.value.readFile(outputFileName)
    if (typeof data === 'string') throw new Error('Unexpected FFmpeg output')
    const blob = new Blob([new Uint8Array(data)], { type: 'image/webp' })

    const fileName = sourceFile.value.name.replace(/\.[^/.]+$/, '') + '.webp'
    convertedFile.value = new File([blob], fileName, { type: 'image/webp' })
    convertedPreviewUrl.value = URL.createObjectURL(convertedFile.value)

    await ffmpeg.value.deleteFile(inputFileName)
    await ffmpeg.value.deleteFile(outputFileName)
    if (overlayPng) await ffmpeg.value.deleteFile('overlay.png')

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
watch([targetSize, imageCropBoxX, imageCropBoxY, cropBoxX, cropBoxY], invalidateOutput)

watch([quality, videoStartTime, videoEndTime, videoFps, videoSpeed, slideDuration], () => {
  if (convertedFile.value) {
    convertedFile.value = null
    convertedPreviewUrl.value = ''
    beforePreviewOffsetX.value = 0
    beforePreviewOffsetY.value = 0
  }
})

watch([isSlideshow, slideshowPlaying, slideDuration, isConverting, () => slideFrames.value.length], startSlideshowPreview)

watch(playbackSpeed, () => {
  nextTick(() => applyPreviewPlaybackRate())
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
