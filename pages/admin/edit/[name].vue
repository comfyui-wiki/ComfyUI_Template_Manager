<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <div class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="container mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <Button variant="ghost" size="sm" @click="navigateTo('/')" class="flex items-center space-x-2">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </Button>
            <div class="h-6 w-px bg-border"></div>
            <div>
              <h1 class="text-2xl font-semibold tracking-tight">Edit Template</h1>
              <p class="text-sm text-muted-foreground">{{ templateName }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p class="text-muted-foreground">Loading template...</p>
      </div>

      <!-- Error State -->
      <Card v-else-if="error" class="border-red-200 max-w-2xl mx-auto">
        <CardContent class="pt-6">
          <div class="text-center">
            <svg class="mx-auto w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 class="text-lg font-medium mb-2">Error Loading Template</h3>
            <p class="text-muted-foreground mb-4">{{ error }}</p>
            <Button @click="navigateTo('/')">Back to Templates</Button>
          </div>
        </CardContent>
      </Card>

      <!-- Edit Form -->
      <div v-else class="max-w-7xl mx-auto">
        <!-- Workflow File Section - Compact -->
        <div class="mb-6 p-4 border-2 border-primary/20 rounded-lg bg-card flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div class="font-semibold text-sm">Workflow File</div>
              <div class="font-mono text-xs text-muted-foreground">{{ templateName }}.json</div>
            </div>
          </div>
          <div class="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              @click="downloadWorkflow"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              @click="triggerWorkflowUpload"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Re-upload
            </Button>
          </div>
          <input
            ref="workflowFileInput"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleWorkflowReupload"
          />
        </div>

        <!-- Status Message for workflow -->
        <div v-if="workflowReuploadStatus"
             class="mb-6 p-3 rounded-lg text-sm"
             :class="workflowReuploadStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
          {{ workflowReuploadStatus.message }}
        </div>

        <div class="grid gap-8 lg:grid-cols-3">
          <!-- Form Section -->
          <div class="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Template Details</CardTitle>
                <CardDescription>
                  Edit the template information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form @submit.prevent="handleSubmit" class="space-y-6">
                  <!-- Thumbnail Files Management - TOP PRIORITY -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <Label class="text-base font-semibold">Thumbnail Files</Label>
                      <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {{ requiredThumbnailCount }} file(s)
                      </span>
                    </div>

                    <!-- Status Message -->
                    <div v-if="thumbnailReuploadStatus"
                         class="p-2 rounded-lg text-sm"
                         :class="thumbnailReuploadStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
                      {{ thumbnailReuploadStatus.message }}
                    </div>

                    <!-- Thumbnail Items - Grid Layout -->
                    <div class="grid gap-2" :class="requiredThumbnailCount === 2 ? 'grid-cols-2' : 'grid-cols-1'">
                      <div v-for="index in requiredThumbnailCount" :key="index" class="border rounded p-2 bg-card hover:border-primary/30 transition-colors">
                        <div class="flex gap-2">
                          <!-- Thumbnail Preview - 64px Small -->
                          <div class="flex-shrink-0">
                            <div class="border rounded overflow-hidden bg-muted/30 flex items-center justify-center" style="width: 64px; height: 64px; min-width: 64px; min-height: 64px; max-width: 64px; max-height: 64px;">
                              <img
                                v-if="getThumbnailPreview(index)"
                                :src="getThumbnailPreview(index)"
                                :alt="getThumbnailLabel(index)"
                                class="w-full h-full object-cover"
                                style="width: 64px; height: 64px;"
                              />
                              <div v-else class="text-center text-muted-foreground">
                                <svg class="w-6 h-6 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          <!-- Info & Actions -->
                          <div class="flex-grow min-w-0 flex flex-col">
                            <!-- Info -->
                            <div class="mb-1">
                              <div class="text-xs font-semibold truncate">{{ getThumbnailLabel(index) }}</div>
                              <div class="text-[10px] font-mono text-muted-foreground truncate">
                                {{ templateName }}-{{ index }}.{{ originalTemplate?.mediaSubtype || 'webp' }}
                              </div>
                            </div>

                            <!-- File Size & Dimensions -->
                            <div v-if="getThumbnailFileInfo(index)" class="text-[10px] text-muted-foreground mb-1 space-y-0.5">
                              <div>📄 {{ getThumbnailFileInfo(index)?.size }}</div>
                              <div v-if="getThumbnailFileInfo(index)?.dimensions">📐 {{ getThumbnailFileInfo(index)?.dimensions }}</div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex gap-1 mt-auto">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                @click="downloadThumbnail(index)"
                                class="flex-1 h-6 text-[10px] px-2"
                              >
                                ⬇ Down
                              </Button>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                @click="triggerThumbnailUpload(index)"
                                class="flex-1 h-6 text-[10px] px-2"
                              >
                                ⬆ Upload
                              </Button>
                            </div>
                          </div>
                        </div>

                        <input
                          :ref="el => thumbnailFileInputs[index - 1] = el"
                          type="file"
                          accept="image/*,video/*,audio/*"
                          class="hidden"
                          @change="(e) => handleThumbnailReupload(e, index)"
                        />
                      </div>
                    </div>

                    <!-- Thumbnail Effect - Moved here under Thumbnail Files -->
                    <div class="space-y-2 pt-2 border-t">
                      <Label for="thumbnailVariant">Thumbnail Effect</Label>
                      <Select v-model="form.thumbnailVariant">
                        <SelectTrigger>
                          <SelectValue placeholder="No special effect" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (default)</SelectItem>
                          <SelectItem value="hoverDissolve">Hover Dissolve (2 images)</SelectItem>
                          <SelectItem value="compareSlider">Compare Slider (2 images)</SelectItem>
                          <SelectItem value="zoomHover">Zoom Hover</SelectItem>
                        </SelectContent>
                      </Select>
                      <p class="text-xs text-muted-foreground">
                        Current: {{ requiredThumbnailCount }} thumbnail(s) required
                      </p>
                    </div>

                    <div class="text-xs text-muted-foreground text-center py-2 bg-muted/30 rounded border">
                      💡 Edit & Convert features coming soon
                    </div>
                  </div>

                  <!-- Display Title -->
                  <div class="space-y-2">
                    <Label for="title">Display Title</Label>
                    <Input
                      id="title"
                      v-model="form.title"
                      placeholder="Text to Image Basic"
                      required
                    />
                  </div>

                  <!-- Description -->
                  <div class="space-y-2">
                    <Label for="description">Description</Label>
                    <Textarea
                      id="description"
                      v-model="form.description"
                      placeholder="Generate images from text prompts..."
                      required
                      class="min-h-[80px] resize-y"
                    />
                  </div>

                  <!-- Category -->
                  <div class="space-y-2">
                    <Label for="category">Category</Label>
                    <Select v-model="form.category">
                      <SelectTrigger>
                        <SelectValue>
                          {{ form.category || 'Select a category' }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="cat in availableCategories"
                          :key="cat.title"
                          :value="cat.title"
                        >
                          {{ cat.title }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p class="text-xs text-muted-foreground">
                      Current: {{ form.category || 'Not set' }}
                    </p>
                  </div>

                  <!-- Date -->
                  <div class="space-y-2">
                    <Label for="date">Date (optional)</Label>
                    <Input
                      id="date"
                      v-model="form.date"
                      type="date"
                      placeholder="YYYY-MM-DD"
                    />
                    <p class="text-xs text-muted-foreground">
                      When this template was created or last updated
                    </p>
                  </div>

                  <!-- Tags Multi-Select -->
                  <div class="space-y-2">
                    <Label for="tags">Tags (optional)</Label>

                    <!-- Selected Tags Display -->
                    <div v-if="form.tags.length > 0" class="flex flex-wrap gap-1.5 mb-2 p-2 border rounded-md bg-muted/30">
                      <span
                        v-for="tag in form.tags"
                        :key="tag"
                        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md"
                      >
                        {{ tag }}
                        <button
                          type="button"
                          @click="removeTag(tag)"
                          class="hover:text-destructive"
                        >
                          ✕
                        </button>
                      </span>
                    </div>

                    <!-- Tag Selection Combobox -->
                    <Combobox
                      v-model="tagSearchInput"
                      :open="isTagsDropdownOpen"
                      @update:open="isTagsDropdownOpen = $event"
                    >
                      <ComboboxAnchor>
                        <ComboboxInput
                          id="tags"
                          placeholder="Type to add new tag or select existing..."
                          class="w-full"
                          @focus="isTagsDropdownOpen = true"
                          @keydown.enter.prevent="addCustomTag"
                        />
                      </ComboboxAnchor>
                      <ComboboxList class="max-h-48">
                        <ComboboxEmpty>
                          <div class="text-xs">
                            <span class="text-muted-foreground">Press Enter to add:</span>
                            <span class="font-medium ml-1">"{{ tagSearchInput }}"</span>
                          </div>
                        </ComboboxEmpty>
                        <ComboboxItem
                          v-for="tag in filteredAvailableTags"
                          :key="tag"
                          :value="tag"
                        >
                          <div class="flex items-center justify-between w-full">
                            <span>{{ tag }}</span>
                            <span v-if="form.tags.includes(tag)" class="text-primary text-xs">✓</span>
                          </div>
                        </ComboboxItem>
                      </ComboboxList>
                    </Combobox>
                    <p class="text-xs text-muted-foreground">
                      Type and press Enter to add custom tags, or select from suggestions. Click ✕ to remove.
                    </p>
                  </div>

                  <!-- Tutorial URL -->
                  <div class="space-y-2">
                    <Label for="tutorialUrl">Tutorial URL (optional)</Label>
                    <Input
                      id="tutorialUrl"
                      v-model="form.tutorialUrl"
                      type="url"
                      placeholder="https://docs.comfy.org/..."
                    />
                  </div>

                  <!-- ComfyUI Version -->
                  <div class="space-y-2">
                    <Label for="comfyuiVersion">Minimum ComfyUI Version (optional)</Label>
                    <Input
                      id="comfyuiVersion"
                      v-model="form.comfyuiVersion"
                      placeholder="0.3.26"
                    />
                  </div>
                </form>
              </CardContent>
              <CardFooter class="flex gap-2">
                <Button
                  @click="handleSubmit"
                  :disabled="isSubmitting"
                  class="flex-1"
                >
                  <svg v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
                </Button>
                <Button variant="outline" @click="openGitHubEditor">
                  <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Edit on GitHub
                </Button>
              </CardFooter>
            </Card>
          </div>

          <!-- Preview Section -->
          <div class="lg:col-span-1">
            <div class="sticky top-8 space-y-4">
              <!-- Template Preview -->
              <Card>
                <CardHeader>
                  <CardTitle class="text-base">Preview</CardTitle>
                  <CardDescription class="text-xs">Live preview of your changes</CardDescription>
                </CardHeader>
                <CardContent>
                  <TemplateCardPreview
                    :key="thumbnailPreviewKey"
                    :title="form.title"
                    :description="form.description"
                    :thumbnail-images="thumbnailFiles"
                    :thumbnail-variant="form.thumbnailVariant"
                    :tags="form.tags"
                    :tutorial-url="form.tutorialUrl"
                    :filename="templateName"
                    :category="currentCategoryTitle"
                    :media-type="originalTemplate?.mediaType || 'image'"
                    :media-subtype="originalTemplate?.mediaSubtype || 'webp'"
                    :has-workflow="true"
                    :model-count="originalTemplate?.models?.length || 0"
                    :comfyui-version="form.comfyuiVersion"
                    :date="form.date"
                  />
                </CardContent>
              </Card>

              <!-- File Information -->
              <Card>
                <CardHeader>
                  <CardTitle class="text-base">File Info</CardTitle>
                </CardHeader>
                <CardContent class="space-y-2 text-sm">
                  <div>
                    <Label class="text-xs text-muted-foreground">Repository</Label>
                    <p class="font-mono text-xs">{{ selectedRepo }}</p>
                  </div>
                  <div>
                    <Label class="text-xs text-muted-foreground">Branch</Label>
                    <p class="font-mono text-xs">{{ selectedBranch }}</p>
                  </div>
                  <div>
                    <Label class="text-xs text-muted-foreground">Media Type</Label>
                    <p class="text-xs">{{ originalTemplate?.mediaType }}</p>
                  </div>
                  <div v-if="originalTemplate?.date">
                    <Label class="text-xs text-muted-foreground">Date</Label>
                    <p class="text-xs">{{ originalTemplate.date }}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Combobox, ComboboxAnchor, ComboboxInput, ComboboxEmpty, ComboboxList, ComboboxItem } from '~/components/ui/combobox'
import TemplateCardPreview from '~/components/TemplateCardPreview.vue'

const route = useRoute()
const templateName = route.params.name as string

const {
  selectedRepo,
  selectedBranch
} = useGitHubRepo()

const loading = ref(true)
const error = ref('')
const isSubmitting = ref(false)
const originalTemplate = ref<any>(null)
const thumbnailFiles = ref<File[]>([])
const workflowFileInput = ref<HTMLInputElement>()
const thumbnailFileInputs = ref<any[]>([])
const workflowReuploadStatus = ref<{ success: boolean; message: string } | null>(null)
const thumbnailReuploadStatus = ref<{ success: boolean; message: string } | null>(null)
const reuploadedThumbnails = ref<Map<number, File>>(new Map())
const workflowContent = ref<any>(null)
const thumbnailPreviewUrls = ref<Map<number, string>>(new Map())
const thumbnailFilesInfo = ref<Map<number, { size: string; dimensions?: string }>>(new Map())

const form = ref({
  title: '',
  description: '',
  category: '',
  thumbnailVariant: 'none',
  tutorialUrl: '',
  tags: [] as string[],
  comfyuiVersion: '',
  date: ''
})

const availableCategories = ref<Array<{ moduleName: string; title: string }>>([])
const availableTags = ref<string[]>([])
const tagSearchInput = ref('')
const isTagsDropdownOpen = ref(false)

// Computed: Filter available tags based on search and exclude already selected
const filteredAvailableTags = computed(() => {
  const searchLower = tagSearchInput.value.toLowerCase()
  return availableTags.value.filter(tag =>
    tag.toLowerCase().includes(searchLower)
  )
})

// Watch for tag selection from Combobox (when selecting from dropdown)
watch(tagSearchInput, (value) => {
  // If value matches an available tag (selected from dropdown), add it
  if (value && availableTags.value.includes(value)) {
    if (!form.value.tags.includes(value)) {
      form.value.tags.push(value)
    }
    // Clear input after selection
    tagSearchInput.value = ''
    isTagsDropdownOpen.value = false
  }
})

// Add custom tag (when pressing Enter)
const addCustomTag = () => {
  const tag = tagSearchInput.value.trim()
  if (tag && !form.value.tags.includes(tag)) {
    form.value.tags.push(tag)
  }
  tagSearchInput.value = ''
  isTagsDropdownOpen.value = false
}

// Remove a tag from the selection
const removeTag = (tag: string) => {
  form.value.tags = form.value.tags.filter(t => t !== tag)
}

// Watch thumbnailVariant changes to adjust thumbnail count
watch(() => form.value.thumbnailVariant, async (newVariant, oldVariant) => {
  if (newVariant !== oldVariant && originalTemplate.value) {
    const newCount = (newVariant === 'hoverDissolve' || newVariant === 'compareSlider') ? 2 : 1
    const currentCount = thumbnailFiles.value.length

    console.log('[Variant Change]', { oldVariant, newVariant, currentCount, newCount })

    // If we need more thumbnails and don't have reuploaded ones, load from server
    if (newCount > currentCount) {
      const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
      const branch = selectedBranch.value || 'main'
      const [owner, repoName] = repo.split('/')

      // Only load the additional thumbnails we need
      const mediaSubtype = originalTemplate.value.mediaSubtype || 'webp'
      for (let i = currentCount + 1; i <= newCount; i++) {
        // Skip if user already uploaded this index
        if (reuploadedThumbnails.value.has(i)) {
          console.log(`[Variant Change] Skipping index ${i} - user uploaded`)
          continue
        }

        const url = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/${templateName}-${i}.${mediaSubtype}`
        try {
          const response = await fetch(url)
          if (response.ok) {
            const blob = await response.blob()
            const file = new File([blob], `${templateName}-${i}.${mediaSubtype}`, { type: blob.type })

            // Add to array
            const newFiles = [...thumbnailFiles.value]
            newFiles[i - 1] = file
            thumbnailFiles.value = newFiles

            // Calculate file info
            await calculateFileInfo(file, i)
          }
        } catch (err) {
          console.warn(`Failed to load thumbnail ${i}`)
        }
      }
    } else if (newCount < currentCount) {
      // If we need fewer thumbnails, trim the array but keep reuploaded ones
      console.log(`[Variant Change] Trimming from ${currentCount} to ${newCount} thumbnails`)
      thumbnailFiles.value = thumbnailFiles.value.slice(0, newCount)
    }
  }
})

// Computed: Get current category title for display (form.category now stores the title directly)
const currentCategoryTitle = computed(() => {
  return form.value.category || ''
})

// Computed: Required thumbnail count based on variant
const requiredThumbnailCount = computed(() => {
  const count = (form.value.thumbnailVariant === 'hoverDissolve' || form.value.thumbnailVariant === 'compareSlider') ? 2 : 1
  console.log('[requiredThumbnailCount] Variant:', form.value.thumbnailVariant, '→ Count:', count)
  return count
})

// Computed: Preview key to force re-render when thumbnails change
const thumbnailPreviewKey = computed(() => {
  // Create a key based on file names, sizes, and last modified to trigger re-render when files change
  return thumbnailFiles.value.map(f => `${f.name}_${f.size}_${f.lastModified}`).join('_') + `_${form.value.thumbnailVariant}`
})

// Get thumbnail label based on variant and index
const getThumbnailLabel = (index: number) => {
  if (form.value.thumbnailVariant === 'hoverDissolve') {
    return index === 1 ? 'Base Image' : 'Hover Image'
  } else if (form.value.thumbnailVariant === 'compareSlider') {
    return index === 1 ? 'After Image' : 'Before Image'
  }
  return `Thumbnail ${index}`
}

// Get thumbnail description based on variant and index
const getThumbnailDescription = (index: number) => {
  if (form.value.thumbnailVariant === 'hoverDissolve') {
    return index === 1
      ? 'Base image displayed by default'
      : 'Image shown when user hovers'
  } else if (form.value.thumbnailVariant === 'compareSlider') {
    return index === 1
      ? 'After state (right side, visible when slider is moved left)'
      : 'Before state (left side, visible when slider is moved right)'
  }
  return 'Main thumbnail image'
}

// Get thumbnail preview URL
const getThumbnailPreview = (index: number): string | undefined => {
  // Check if we have a reuploaded file with cached URL
  if (reuploadedThumbnails.value.has(index)) {
    return thumbnailPreviewUrls.value.get(index) || undefined
  }

  // Check if we already have a cached URL for this file
  if (thumbnailPreviewUrls.value.has(index)) {
    return thumbnailPreviewUrls.value.get(index)
  }

  // Check if we have loaded files - create URL only once
  if (thumbnailFiles.value[index - 1]) {
    const url = URL.createObjectURL(thumbnailFiles.value[index - 1])
    thumbnailPreviewUrls.value.set(index, url)
    return url
  }

  return undefined
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// Get image dimensions from file
const getImageDimensions = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('')
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(`${img.width}×${img.height}`)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve('')
    }

    img.src = url
  })
}

// Get thumbnail file info (size and dimensions)
const getThumbnailFileInfo = (index: number) => {
  return thumbnailFilesInfo.value.get(index)
}

// Calculate and store file info
const calculateFileInfo = async (file: File, index: number) => {
  const size = formatFileSize(file.size)
  const dimensions = await getImageDimensions(file)

  thumbnailFilesInfo.value.set(index, {
    size,
    dimensions: dimensions || undefined
  })
}

// Download workflow file
const downloadWorkflow = async () => {
  try {
    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'
    const [owner, repoName] = repo.split('/')

    const url = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/${templateName}.json`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Failed to download workflow file')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${templateName}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (err: any) {
    console.error('Error downloading workflow:', err)
    alert(`Failed to download workflow: ${err.message}`)
  }
}

// Download thumbnail file
const downloadThumbnail = async (index: number) => {
  try {
    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'
    const [owner, repoName] = repo.split('/')
    const mediaSubtype = originalTemplate.value?.mediaSubtype || 'webp'

    const url = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/${templateName}-${index}.${mediaSubtype}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Failed to download thumbnail')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${templateName}-${index}.${mediaSubtype}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (err: any) {
    console.error('Error downloading thumbnail:', err)
    alert(`Failed to download thumbnail: ${err.message}`)
  }
}

// Trigger workflow file upload
const triggerWorkflowUpload = () => {
  workflowFileInput.value?.click()
}

// Trigger thumbnail file upload
const triggerThumbnailUpload = (index: number) => {
  thumbnailFileInputs.value[index - 1]?.click()
}

// Handle workflow re-upload
const handleWorkflowReupload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Validate JSON
  try {
    const text = await file.text()
    JSON.parse(text)

    // Create new File object from validated content
    const newFile = new File([text], 'workflow.json', { type: 'application/json' })

    workflowReuploadStatus.value = {
      success: true,
      message: `✓ New workflow file loaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB). Click "Save Changes" to apply.`
    }

    // Store for submission
    // Note: We'll handle this in handleSubmit
  } catch (err: any) {
    workflowReuploadStatus.value = {
      success: false,
      message: `✗ Invalid JSON file: ${err.message}`
    }
  }
}

// Handle thumbnail re-upload
const handleThumbnailReupload = async (event: Event, index: number) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
    thumbnailReuploadStatus.value = {
      success: false,
      message: `✗ Invalid file type. Please upload an image, video, or audio file.`
    }
    return
  }

  // Store the file for this index
  reuploadedThumbnails.value.set(index, file)

  // Update preview - create new array to trigger reactivity
  const newFiles = [...thumbnailFiles.value]
  newFiles[index - 1] = file
  thumbnailFiles.value = newFiles

  // Calculate file info
  await calculateFileInfo(file, index)

  // Create preview URL and revoke old one if exists
  const oldUrl = thumbnailPreviewUrls.value.get(index)
  if (oldUrl) {
    URL.revokeObjectURL(oldUrl)
  }
  const previewUrl = URL.createObjectURL(file)
  thumbnailPreviewUrls.value.set(index, previewUrl)

  thumbnailReuploadStatus.value = {
    success: true,
    message: `✓ ${getThumbnailLabel(index)} updated: ${file.name} (${formatFileSize(file.size)}). Click "Save Changes" to apply.`
  }
}

onMounted(async () => {
  try {
    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'
    const [owner, repoName] = repo.split('/')

    // Load template metadata from index.json
    const indexUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/index.json`
    const response = await fetch(indexUrl)

    if (!response.ok) {
      throw new Error('Failed to load templates index')
    }

    const indexData = await response.json()

    // Extract available categories and tags
    if (Array.isArray(indexData)) {
      // Get all categories (use title as the unique identifier)
      availableCategories.value = indexData.map((cat: any) => ({
        moduleName: cat.moduleName, // Keep for reference, but not used as identifier
        title: cat.title || cat.moduleName
      }))
      console.log('[Edit Page] Available categories:', availableCategories.value)

      // Get all unique tags
      const tagsSet = new Set<string>()
      for (const category of indexData) {
        for (const template of category.templates || []) {
          if (template.tags && Array.isArray(template.tags)) {
            template.tags.forEach((tag: string) => tagsSet.add(tag))
          }
        }
      }
      availableTags.value = Array.from(tagsSet).sort()
    }

    // Find template and its category
    let foundTemplate = null
    let foundCategoryTitle = ''
    if (Array.isArray(indexData)) {
      for (const category of indexData) {
        const found = category.templates?.find((t: any) => t.name === templateName)
        if (found) {
          foundTemplate = found
          foundCategoryTitle = category.title // Use title as the unique identifier
          console.log('[Edit Page] Found template in category:', {
            moduleName: category.moduleName,
            title: category.title,
            templateName: templateName
          })
          break
        }
      }
    }

    if (!foundTemplate) {
      throw new Error(`Template "${templateName}" not found`)
    }

    originalTemplate.value = foundTemplate

    // Populate form with existing data
    form.value.title = foundTemplate.title || ''
    form.value.description = foundTemplate.description || ''
    form.value.category = foundCategoryTitle // Store category title (not moduleName)
    console.log('[Edit Page] Loaded template data:', {
      templateName,
      foundCategoryTitle,
      formCategory: form.value.category,
      availableCategories: availableCategories.value.length
    })
    form.value.thumbnailVariant = foundTemplate.thumbnailVariant || 'none'
    form.value.tutorialUrl = foundTemplate.tutorialUrl || ''
    form.value.tags = foundTemplate.tags || []
    form.value.comfyuiVersion = foundTemplate.comfyuiVersion || ''
    form.value.date = foundTemplate.date || ''

    // Load workflow content
    await loadWorkflowContent(owner, repoName, branch)

    // Load thumbnail for preview
    await loadThumbnails(owner, repoName, branch)

  } catch (err: any) {
    console.error('Error loading template:', err)
    error.value = err.message || 'Failed to load template'
  } finally {
    loading.value = false
  }
})

const loadWorkflowContent = async (owner: string, repo: string, branch: string) => {
  try {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/templates/${templateName}.json`
    console.log('Loading workflow from:', url)
    const response = await fetch(url)

    if (response.ok) {
      const text = await response.text()
      workflowContent.value = JSON.parse(text)
    } else if (response.status === 404) {
      console.warn('Workflow file not found at:', url)
      workflowContent.value = null
    } else {
      console.error('Failed to load workflow:', response.status, response.statusText)
    }
  } catch (err) {
    console.error('Error loading workflow:', err)
    workflowContent.value = null
  }
}

const loadThumbnails = async (owner: string, repo: string, branch: string) => {
  try {
    const mediaSubtype = originalTemplate.value.mediaSubtype || 'webp'
    // Use current form variant, not original template variant
    const variant = form.value.thumbnailVariant

    let count = 1
    if (variant === 'compareSlider' || variant === 'hoverDissolve') {
      count = 2
    }

    console.log('[loadThumbnails] Loading thumbnails:', {
      variant,
      count,
      templateName,
      mediaSubtype
    })

    const files: File[] = []
    for (let i = 1; i <= count; i++) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/templates/${templateName}-${i}.${mediaSubtype}`
      try {
        const response = await fetch(url)
        if (response.ok) {
          const blob = await response.blob()
          const file = new File([blob], `${templateName}-${i}.${mediaSubtype}`, { type: blob.type })
          files.push(file)

          // Calculate file info
          await calculateFileInfo(file, i)
        }
      } catch (err) {
        console.warn(`Failed to load thumbnail ${i}`)
      }
    }

    thumbnailFiles.value = files
    console.log('[loadThumbnails] Loaded files:', files.length, 'thumbnails')
    console.log('[loadThumbnails] thumbnailFiles.value now has', thumbnailFiles.value.length, 'items')
  } catch (err) {
    console.error('Error loading thumbnails:', err)
  }
}

const handleSubmit = async () => {
  if (isSubmitting.value) return

  try {
    isSubmitting.value = true

    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'

    // Prepare files data if there are reuploaded files
    const filesData: any = {}

    // Check if workflow was reuploaded
    if (workflowFileInput.value?.files?.[0]) {
      const workflowFile = workflowFileInput.value.files[0]
      const workflowBase64 = await fileToBase64(workflowFile)
      filesData.workflow = {
        content: workflowBase64.split(',')[1] // Remove data URL prefix
      }
    }

    // Check if thumbnails were reuploaded
    if (reuploadedThumbnails.value.size > 0) {
      filesData.thumbnails = []
      for (const [index, file] of reuploadedThumbnails.value) {
        const thumbnailBase64 = await fileToBase64(file)
        const ext = file.name.split('.').pop() || 'webp'
        filesData.thumbnails.push({
          index,
          content: thumbnailBase64.split(',')[1], // Remove data URL prefix
          filename: `${templateName}-${index}.${ext}`
        })
      }
    }

    // Call API to update template
    const response = await $fetch('/api/github/template/update', {
      method: 'POST',
      body: {
        repo,
        branch,
        templateName,
        metadata: {
          title: form.value.title,
          description: form.value.description,
          category: form.value.category,
          thumbnailVariant: form.value.thumbnailVariant,
          tags: form.value.tags,
          tutorialUrl: form.value.tutorialUrl,
          comfyuiVersion: form.value.comfyuiVersion,
          date: form.value.date
        },
        files: Object.keys(filesData).length > 0 ? filesData : undefined
      }
    })

    if (response.success) {
      // Clear reuploaded files status
      reuploadedThumbnails.value.clear()
      workflowReuploadStatus.value = null
      thumbnailReuploadStatus.value = null

      // Show brief success message
      alert(`✅ Template updated successfully!\n\nCommit: ${response.commit.sha.substring(0, 7)}\n\nRedirecting to homepage...`)

      // Mark that we just saved, so homepage knows to force refresh
      if (process.client) {
        sessionStorage.setItem('template_just_saved', 'true')
      }

      // Redirect to homepage after brief delay
      setTimeout(() => {
        navigateTo('/')
      }, 500)
    }

  } catch (error: any) {
    console.error('Error saving template:', error)
    alert(`❌ Failed to save template:\n\n${error.data?.statusMessage || error.message || 'Unknown error'}`)
  } finally {
    isSubmitting.value = false
  }
}

// Helper function to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const openGitHubEditor = () => {
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'

  // Open the index.json file in GitHub editor
  const githubUrl = `https://github.com/${repo}/edit/${branch}/templates/index.json`
  window.open(githubUrl, '_blank')
}

useHead({
  title: `Edit ${templateName} - ComfyUI Template Manager`
})
</script>
