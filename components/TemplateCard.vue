<template>
  <Card class="w-full max-w-[260px] overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
    <!-- Thumbnail - 300x300 -->
    <div class="relative w-full aspect-square bg-muted flex-shrink-0">
      <!-- Audio Player -->
      <div v-if="template.mediaType === 'audio'" class="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
        <svg class="w-20 h-20 text-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <audio v-if="template.name" controls class="w-full">
          <source :src="audioUrl" type="audio/mpeg">
        </audio>
      </div>

      <!-- Image/Video with Thumbnail Variants -->
      <div v-else-if="template.name" class="w-full h-full relative">
        <!-- Hover Dissolve Effect -->
        <div v-if="template.thumbnailVariant === 'hoverDissolve'" class="w-full h-full relative group">
          <img
            :src="thumbnailUrl"
            :alt="template.title || template.name"
            class="w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-0"
            @error="onImageError"
          />
          <img
            :src="thumbnailUrl2"
            :alt="`${template.title || template.name} - hover`"
            class="w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            @error="onImageError"
          />
        </div>

        <!-- Compare Slider Effect -->
        <div
          v-else-if="template.thumbnailVariant === 'compareSlider'"
          class="w-full h-full relative select-none"
          ref="compareContainer"
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
        >
          <!-- After image (background) - now using image 1 -->
          <img
            :src="thumbnailUrl"
            :alt="`${template.title || template.name} - after`"
            class="w-full h-full object-cover pointer-events-none"
            draggable="false"
          />
          <!-- Before image (clipped using clip-path) - now using image 2 -->
          <img
            :src="thumbnailUrl2"
            :alt="`${template.title || template.name} - before`"
            class="w-full h-full object-cover absolute top-0 left-0 pointer-events-none"
            :style="{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }"
            draggable="false"
          />
          <!-- Slider line (no handle, just visual indicator) -->
          <div
            class="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white/30 backdrop-blur-sm z-10"
            :style="{ left: sliderPosition + '%' }"
          />
        </div>

        <!-- Default thumbnail -->
        <img
          v-else
          :src="thumbnailUrl"
          :alt="template.title || template.name"
          class="w-full h-full object-cover"
          @error="onImageError"
        />

        <!-- Error fallback -->
        <div v-if="imageError" class="w-full h-full flex items-center justify-center text-muted-foreground absolute inset-0 bg-muted">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <!-- Diff Status Badge (NEW/MODIFIED/DELETED compared to main) -->
      <div v-if="template.diffStatus === 'new'" class="absolute top-2 left-2 z-10" title="New compared to main branch">
        <span class="px-2 py-1 text-xs font-bold bg-green-500 text-white rounded shadow-lg">
          NEW vs MAIN
        </span>
      </div>
      <div v-else-if="template.diffStatus === 'modified'" class="absolute top-2 left-2 z-10" title="Modified compared to main branch">
        <span class="px-2 py-1 text-xs font-bold bg-yellow-500 text-white rounded shadow-lg">
          MODIFIED vs MAIN
        </span>
      </div>
      <div v-else-if="template.diffStatus === 'deleted'" class="absolute top-2 left-2 z-10" title="Deleted compared to main branch">
        <span class="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded shadow-lg">
          DELETED vs MAIN
        </span>
      </div>

      <!-- Logos overlay -->
      <div
        v-for="(logo, logoIndex) in template.logos"
        :key="`logo-${logoIndex}`"
        :class="['absolute flex items-center gap-1.5 px-2.5 py-1.5 rounded-full', logo.position || 'top-2 left-2']"
        :style="{
          backgroundColor: `rgba(0, 0, 0, ${logo.opacity || 0.25})`,
        }"
      >
        <!-- Single or Stacked Provider Logos -->
        <div class="flex items-center" :style="{ gap: `${logo.gap || -6}px` }">
          <img
            v-for="(provider, providerIndex) in getProviderArray(logo)"
            :key="`provider-${providerIndex}`"
            :src="getLogoPath(provider)"
            :alt="provider"
            class="w-6 h-6 rounded-full object-contain bg-white/10"
            :style="{
              marginLeft: providerIndex > 0 ? `${logo.gap || -6}px` : '0',
              zIndex: getProviderArray(logo).length - providerIndex
            }"
          />
        </div>
        <!-- Label -->
        <span v-if="logo.label || getProviderArray(logo).length > 0" class="text-xs font-medium text-white ml-0.5">
          {{ logo.label || getProviderArray(logo).join(' & ') }}
        </span>
      </div>

      <!-- Category Badge -->
      <div class="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
        <span class="px-2 py-1 text-xs font-medium bg-black/60 text-white rounded capitalize">
          {{ category || template.categoryTitle || 'Uncategorized' }}
        </span>
        <!-- PR Badge -->
        <span v-if="isInPR" class="px-2 py-1 text-xs font-bold bg-blue-500 text-white rounded shadow-lg" title="In Pull Request">
          PR
        </span>
      </div>

      <!-- Tags overlay at bottom -->
      <div v-if="template.tags?.length" class="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
        <span
          v-for="(tag, index) in template.tags.slice(0, 3)"
          :key="index"
          class="inline-flex items-center px-2 py-1 text-[10px] font-medium bg-black/50 text-white rounded backdrop-blur-sm"
          :title="tag"
        >
          {{ tag }}
        </span>
        <span
          v-if="template.tags.length > 3"
          class="inline-flex items-center px-2 py-1 text-[10px] font-medium bg-black/50 text-white rounded backdrop-blur-sm"
        >
          +{{ template.tags.length - 3 }}
        </span>
      </div>

      <!-- Tutorial URL Icon -->
      <a
        v-if="template.tutorialUrl"
        :href="template.tutorialUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 hover:scale-110 group z-10"
        :title="template.tutorialUrl"
        @click.stop
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <!-- Tooltip on hover -->
        <span class="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs bg-black/90 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none max-w-[200px] truncate">
          {{ template.tutorialUrl }}
        </span>
      </a>
    </div>

    <!-- Content -->
    <div class="flex-1 flex flex-col p-4">
      <div class="mb-3">
        <h3 class="text-sm font-semibold mb-1">{{ template.title || template.name }}</h3>
        <p class="text-xs text-muted-foreground line-clamp-2">
          {{ template.description || 'No description available' }}
        </p>
      </div>

      <!-- Models metadata (keeping this but removing tags as they're now on thumbnail) -->
      <div v-if="template.models?.length" class="space-y-1.5 mb-3">
        <!-- Models -->
        <div class="flex flex-wrap gap-1 items-start">
          <svg class="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <div class="flex-1 flex flex-wrap gap-1">
            <span
              v-for="(model, index) in template.models"
              :key="index"
              class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-800 rounded max-w-[120px] truncate"
              :title="model"
            >
              {{ model }}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-auto space-y-2">
        <!-- Read-only notice -->
        <div v-if="!canEdit" class="px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          <div class="flex items-start gap-1">
            <svg class="w-3 h-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Read-only: Switch to a branch with edit access</span>
          </div>
        </div>

        <!-- Cloud buttons - check platform availability -->
        <div v-if="!template.includeOnDistributions || template.includeOnDistributions.length === 0 || template.includeOnDistributions.includes('cloud')" class="space-y-2">
          <div class="flex gap-2">
            <Button
              size="sm"
              class="flex-1 text-xs h-9"
              @click="openInCloud"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              Open in Cloud
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-9 w-9 p-0"
              @click="copyCloudLink"
              :title="copySuccess ? 'Copied!' : 'Copy cloud link'"
            >
              <svg v-if="!copySuccess" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </Button>
          </div>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              class="flex-1 text-xs h-9"
              @click="openInLocal"
              :title="localUrlNotice"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Open in Local
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-9 w-9 p-0"
              @click="openLocalSettings"
              title="Configure local URL"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Button>
          </div>
        </div>
        <Button
          v-else
          size="sm"
          class="w-full text-xs h-9"
          disabled
        >
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Not available on cloud
        </Button>

        <!-- Edit, Download and View buttons (icon only for space) -->
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            class="flex-1 h-8 px-2"
            :disabled="!canEdit"
            :title="canEdit ? 'Edit this template' : 'Select a branch with write access to edit'"
            @click="$emit('edit', template)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Button>
          <Button variant="outline" size="sm" class="flex-1 h-8 px-2" @click="showDetailsModal = true" title="View details and download">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </Button>
          <Button variant="outline" size="sm" class="flex-1 h-8 px-2" @click="$emit('view', template)" title="View workflow on GitHub">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>
        </div>
      </div>
    </div>

    <!-- Template Details Modal -->
    <TemplateDetailsModal
      v-model:open="showDetailsModal"
      :template="template"
      :repo="repo || 'Comfy-Org/workflow_templates'"
      :branch="branch || 'main'"
    />
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMouseInElement } from '@vueuse/core'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import TemplateDetailsModal from '@/components/TemplateDetailsModal.vue'

interface LogoInfo {
  provider: string | string[]
  label?: string
  gap?: number
  position?: string
  opacity?: number
}

const props = defineProps<{
  template: any
  category?: string
  canEdit?: boolean
  repo?: string
  branch?: string
  cacheBust?: number // Optional timestamp to force fresh images
  commitSha?: string // Optional commit SHA for stronger cache busting
  prTemplates?: string[] // List of templates changed in a PR (for highlighting)
  logoMapping?: Record<string, string>
  repoBaseUrl?: string
}>()

defineEmits(['edit', 'view'])

const imageError = ref(false)
const sliderPosition = ref(50) // For compareSlider, start at 50%
const isHovered = ref(false)
const compareContainer = ref<HTMLElement | null>(null)
const showDetailsModal = ref(false)
const copySuccess = ref(false)

// Check if this template is in the PR
const isInPR = computed(() => {
  return props.prTemplates?.includes(props.template.name) || false
})

// Use VueUse to track mouse position
const { elementX, elementWidth, isOutside } = useMouseInElement(compareContainer)

const thumbnailUrl = computed(() => {
  // For deleted templates, load from main branch where they still exist
  const repo = props.template.diffStatus === 'deleted'
    ? 'Comfy-Org/workflow_templates'
    : (props.repo || 'Comfy-Org/workflow_templates')
  const branch = props.template.diffStatus === 'deleted'
    ? 'main'
    : (props.branch || 'main')
  const baseUrl = `https://raw.githubusercontent.com/${repo}/${branch}/templates`
  // Use commit SHA for stronger CDN cache busting, fallback to timestamp
  const cacheBust = props.commitSha
    ? `?sha=${props.commitSha.substring(0, 8)}`
    : props.cacheBust
      ? `?cb=${props.cacheBust}`
      : ''
  return `${baseUrl}/${props.template.name}-1.webp${cacheBust}`
})

const thumbnailUrl2 = computed(() => {
  // For deleted templates, load from main branch where they still exist
  const repo = props.template.diffStatus === 'deleted'
    ? 'Comfy-Org/workflow_templates'
    : (props.repo || 'Comfy-Org/workflow_templates')
  const branch = props.template.diffStatus === 'deleted'
    ? 'main'
    : (props.branch || 'main')
  const baseUrl = `https://raw.githubusercontent.com/${repo}/${branch}/templates`
  // Use commit SHA for stronger CDN cache busting, fallback to timestamp
  const cacheBust = props.commitSha
    ? `?sha=${props.commitSha.substring(0, 8)}`
    : props.cacheBust
      ? `?cb=${props.cacheBust}`
      : ''
  return `${baseUrl}/${props.template.name}-2.webp${cacheBust}`
})

const audioUrl = computed(() => {
  // For deleted templates, load from main branch where they still exist
  const repo = props.template.diffStatus === 'deleted'
    ? 'Comfy-Org/workflow_templates'
    : (props.repo || 'Comfy-Org/workflow_templates')
  const branch = props.template.diffStatus === 'deleted'
    ? 'main'
    : (props.branch || 'main')
  const baseUrl = `https://raw.githubusercontent.com/${repo}/${branch}/templates`
  // Use commit SHA for stronger CDN cache busting, fallback to timestamp
  const cacheBust = props.commitSha
    ? `?sha=${props.commitSha.substring(0, 8)}`
    : props.cacheBust
      ? `?cb=${props.cacheBust}`
      : ''
  return `${baseUrl}/${props.template.name}-1.mp3${cacheBust}`
})

const onImageError = () => {
  imageError.value = true
}

const openInCloud = () => {
  const cloudUrl = `https://cloud.comfy.org/?template=${props.template.name}`
  window.open(cloudUrl, '_blank')
}

const copyCloudLink = async () => {
  const cloudUrl = `https://cloud.comfy.org/?template=${props.template.name}`
  try {
    await navigator.clipboard.writeText(cloudUrl)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const localUrlNotice = computed(() => {
  const localBaseUrl = localStorage.getItem('comfyui_local_base_url')
  if (!localBaseUrl) {
    return 'Configure local URL first'
  }
  return 'Note: This template may not be available in your local instance'
})

const openInLocal = () => {
  // Get local base URL from localStorage
  const localBaseUrl = localStorage.getItem('comfyui_local_base_url')

  if (!localBaseUrl) {
    // If not set, emit event to parent to open settings
    window.dispatchEvent(new CustomEvent('open-local-settings'))
    return
  }

  // Open template in local ComfyUI directly without confirmation
  const localUrl = `${localBaseUrl}?template=${props.template.name}`
  window.open(localUrl, '_blank')
}

const openLocalSettings = () => {
  // Emit event to parent component to open settings dialog
  window.dispatchEvent(new CustomEvent('open-local-settings'))
}

// Helper functions for logos
const getProviderArray = (logo: LogoInfo): string[] => {
  if (Array.isArray(logo.provider)) {
    return logo.provider
  }
  return logo.provider ? [logo.provider] : []
}

const getLogoPath = (provider: string): string => {
  if (!props.logoMapping || !props.repoBaseUrl) return ''
  const logoPath = props.logoMapping[provider]
  if (!logoPath) return ''
  return `${props.repoBaseUrl}/${logoPath}`
}

// Update slider position based on mouse position (hover-based)
watch(
  [() => isHovered.value, elementX, elementWidth, isOutside],
  ([hovered, x, width, outside]) => {
    if (!hovered || props.template.thumbnailVariant !== 'compareSlider') return
    if (!outside && width > 0) {
      sliderPosition.value = (x / width) * 100
    }
  }
)
</script>
