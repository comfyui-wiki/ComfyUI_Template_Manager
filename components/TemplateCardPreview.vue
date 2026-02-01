<template>
  <div class="space-y-4">
    <!-- Template Card Preview -->
    <div class="w-full max-w-sm mx-auto">
      <div 
        class="border rounded-lg overflow-hidden bg-card hover:bg-accent/50 transition-colors cursor-pointer shadow-sm"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
      >
      <!-- Thumbnail Section -->
      <div class="relative aspect-square overflow-hidden">
        <ThumbnailPreview
          v-if="thumbnailImages.length > 0"
          :variant="thumbnailVariant"
          :images="thumbnailImages"
          class="w-full h-full"
        />
        <div v-else class="w-full h-full bg-muted flex items-center justify-center">
          <div class="text-center text-muted-foreground">
            <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div class="text-xs">Upload thumbnail</div>
          </div>
        </div>

        <!-- Logos overlay -->
        <div
          v-for="(logo, logoIndex) in logos"
          :key="`logo-${logoIndex}`"
          :class="['absolute flex items-center gap-1 px-2 py-1 rounded-md', logo.position || 'top-2 left-2']"
          :style="{
            backgroundColor: `rgba(0, 0, 0, ${logo.opacity || 0.85})`,
          }"
        >
          <!-- Single or Stacked Provider Logos -->
          <div class="flex items-center" :style="{ gap: `${logo.gap || -6}px` }">
            <img
              v-for="(provider, providerIndex) in getProviderArray(logo)"
              :key="`provider-${providerIndex}`"
              :src="getLogoPath(provider)"
              :alt="provider"
              class="w-5 h-5 rounded-sm object-contain bg-white/10"
              :style="{
                marginLeft: providerIndex > 0 ? `${logo.gap || -6}px` : '0',
                zIndex: getProviderArray(logo).length - providerIndex
              }"
            />
          </div>
          <!-- Label -->
          <span v-if="logo.label || getProviderArray(logo).length > 0" class="text-[10px] font-medium text-white ml-1">
            {{ logo.label || getProviderArray(logo).join(' & ') }}
          </span>
        </div>

        <!-- Tags overlay (bottom right) -->
        <div v-if="tags.length > 0" class="absolute bottom-2 right-2 flex flex-wrap gap-1 max-w-[60%]">
          <span
            v-for="tag in tags.slice(0, 3)"
            :key="tag"
            class="inline-flex items-center px-2 py-1 text-xs font-medium bg-black/70 text-white rounded"
          >
            {{ tag }}
          </span>
          <span
            v-if="tags.length > 3"
            class="inline-flex items-center px-2 py-1 text-xs font-medium bg-black/70 text-white rounded"
          >
            +{{ tags.length - 3 }}
          </span>
        </div>
      </div>
      
      <!-- Content Section -->
      <div class="p-3">
        <div class="flex flex-col gap-2">
          <!-- Title -->
          <h3 class="text-sm font-medium line-clamp-1 m-0" :title="title || 'Template Title'">
            {{ title || 'Template Title' }}
          </h3>
          
          <div class="flex justify-between gap-2">
            <!-- Description -->
            <div class="flex-1">
              <p class="text-sm text-muted-foreground line-clamp-2 m-0" :title="description || 'Template description will appear here...'">
                {{ description || 'Template description will appear here...' }}
              </p>
            </div>
            
            <!-- Tutorial button (when hovered) -->
            <div v-if="tutorialUrl" class="flex flex-col-reverse justify-center">
              <button 
                v-if="isHovered"
                class="inline-flex items-center justify-center w-8 h-8 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                :title="'See Tutorial'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      
      <!-- Preview Label -->
      <div class="text-center mt-2 text-xs text-muted-foreground">
        Live Preview
      </div>
    </div>

    <!-- Technical Details -->
    <div class="space-y-3 text-sm">
      <div class="flex justify-between">
        <span class="text-muted-foreground">Filename:</span>
        <span class="font-medium truncate ml-2">{{ filename || 'Not set' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-muted-foreground">Category:</span>
        <span class="font-medium">{{ category || 'Not set' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-muted-foreground">Media:</span>
        <span class="font-medium">{{ mediaType || 'Auto' }}/{{ mediaSubtype || 'Auto' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-muted-foreground">Effect:</span>
        <span class="font-medium">{{ thumbnailVariant === 'none' || !thumbnailVariant ? 'None' : thumbnailVariant }}</span>
      </div>
      <div class="border-t pt-3 mt-3">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Workflow:</span>
          <span :class="hasWorkflow ? 'text-primary' : 'text-muted-foreground'">
            {{ hasWorkflow ? '✓ Uploaded' : 'Missing' }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Thumbnails:</span>
          <span :class="thumbnailImages.length > 0 ? 'text-primary' : 'text-muted-foreground'">
            {{ thumbnailImages.length > 0 ? `${thumbnailImages.length} files` : 'Missing' }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Tags:</span>
          <span class="font-medium">{{ tags.length || 0 }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Models:</span>
          <span class="font-medium">{{ modelCount || 0 }}</span>
        </div>
        <div v-if="comfyuiVersion" class="flex justify-between">
          <span class="text-muted-foreground">ComfyUI:</span>
          <span class="font-medium">{{ comfyuiVersion }}+</span>
        </div>
      </div>
      
      <!-- Progress Indicator -->
      <div class="border-t pt-3 mt-3">
        <div class="flex justify-between text-sm mb-2">
          <span>Completion</span>
          <span>{{ completedFields }}/{{ totalFields }}</span>
        </div>
        <div class="w-full bg-secondary rounded-full h-2">
          <div 
            class="bg-primary h-2 rounded-full transition-all duration-300 ease-out" 
            :style="{ width: `${(completedFields / totalFields) * 100}%` }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface LogoInfo {
  provider: string | string[]
  label?: string
  gap?: number
  position?: string
  opacity?: number
}

interface Props {
  title: string
  description: string
  thumbnailImages: File[]
  thumbnailVariant: string
  tags: string[]
  logos: LogoInfo[]
  logoMapping: Record<string, string>
  repoBaseUrl: string
  tutorialUrl: string
  filename: string
  category: string
  mediaType: string
  mediaSubtype: string
  hasWorkflow: boolean
  modelCount: number
  comfyuiVersion: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  thumbnailImages: () => [],
  thumbnailVariant: 'none',
  tags: () => [],
  logos: () => [],
  logoMapping: () => ({}),
  repoBaseUrl: '',
  tutorialUrl: '',
  filename: '',
  category: '',
  mediaType: '',
  mediaSubtype: '',
  hasWorkflow: false,
  modelCount: 0,
  comfyuiVersion: ''
})

const isHovered = ref(false)

// Helper functions for logos
const getProviderArray = (logo: LogoInfo): string[] => {
  if (Array.isArray(logo.provider)) {
    return logo.provider
  }
  return logo.provider ? [logo.provider] : []
}

const getLogoPath = (provider: string): string => {
  const logoPath = props.logoMapping[provider]
  if (!logoPath || !props.repoBaseUrl) return ''
  return `${props.repoBaseUrl}/${logoPath}`
}

// Calculate completion progress
const completedFields = computed(() => {
  let count = 0
  if (props.title) count++
  if (props.description) count++
  if (props.filename) count++
  if (props.category) count++
  if (props.hasWorkflow) count++
  if (props.thumbnailImages.length > 0) count++
  return count
})

const totalFields = computed(() => 6) // Required core fields
</script>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>