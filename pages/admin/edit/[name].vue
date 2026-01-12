<template>
  <div class="min-h-screen bg-background">
    <!-- Fixed Header -->
    <div class="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="container mx-auto px-4 py-4">
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
              <h1 class="text-xl font-semibold tracking-tight">Edit Template</h1>
              <p class="text-xs text-muted-foreground">{{ templateName }}</p>
            </div>
          </div>

          <!-- Save Button (moved to top right) -->
          <Button
            @click="handleSubmit"
            :disabled="isSubmitting"
            size="default"
          >
            <svg v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Main Content with top padding for fixed header -->
    <div class="pt-[73px]">
      <!-- Loading State -->
      <div v-if="loading" class="container mx-auto px-4 py-12 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p class="text-muted-foreground">Loading template...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="container mx-auto px-4 py-12">
        <Card class="border-red-200 max-w-2xl mx-auto">
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
      </div>

      <!-- Edit Form with Sidebar -->
      <div v-else class="flex">
        <!-- Left Sidebar: Template List for Reordering -->
        <div class="w-80 border-r bg-muted/30 min-h-[calc(100vh-73px)] sticky top-[73px] overflow-y-auto">
          <div class="p-4">
            <h2 class="text-sm font-semibold mb-2">Category Order</h2>
            <p class="text-xs text-muted-foreground mb-4">{{ currentCategoryTitle }}</p>

            <div class="space-y-2">
              <div
                v-for="(template, index) in categoryTemplates"
                :key="template.name"
                :draggable="true"
                @dragstart="onDragStart($event, index)"
                @dragover="onDragOver($event, index)"
                @drop="onDrop($event, index)"
                @dragend="onDragEnd"
                class="p-2 rounded-lg cursor-move transition-all relative"
                :class="{
                  'bg-primary text-primary-foreground shadow-lg ring-2 ring-primary ring-offset-2': template.name === templateName,
                  'bg-background hover:bg-accent hover:shadow': template.name !== templateName,
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

                  <!-- Position Change Indicator -->
                  <div
                    v-if="templatePositionChanges.has(template.name)"
                    class="flex items-center gap-1 flex-shrink-0"
                  >
                    <div
                      class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold"
                      :class="{
                        'bg-green-500 text-white': templatePositionChanges.get(template.name)!.change > 0,
                        'bg-red-500 text-white': templatePositionChanges.get(template.name)!.change < 0
                      }"
                    >
                      <!-- Up arrow for moved up (positive change) -->
                      <svg
                        v-if="templatePositionChanges.get(template.name)!.change > 0"
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
                      <span>{{ Math.abs(templatePositionChanges.get(template.name)!.change) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 container mx-auto px-4 py-8">
        <!-- Workflow File Section with Input Files -->
        <div class="mb-6">
          <WorkflowFileManager
            ref="workflowFileManagerRef"
            :template-name="templateName"
            :repo="selectedRepo"
            :branch="selectedBranch"
            :workflow-content="workflowContent"
            @workflow-updated="handleWorkflowUpdated"
            @input-files-updated="handleInputFilesUpdated"
            @open-converter="handleInputFileConversion"
            @format-changed="handleInputFileFormatChange"
          />
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
                      <div v-for="index in thumbnailDisplayOrder" :key="index" class="border rounded p-2 bg-card hover:border-primary/30 transition-colors">
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
                                title="Upload WebP or convert other formats"
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

                    <!-- Tag Input with Suggestions -->
                    <div class="relative">
                      <Input
                        id="tags"
                        v-model="tagSearchInput"
                        placeholder="Type to add new tag or select existing..."
                        @keydown.enter.prevent="addCustomTag"
                        @focus="isTagsDropdownOpen = true"
                        @blur="() => setTimeout(() => isTagsDropdownOpen = false, 200)"
                      />

                      <!-- Dropdown suggestions -->
                      <div
                        v-if="isTagsDropdownOpen"
                        class="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto"
                      >
                        <!-- Add new tag option -->
                        <div
                          v-if="tagSearchInput.trim()"
                          class="px-3 py-2 text-sm hover:bg-accent cursor-pointer border-b"
                          @mousedown.prevent="addCustomTag"
                        >
                          <span class="text-muted-foreground">Press Enter to add:</span>
                          <span class="font-medium ml-1">"{{ tagSearchInput.trim() }}"</span>
                        </div>

                        <!-- Existing tag suggestions -->
                        <div
                          v-for="tag in filteredAvailableTags"
                          :key="tag"
                          class="px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center justify-between"
                          @mousedown.prevent="selectTag(tag)"
                        >
                          <span>{{ tag }}</span>
                          <span v-if="form.tags.includes(tag)" class="text-primary text-xs">✓</span>
                        </div>

                        <!-- Empty state -->
                        <div
                          v-if="!tagSearchInput.trim() && filteredAvailableTags.length === 0"
                          class="px-3 py-2 text-sm text-muted-foreground text-center"
                        >
                          Type to add tags
                        </div>
                      </div>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      Type and press Enter to add custom tags, or select from suggestions. Click ✕ to remove.
                    </p>
                  </div>

                  <!-- Models Multi-Select -->
                  <div class="space-y-2">
                    <Label for="models">Models (optional)</Label>

                    <!-- Selected Models Display -->
                    <div v-if="form.models.length > 0" class="flex flex-wrap gap-1.5 mb-2 p-2 border rounded-md bg-muted/30">
                      <span
                        v-for="model in form.models"
                        :key="model"
                        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md"
                      >
                        {{ model }}
                        <button
                          type="button"
                          @click="removeModel(model)"
                          class="hover:text-destructive"
                        >
                          ✕
                        </button>
                      </span>
                    </div>

                    <!-- Model Input with Suggestions -->
                    <div class="relative">
                      <Input
                        id="models"
                        v-model="modelSearchInput"
                        placeholder="Type to add new model or select existing..."
                        @keydown.enter.prevent="addCustomModel"
                        @focus="isModelsDropdownOpen = true"
                        @blur="() => setTimeout(() => isModelsDropdownOpen = false, 200)"
                      />

                      <!-- Dropdown suggestions -->
                      <div
                        v-if="isModelsDropdownOpen"
                        class="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto"
                      >
                        <!-- Add new model option -->
                        <div
                          v-if="modelSearchInput.trim()"
                          class="px-3 py-2 text-sm hover:bg-accent cursor-pointer border-b"
                          @mousedown.prevent="addCustomModel"
                        >
                          <span class="text-muted-foreground">Press Enter to add:</span>
                          <span class="font-medium ml-1">"{{ modelSearchInput.trim() }}"</span>
                        </div>

                        <!-- Existing model suggestions -->
                        <div
                          v-for="model in filteredAvailableModels"
                          :key="model"
                          class="px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center justify-between"
                          @mousedown.prevent="selectModel(model)"
                        >
                          <span>{{ model }}</span>
                          <span v-if="form.models.includes(model)" class="text-primary text-xs">✓</span>
                        </div>

                        <!-- Empty state -->
                        <div
                          v-if="!modelSearchInput.trim() && filteredAvailableModels.length === 0"
                          class="px-3 py-2 text-sm text-muted-foreground text-center"
                        >
                          Type to add models
                        </div>
                      </div>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      Type and press Enter to add custom models, or select from suggestions. Click ✕ to remove.
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
            </Card>
          </div>

          <!-- Preview Section -->
          <div class="lg:col-span-1">
            <div class="sticky top-20 space-y-4">
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
                    :model-count="form.models.length"
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
        <!-- Close main content area -->
      </div>
      <!-- Close flex container -->
    </div>
    <!-- Close pt-[73px] container -->

    <!-- Thumbnail Converter Dialog -->
    <Dialog v-model:open="isConverterDialogOpen">
      <DialogScrollContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Convert to WebP - {{ getThumbnailLabel(converterTargetIndex) }}</DialogTitle>
          <DialogDescription>
            Convert your image or video file to optimized WebP format for {{ getThumbnailLabel(converterTargetIndex) }}
          </DialogDescription>
        </DialogHeader>
        <ThumbnailConverter :initial-file="converterInitialFile" @converted="handleConvertedThumbnail" />
      </DialogScrollContent>
    </Dialog>

    <!-- Input Asset Converter Dialog -->
    <Dialog v-model:open="isInputAssetConverterOpen">
      <DialogScrollContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Optimize Input Asset - {{ converterTargetInputFilename }}</DialogTitle>
          <DialogDescription>
            Convert and optimize your input file with custom settings
          </DialogDescription>
        </DialogHeader>
        <InputAssetConverter
          :initial-file="converterInitialFile"
          :target-filename="converterTargetInputFilename"
          :is-existing-file="converterIsExistingFile"
          @converted="handleConvertedInputFile"
        />
      </DialogScrollContent>
    </Dialog>
  </div>
  <!-- Close min-h-screen container -->
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Dialog, DialogScrollContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import TemplateCardPreview from '~/components/TemplateCardPreview.vue'
import ThumbnailConverter from '~/components/ThumbnailConverter.vue'
import InputAssetConverter from '~/components/InputAssetConverter.vue'

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
const thumbnailFileInputs = ref<any[]>([])
const thumbnailReuploadStatus = ref<{ success: boolean; message: string } | null>(null)
const reuploadedThumbnails = ref<Map<number, File>>(new Map())
const workflowContent = ref<string>('')
const thumbnailPreviewUrls = ref<Map<number, string>>(new Map())
const thumbnailFilesInfo = ref<Map<number, { size: string; dimensions?: string }>>(new Map())

// Workflow and input files state
const updatedWorkflowContent = ref<string>('')
const reuploadedInputFiles = ref<Map<string, File>>(new Map())

// Thumbnail converter state
const isConverterDialogOpen = ref(false)
const converterTargetIndex = ref<number>(1)
const converterInitialFile = ref<File | null>(null)

// Input file converter state
const isInputAssetConverterOpen = ref(false)
const converterTargetInputFilename = ref<string>('')
const converterIsExistingFile = ref(false)
const workflowFileManagerRef = ref<any>(null)

// Drag and drop state for template reordering
const draggedIndex = ref<number | null>(null)
const categoryTemplates = ref<any[]>([])
const originalCategoryTemplates = ref<any[]>([])
const templateOrderChanged = ref(false)

// Computed: Calculate position changes for each template
const templatePositionChanges = computed(() => {
  const changes = new Map<string, { oldIndex: number; newIndex: number; change: number }>()

  originalCategoryTemplates.value.forEach((template, oldIndex) => {
    const newIndex = categoryTemplates.value.findIndex(t => t.name === template.name)
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

// Helper: Get thumbnail URL for a template
const getTemplateThumbnailUrl = (template: any) => {
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'
  const mediaSubtype = template.mediaSubtype || 'webp'
  return `https://raw.githubusercontent.com/${repo}/${branch}/templates/${template.name}-1.${mediaSubtype}`
}

const form = ref({
  title: '',
  description: '',
  category: '',
  thumbnailVariant: 'none',
  tutorialUrl: '',
  tags: [] as string[],
  models: [] as string[],
  comfyuiVersion: '',
  date: ''
})

const availableCategories = ref<Array<{ moduleName: string; title: string }>>([])
const availableTags = ref<string[]>([])
const availableModels = ref<string[]>([])
const tagSearchInput = ref('')
const modelSearchInput = ref('')
const isTagsDropdownOpen = ref(false)
const isModelsDropdownOpen = ref(false)

// Computed: Filter available tags based on search
const filteredAvailableTags = computed(() => {
  const searchLower = tagSearchInput.value.toLowerCase()
  return availableTags.value.filter(tag =>
    tag.toLowerCase().includes(searchLower)
  )
})

// Computed: Filter available models based on search
const filteredAvailableModels = computed(() => {
  const searchLower = modelSearchInput.value.toLowerCase()
  return availableModels.value.filter(model =>
    model.toLowerCase().includes(searchLower)
  )
})

// Select existing tag from dropdown
const selectTag = (tag: string) => {
  if (!form.value.tags.includes(tag)) {
    form.value.tags.push(tag)
  }
  tagSearchInput.value = ''
  isTagsDropdownOpen.value = false
}

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

// Select existing model from dropdown
const selectModel = (model: string) => {
  if (!form.value.models.includes(model)) {
    form.value.models.push(model)
  }
  modelSearchInput.value = ''
  isModelsDropdownOpen.value = false
}

// Add custom model (when pressing Enter)
const addCustomModel = () => {
  const model = modelSearchInput.value.trim()
  if (model && !form.value.models.includes(model)) {
    form.value.models.push(model)
  }
  modelSearchInput.value = ''
  isModelsDropdownOpen.value = false
}

// Remove a model from the selection
const removeModel = (model: string) => {
  form.value.models = form.value.models.filter(m => m !== model)
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

// Computed: Thumbnail display order (for compareSlider, swap order)
const thumbnailDisplayOrder = computed(() => {
  const count = requiredThumbnailCount.value
  if (count === 1) {
    return [1]
  }
  // For compareSlider: swap display order
  // Left: index 2 (After), Right: index 1 (Before)
  if (form.value.thumbnailVariant === 'compareSlider') {
    return [2, 1]
  }
  // Default order for other variants
  return [1, 2]
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
// Handler for workflow updates from WorkflowFileManager
const handleWorkflowUpdated = (content: string) => {
  updatedWorkflowContent.value = content
}

// Handler for input files updates from WorkflowFileManager
const handleInputFilesUpdated = (files: Map<string, File>) => {
  reuploadedInputFiles.value = files
}

// Handler for opening converter for input files
const handleInputFileConversion = (file: File, targetFilename: string, isExisting: boolean) => {
  converterInitialFile.value = file
  converterTargetInputFilename.value = targetFilename
  converterIsExistingFile.value = isExisting
  isInputAssetConverterOpen.value = true
}

// Download thumbnail file
const downloadThumbnail = async (index: number) => {
  try {
    // Check if user has uploaded/converted a new file locally (not yet saved)
    if (reuploadedThumbnails.value.has(index)) {
      // Download the local converted/uploaded file
      const file = reuploadedThumbnails.value.get(index)!
      const downloadUrl = window.URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      return
    }

    // Otherwise, download from GitHub (saved version)
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

// Trigger thumbnail file upload
const triggerThumbnailUpload = (index: number) => {
  thumbnailFileInputs.value[index - 1]?.click()
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

  // Check if file is WebP
  const isWebP = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')

  if (!isWebP) {
    // File is not WebP - auto-open converter dialog with the file pre-loaded
    thumbnailReuploadStatus.value = {
      success: false,
      message: `ℹ️ File needs to be converted to WebP format. Opening converter...`
    }

    // Store the file and open converter dialog for this index
    converterInitialFile.value = file
    converterTargetIndex.value = index
    isConverterDialogOpen.value = true

    // Clear the file input so user can select the same file again if needed
    target.value = ''
    return
  }

  // File is WebP - proceed with upload
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

  // Clear the file input
  target.value = ''
}

// Handle converted thumbnail from ThumbnailConverter
const handleConvertedThumbnail = async (file: File) => {
  const index = converterTargetIndex.value

  // Store the converted file
  reuploadedThumbnails.value.set(index, file)

  // Update preview
  const newFiles = [...thumbnailFiles.value]
  newFiles[index - 1] = file
  thumbnailFiles.value = newFiles

  // Calculate file info
  await calculateFileInfo(file, index)

  // Update preview URL
  const previewUrl = URL.createObjectURL(file)
  thumbnailPreviewUrls.value.set(index, previewUrl)

  // Clear initial file and close dialog
  converterInitialFile.value = null
  isConverterDialogOpen.value = false

  // Show success message
  thumbnailReuploadStatus.value = {
    success: true,
    message: `✓ ${getThumbnailLabel(index)} converted: ${file.name} (${formatFileSize(file.size)}). Click "Save Changes" to apply.`
  }
}

// Handle converted input file from InputAssetConverter
const handleConvertedInputFile = (file: File, oldFilename?: string) => {
  // Use the converted file's name, not the original target filename
  // because format may have changed (e.g., subject.png -> subject.jpg)
  const targetFilename = file.name

  console.log('[Edit Page] handleConvertedInputFile:', {
    fileName: file.name,
    originalTarget: converterTargetInputFilename.value,
    oldFilename
  })

  // Pass to WorkflowFileManager with oldFilename if format changed
  if (workflowFileManagerRef.value) {
    workflowFileManagerRef.value.handleConvertedFileReceived(file, targetFilename, oldFilename)
  }

  // Clear state and close dialog
  converterInitialFile.value = null
  converterTargetInputFilename.value = ''
  converterIsExistingFile.value = false
  isInputAssetConverterOpen.value = false
}

// Handle input file format change (update workflow JSON)
const handleInputFileFormatChange = (oldFilename: string, newFilename: string) => {
  console.log('[Edit Page] Format changed:', oldFilename, '→', newFilename)

  // Update workflow JSON to replace old filename with new filename
  try {
    if (workflowContent.value) {
      const workflow = JSON.parse(workflowContent.value)

      // Find all nodes and update widget values that match old filename
      if (workflow.nodes) {
        for (const node of workflow.nodes) {
          if (node.widgets_values && Array.isArray(node.widgets_values)) {
            for (let i = 0; i < node.widgets_values.length; i++) {
              if (node.widgets_values[i] === oldFilename) {
                console.log(`[Edit Page] Updating node ${node.id} widget value:`, oldFilename, '→', newFilename)
                node.widgets_values[i] = newFilename
              }
            }
          }
        }
      }

      // Update workflow content
      workflowContent.value = JSON.stringify(workflow, null, 2)
      hasWorkflowChanged.value = true

      console.log('[Edit Page] Workflow JSON updated successfully')
    }
  } catch (error) {
    console.error('[Edit Page] Failed to update workflow JSON:', error)
  }
}

// Watch dialog state to clear initial file when closed
watch(isConverterDialogOpen, (isOpen) => {
  if (!isOpen) {
    // Clear initial file when dialog is closed
    converterInitialFile.value = null
  }
})

watch(isInputAssetConverterOpen, (isOpen) => {
  if (!isOpen) {
    // Clear initial file when dialog is closed
    converterInitialFile.value = null
    converterTargetInputFilename.value = ''
  }
})

// Drag and drop handlers for template reordering
const onDragStart = (event: DragEvent, index: number) => {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const onDragOver = (event: DragEvent, index: number) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const onDrop = (event: DragEvent, targetIndex: number) => {
  event.preventDefault()

  if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
    return
  }

  // Reorder the templates array
  const newTemplates = [...categoryTemplates.value]
  const [draggedTemplate] = newTemplates.splice(draggedIndex.value, 1)
  newTemplates.splice(targetIndex, 0, draggedTemplate)

  categoryTemplates.value = newTemplates
  templateOrderChanged.value = true

  console.log('[Template Reorder] Templates reordered')
}

const onDragEnd = () => {
  draggedIndex.value = null
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
      const modelsSet = new Set<string>()
      for (const category of indexData) {
        for (const template of category.templates || []) {
          if (template.tags && Array.isArray(template.tags)) {
            template.tags.forEach((tag: string) => tagsSet.add(tag))
          }
          if (template.models && Array.isArray(template.models)) {
            template.models.forEach((model: string) => modelsSet.add(model))
          }
        }
      }
      availableTags.value = Array.from(tagsSet).sort()
      availableModels.value = Array.from(modelsSet).sort()
    }

    // Find template and its category
    let foundTemplate = null
    let foundCategoryTitle = ''
    let foundCategoryTemplates: any[] = []
    if (Array.isArray(indexData)) {
      for (const category of indexData) {
        const found = category.templates?.find((t: any) => t.name === templateName)
        if (found) {
          foundTemplate = found
          foundCategoryTitle = category.title // Use title as the unique identifier
          foundCategoryTemplates = category.templates || []
          console.log('[Edit Page] Found template in category:', {
            moduleName: category.moduleName,
            title: category.title,
            templateName: templateName,
            templateCount: foundCategoryTemplates.length
          })
          break
        }
      }
    }

    if (!foundTemplate) {
      throw new Error(`Template "${templateName}" not found`)
    }

    originalTemplate.value = foundTemplate

    // Populate category templates for reordering sidebar
    categoryTemplates.value = foundCategoryTemplates
    originalCategoryTemplates.value = [...foundCategoryTemplates] // Deep copy for comparison
    console.log('[Edit Page] Loaded category templates for reordering:', categoryTemplates.value.length)

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
    form.value.models = foundTemplate.models || []
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
      // Store as string for WorkflowFileManager component
      workflowContent.value = text
    } else if (response.status === 404) {
      console.warn('Workflow file not found at:', url)
      workflowContent.value = ''
    } else {
      console.error('Failed to load workflow:', response.status, response.statusText)
    }
  } catch (err) {
    console.error('Error loading workflow:', err)
    workflowContent.value = ''
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
    if (updatedWorkflowContent.value) {
      // Create a temporary File object to convert to base64
      const workflowBlob = new Blob([updatedWorkflowContent.value], { type: 'application/json' })
      const workflowFile = new File([workflowBlob], 'workflow.json', { type: 'application/json' })
      const workflowBase64 = await fileToBase64(workflowFile)
      filesData.workflow = {
        content: workflowBase64.split(',')[1] // Remove data URL prefix
      }
    }

    // Check if input files were reuploaded
    if (reuploadedInputFiles.value.size > 0) {
      filesData.inputFiles = []

      // Get format changes from WorkflowFileManager
      const formatChanges = workflowFileManagerRef.value?.formatChangedFiles || new Map()

      for (const [filename, file] of reuploadedInputFiles.value) {
        const fileBase64 = await fileToBase64(file)
        const inputFileData: any = {
          filename,
          content: fileBase64.split(',')[1] // Remove data URL prefix
        }

        // If format changed, include old filename for deletion
        if (formatChanges.has(filename)) {
          inputFileData.deleteOldFile = formatChanges.get(filename)
          console.log('[Submit] Format changed:', formatChanges.get(filename), '→', filename)
        }

        filesData.inputFiles.push(inputFileData)
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

    // Prepare new template order if it was changed
    const templateOrder = templateOrderChanged.value ? categoryTemplates.value.map(t => t.name) : undefined

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
          models: form.value.models,
          tutorialUrl: form.value.tutorialUrl,
          comfyuiVersion: form.value.comfyuiVersion,
          date: form.value.date
        },
        templateOrder,
        files: Object.keys(filesData).length > 0 ? filesData : undefined
      }
    })

    if (response.success) {
      // Clear reuploaded files status
      reuploadedThumbnails.value.clear()
      updatedWorkflowContent.value = ''
      reuploadedInputFiles.value.clear()
      thumbnailReuploadStatus.value = null

      // Clear format changes in WorkflowFileManager
      if (workflowFileManagerRef.value) {
        workflowFileManagerRef.value.resetFormatChanges()
      }

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

useHead({
  title: `Edit ${templateName} - ComfyUI Template Manager`
})
</script>
