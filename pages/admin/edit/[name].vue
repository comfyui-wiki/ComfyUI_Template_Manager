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
              <h1 class="text-xl font-semibold tracking-tight">
                {{ isCreateMode ? 'Create Template' : 'Edit Template' }}
              </h1>
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <span class="font-mono">{{ isCreateMode ? 'New Template' : templateName }}</span>
                <span>•</span>
                <a
                  :href="`https://github.com/${selectedRepo}/tree/${selectedBranch}`"
                  target="_blank"
                  class="hover:text-primary flex items-center gap-1 transition-colors"
                  title="View on GitHub"
                >
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span class="font-mono">{{ selectedRepo }}</span>
                  <span>/</span>
                  <span class="font-mono">{{ selectedBranch }}</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <!-- Save Button Section -->
          <div class="flex flex-col items-end gap-2">
            <Button
              @click="handleSubmit"
              :disabled="!canEditCurrentRepo || isSubmitting || !hasAnyChanges || missingFields.length > 0"
              size="default"
              :class="{
                'opacity-50 cursor-not-allowed': !hasAnyChanges || missingFields.length > 0 || !canEditCurrentRepo
              }"
              :title="!canEditCurrentRepo ? 'Editing is disabled for this branch' : ''"
            >
              <svg v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isSubmitting ? (isCreateMode ? 'Creating...' : 'Saving...') : (isCreateMode ? 'Create Template' : 'Save Changes') }}
            </Button>

            <!-- Success Message -->
            <div v-if="saveSuccess" class="text-xs text-green-600 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{{ isCreateMode ? 'Template created successfully! Redirecting to homepage...' : 'Saved successfully!' }}</span>
              <a :href="saveSuccess.commitUrl" target="_blank" class="text-blue-600 hover:underline font-mono">
                {{ saveSuccess.commitSha.substring(0, 7) }}
              </a>
            </div>

            <!-- No Changes Message -->
            <div v-else-if="!hasAnyChanges && !isSubmitting" class="text-xs text-muted-foreground">
              No changes to save
            </div>

            <!-- Missing Fields Warning -->
            <div v-else-if="missingFields.length > 0" class="text-xs text-red-600">
              Missing: {{ missingFields.join(', ') }}
            </div>
          </div>
        </div>
      </div>

      <!-- Completion Progress Bar -->
      <div class="w-full bg-muted/30 px-4 py-2">
        <div class="container mx-auto">
          <div class="flex items-center justify-between mb-1">
            <div class="text-xs font-medium">
              <span>Completion</span>
              <span class="ml-2 text-muted-foreground">
                {{ completionStatus.completed }}/{{ completionStatus.total }} fields
              </span>
            </div>
            <div class="text-xs font-semibold" :class="{
              'text-green-600': completionStatus.percentage === 100,
              'text-amber-600': completionStatus.percentage >= 50 && completionStatus.percentage < 100,
              'text-red-600': completionStatus.percentage < 50
            }">
              {{ completionStatus.percentage }}%
            </div>
          </div>
          <div class="w-full bg-muted rounded-full h-2">
            <div
              class="h-2 rounded-full transition-all duration-300"
              :class="{
                'bg-green-500': completionStatus.percentage === 100,
                'bg-amber-500': completionStatus.percentage >= 50 && completionStatus.percentage < 100,
                'bg-red-500': completionStatus.percentage < 50
              }"
              :style="{ width: `${completionStatus.percentage}%` }"
            ></div>
          </div>
          <!-- Missing Fields Hint -->
          <div v-if="missingFields.length > 0" class="mt-1 text-xs text-red-600">
            ⚠️ Required: {{ missingFields.join(', ') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Read-Only Mode Banner -->
    <div v-if="!canEditCurrentRepo" class="fixed top-[110px] left-0 right-0 z-40 border-b bg-amber-50">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm text-amber-900 font-medium">Read-Only Mode - Editing Disabled</p>
            <p class="text-xs text-amber-800 mt-1">
              You're viewing this template from <span class="font-mono font-semibold">{{ selectedRepo }}</span> / <span class="font-mono font-semibold">{{ selectedBranch }}</span>.
              You cannot edit or save changes. To edit templates, please switch to a branch you have write access to.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content with top padding for fixed header + completion bar -->
    <div :class="canEditCurrentRepo ? 'pt-[140px]' : 'pt-[200px]'">
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

      <!-- Edit/Create Form with Sidebar -->
      <div v-else class="flex">
        <!-- Left Sidebar: Template List for Reordering -->
        <!-- In edit mode: always show -->
        <!-- In create mode: show when category is selected and templateName is set -->
        <CategoryOrderSidebar
          v-if="!isCreateMode || (isCreateMode && form.category && form.templateName)"
          ref="categoryOrderSidebarRef"
          :templates="categoryTemplates"
          :current-template-name="isCreateMode ? form.templateName : templateName"
          :current-template-title="form.title"
          :current-template-thumbnail="currentTemplateThumbnailPreview"
          :category-title="currentCategoryTitle"
          :repo="selectedRepo"
          :branch="selectedBranch"
          @reorder="handleTemplateReorder"
        />

        <!-- Main Content Area -->
        <div class="flex-1 container mx-auto px-4 py-8" :class="{ 'max-w-6xl': isCreateMode }">
        <!-- Workflow File Section with Input Files -->
        <div class="mb-6">
          <WorkflowFileManager
            ref="workflowFileManagerRef"
            :template-name="templateName"
            :repo="selectedRepo"
            :branch="selectedBranch"
            :workflow-content="workflowContent"
            :model-links-validation="modelLinksValidation"
            @workflow-updated="handleWorkflowUpdated"
            @input-files-updated="handleInputFilesUpdated"
            @open-converter="handleInputFileConversion"
            @format-changed="handleInputFileFormatChange"
            @template-name-extracted="handleTemplateNameExtracted"
            @open-model-links-editor="openModelLinksEditor"
          />
        </div>

        <div class="grid gap-8 lg:grid-cols-3">
          <!-- Form Section -->
          <div class="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Template Details</CardTitle>
                <CardDescription>
                  {{ isCreateMode ? 'Create a new template' : 'Edit the template information' }}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form @submit.prevent="handleSubmit" class="space-y-6">
                  <!-- Thumbnail Files Management - TOP PRIORITY -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <Label class="text-base font-semibold flex items-center gap-1">
                        Thumbnail Files
                        <span class="text-red-500">*</span>
                      </Label>
                      <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {{ requiredThumbnailCount }} file(s) required
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
                                {{ displayTemplateName }}-{{ index }}.{{ originalTemplate?.mediaSubtype || 'webp' }}
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
                                :disabled="isCreateMode && !reuploadedThumbnails.has(index)"
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
                    <Label for="title" class="flex items-center gap-1">
                      Display Title
                      <span class="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      v-model="form.title"
                      placeholder="Text to Image Basic"
                      required
                      :class="{
                        'border-red-500 focus:ring-red-500': !form.title?.trim()
                      }"
                    />
                    <p v-if="!form.title?.trim()" class="text-xs text-red-600">⚠️ Title is required</p>
                  </div>

                  <!-- Description -->
                  <div class="space-y-2">
                    <Label for="description" class="flex items-center gap-1">
                      Description
                      <span class="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      v-model="form.description"
                      placeholder="Generate images from text prompts..."
                      required
                      class="min-h-[80px] resize-y"
                      :class="{
                        'border-red-500 focus:ring-red-500': !form.description?.trim()
                      }"
                    />
                    <p v-if="!form.description?.trim()" class="text-xs text-red-600">⚠️ Description is required</p>
                  </div>

                  <!-- Category -->
                  <div class="space-y-2">
                    <Label for="category" class="flex items-center gap-1">
                      Category
                      <span class="text-red-500">*</span>
                    </Label>
                    <Select v-model="form.category">
                      <SelectTrigger :class="{
                        'border-red-500 focus:ring-red-500': !form.category?.trim()
                      }">
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
                    <p v-if="!form.category?.trim()" class="text-xs text-red-600">⚠️ Category is required</p>
                    <p v-else class="text-xs text-muted-foreground">
                      Current: {{ form.category }}
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

                  <!-- Open Source -->
                  <div class="space-y-2">
                    <Label class="text-sm font-medium">Open Source Status</Label>
                    <p class="text-xs text-muted-foreground mb-2">Does this workflow use only open-source nodes, or does it include API nodes?</p>
                    <div class="flex items-center space-x-4">
                      <label class="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          :value="true"
                          v-model="form.openSource"
                          class="w-4 h-4 text-primary"
                        />
                        <span class="text-sm">Open Source (no API nodes)</span>
                      </label>
                      <label class="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          :value="false"
                          v-model="form.openSource"
                          class="w-4 h-4 text-primary"
                        />
                        <span class="text-sm">Contains API nodes</span>
                      </label>
                    </div>
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

    <!-- Model Links Editor Dialog -->
    <WorkflowModelLinksEditor
      v-model:open="isModelLinksEditorOpen"
      :initial-workflow="workflowContent || updatedWorkflowContent"
      @workflow-updated="handleModelLinksWorkflowUpdated"
    />
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
import CategoryOrderSidebar from '~/components/CategoryOrderSidebar.vue'
import WorkflowModelLinksEditor from '~/components/WorkflowModelLinksEditor.vue'

const route = useRoute()
const templateName = route.params.name as string

// Detect if this is create mode (when name is 'new')
const isCreateMode = computed(() => templateName === 'new')

// Display name for template (used in UI, especially for thumbnails in create mode)
const displayTemplateName = computed(() => {
  if (isCreateMode.value) {
    return form.value.templateName?.trim() || 'template'
  }
  return templateName
})

const {
  selectedRepo,
  selectedBranch,
  canEditCurrentRepo
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
const hasWorkflowChanged = ref<boolean>(false)
const reuploadedInputFiles = ref<Map<string, File>>(new Map())

// Save success state
const saveSuccess = ref<{ commitSha: string; commitUrl: string } | null>(null)
const isCleaningAfterSave = ref(false)

// Thumbnail converter state
const isConverterDialogOpen = ref(false)
const converterTargetIndex = ref<number>(1)
const converterInitialFile = ref<File | null>(null)

// Input file converter state
const isInputAssetConverterOpen = ref(false)
const converterTargetInputFilename = ref<string>('')
const converterIsExistingFile = ref(false)
const workflowFileManagerRef = ref<any>(null)
const categoryOrderSidebarRef = ref<any>(null)

// Model links editor state
const isModelLinksEditorOpen = ref(false)
const modelLinksValidation = ref<{
  totalModels: number
  missingLinks: number
  invalidLinks: number
  customNodeMissingLinks: number
  validating: boolean
} | null>(null)

// Template reordering state
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

const form = ref({
  templateName: '', // For create mode
  title: '',
  description: '',
  category: '',
  thumbnailVariant: 'none',
  tutorialUrl: '',
  tags: [] as string[],
  models: [] as string[],
  comfyuiVersion: '',
  date: '',
  openSource: true // Default to true (open source)
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

// Computed: Check if form fields have changed
const hasFormChanges = computed(() => {
  if (!originalTemplate.value) return false

  return (
    form.value.title !== (originalTemplate.value.title || '') ||
    form.value.description !== (originalTemplate.value.description || '') ||
    form.value.category !== currentCategoryTitle.value ||
    form.value.thumbnailVariant !== (originalTemplate.value.thumbnailVariant || 'none') ||
    form.value.tutorialUrl !== (originalTemplate.value.tutorialUrl || '') ||
    form.value.comfyuiVersion !== (originalTemplate.value.comfyuiVersion || '') ||
    form.value.date !== (originalTemplate.value.date || '') ||
    form.value.openSource !== (originalTemplate.value.openSource !== undefined ? originalTemplate.value.openSource : true) ||
    JSON.stringify(form.value.tags.sort()) !== JSON.stringify((originalTemplate.value.tags || []).sort()) ||
    JSON.stringify(form.value.models.sort()) !== JSON.stringify((originalTemplate.value.models || []).sort())
  )
})

// Computed: Check if template order has changed
const hasOrderChanges = computed(() => {
  // Use both templateOrderChanged flag AND position changes calculation
  // This ensures we detect changes even if user drags items
  return templateOrderChanged.value || templatePositionChanges.value.size > 0
})

// Computed: Check if any changes exist
const hasAnyChanges = computed(() => {
  // In create mode, always return true (all fields are "new")
  if (isCreateMode.value) {
    return true
  }

  return (
    hasFormChanges.value ||
    hasOrderChanges.value ||
    reuploadedThumbnails.value.size > 0 ||
    updatedWorkflowContent.value !== '' ||
    hasWorkflowChanged.value ||
    reuploadedInputFiles.value.size > 0
  )
})

// Computed: Required fields validation
const missingFields = computed(() => {
  const missing: string[] = []

  if (!form.value.title?.trim()) missing.push('Title')
  if (!form.value.description?.trim()) missing.push('Description')
  if (!form.value.category?.trim()) missing.push('Category')

  // In create mode, workflow file is required (which also provides template name)
  if (isCreateMode.value) {
    if (!updatedWorkflowContent.value) {
      missing.push('Workflow File')
    }
    // Also check if template name is valid
    if (!form.value.templateName?.trim()) {
      missing.push('Template Name')
    } else if (!/^[a-zA-Z0-9_\-]+$/.test(form.value.templateName)) {
      missing.push('Valid Template Name')
    }
  }

  // Check if required thumbnails exist
  const requiredCount = requiredThumbnailCount.value
  if (thumbnailFiles.value.length < requiredCount) {
    missing.push(`Thumbnail ${thumbnailFiles.value.length + 1}`)
  }

  return missing
})

// Computed: Completion status
const completionStatus = computed(() => {
  // In create mode: 7 fields (add Workflow), in edit mode: 6 fields
  const totalFields = isCreateMode.value ? 7 : 6
  let completedFields = 0

  if (form.value.title?.trim()) completedFields++
  if (form.value.description?.trim()) completedFields++
  if (form.value.category?.trim()) completedFields++

  // Thumbnails
  const requiredCount = requiredThumbnailCount.value
  if (thumbnailFiles.value.length >= requiredCount) completedFields++

  // Workflow file (required in create mode, auto-extracts template name)
  if (isCreateMode.value) {
    if (updatedWorkflowContent.value) completedFields++
  }

  // Tags (optional but counts toward completion)
  if (form.value.tags.length > 0) completedFields++

  // Models (optional but counts toward completion)
  if (form.value.models.length > 0) completedFields++

  return {
    completed: completedFields,
    total: totalFields,
    percentage: Math.round((completedFields / totalFields) * 100)
  }
})

// Watch for any changes to clear success message
watch(
  () => [
    form.value.title,
    form.value.description,
    form.value.category,
    form.value.thumbnailVariant,
    form.value.tutorialUrl,
    form.value.comfyuiVersion,
    form.value.date,
    form.value.tags.length,
    form.value.models.length,
    reuploadedThumbnails.value.size,
    updatedWorkflowContent.value,
    hasWorkflowChanged.value,
    reuploadedInputFiles.value.size,
    templatePositionChanges.value.size
  ],
  () => {
    // Clear success message when user makes new changes
    // But don't clear if we're just cleaning up after a successful save
    if (saveSuccess.value && !isCleaningAfterSave.value) {
      saveSuccess.value = null
    }
  }
)

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

// Computed: Get current template's thumbnail preview URL
const currentTemplateThumbnailPreview = computed(() => {
  // Check if there's a reuploaded thumbnail
  if (reuploadedThumbnails.value.has(1)) {
    const file = reuploadedThumbnails.value.get(1)
    return URL.createObjectURL(file!)
  }

  // Otherwise use the existing thumbnail preview
  return thumbnailPreviewUrls.value.get(1) || ''
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
  // Also update workflowContent so format changes can be detected on the new workflow
  workflowContent.value = content
  console.log('[Edit Page] Workflow manually updated:', {
    mode: isCreateMode.value ? 'create' : 'edit',
    contentLength: content.length
  })
  // Validate model links when workflow is updated
  validateModelLinks()
}

// Handler for input files updates from WorkflowFileManager
const handleInputFilesUpdated = (files: Map<string, File>) => {
  reuploadedInputFiles.value = files
}

// Handler for template name extracted from workflow filename (create mode only)
const handleTemplateNameExtracted = (name: string) => {
  form.value.templateName = name
  console.log('[Edit Page] Template name extracted from filename:', name)

  // If category is already selected, update the sidebar with new template in first position
  if (form.value.category) {
    updateCategoryTemplatesForCreate()
  }
}

// Handler for opening converter for input files
const handleInputFileConversion = (file: File, targetFilename: string, isExisting: boolean) => {
  converterInitialFile.value = file
  converterTargetInputFilename.value = targetFilename
  converterIsExistingFile.value = isExisting
  isInputAssetConverterOpen.value = true
}

// Debounce timer for validation
let validationTimer: NodeJS.Timeout | null = null

// Validate model links in workflow
const validateModelLinks = async (debounce = false) => {
  const currentWorkflow = workflowContent.value || updatedWorkflowContent.value
  if (!currentWorkflow) {
    modelLinksValidation.value = null
    return
  }

  // Clear existing timer if debouncing
  if (debounce && validationTimer) {
    clearTimeout(validationTimer)
  }

  const runValidation = async () => {
    try {
      modelLinksValidation.value = { totalModels: 0, missingLinks: 0, invalidLinks: 0, customNodeMissingLinks: 0, validating: true }

      // Load config
      const configResponse = await fetch('/workflow-model-config.json')
      const config = await configResponse.json()
      const directoryRules = config.directoryRules
      const customNodeRules = config.customNodeRules || []

      // Parse workflow
      const workflow = JSON.parse(currentWorkflow)

      // Collect all nodes (main + subgraph)
      const nodes: any[] = []
      if (workflow.nodes && Array.isArray(workflow.nodes)) {
        for (const node of workflow.nodes) {
          nodes.push({ ...node, _source: 'main' })
        }
      }
      if (workflow.definitions?.subgraphs) {
        for (const subgraph of workflow.definitions.subgraphs) {
          if (subgraph.nodes && Array.isArray(subgraph.nodes)) {
            for (const node of subgraph.nodes) {
              nodes.push({ ...node, _source: 'subgraph' })
            }
          }
        }
      }

      // Filter model nodes
      const modelNodes = nodes.filter(node => {
        const loaderName = node.properties?.['Node name for S&R']
        return loaderName && directoryRules[loaderName]
      })

      let totalModels = 0
      let missingLinks = 0
      let invalidLinks = 0
      let customNodeMissingLinks = 0

      for (const node of modelNodes) {
        // Check if this is a custom node
        const isCustomNode = customNodeRules.includes(node.type)

        // For custom nodes, just count if links are missing (warning, not error)
        if (isCustomNode) {
          totalModels++
          // Custom nodes don't have embedded model_url, always count as warning
          customNodeMissingLinks++
          continue
        }

        // Check if node has models array (from Model Links Editor)
        const hasModels = node.properties?.models
        if (hasModels && Array.isArray(hasModels) && hasModels.length > 0) {
          for (const model of hasModels) {
            totalModels++
            if (!model.url || model.url.trim() === '') {
              missingLinks++
            } else if (!model.url.includes('http')) {
              invalidLinks++
            }
          }
          continue
        }

        // Check if node has model_url or model_urls in properties (legacy format)
        const hasModelUrl = node.properties?.model_url
        const hasModelUrls = node.properties?.model_urls

        if (hasModelUrl) {
          totalModels++
          if (!hasModelUrl || hasModelUrl.trim() === '') {
            missingLinks++
          } else if (!hasModelUrl.includes('http')) {
            invalidLinks++
          }
        } else if (hasModelUrls && Array.isArray(hasModelUrls)) {
          for (const url of hasModelUrls) {
            totalModels++
            if (!url || url.trim() === '') {
              missingLinks++
            } else if (!url.includes('http')) {
              invalidLinks++
            }
          }
        } else {
          // No model_url property, count as missing
          totalModels++
          missingLinks++
        }
      }

      modelLinksValidation.value = {
        totalModels,
        missingLinks,
        invalidLinks,
        customNodeMissingLinks,
        validating: false
      }
    } catch (error) {
      console.error('[Model Links Validation] Error:', error)
      modelLinksValidation.value = null
    }
  }

  if (debounce) {
    validationTimer = setTimeout(runValidation, 500)
  } else {
    await runValidation()
  }
}

// Handler for opening model links editor
const openModelLinksEditor = () => {
  isModelLinksEditorOpen.value = true
}

// Handler for workflow updated from model links editor
const handleModelLinksWorkflowUpdated = (updatedWorkflow: any) => {
  console.log('[Edit Page] Model links workflow updated')
  // Update the workflow content with the new version that has model links
  const workflowJson = JSON.stringify(updatedWorkflow, null, 2)
  updatedWorkflowContent.value = workflowJson

  // Re-validate immediately with the updated content
  validateModelLinks()
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

  // Check file type - thumbnails must be WebP or Audio
  const isWebP = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')
  const isAudio = file.type.startsWith('audio/')

  // WebP and audio files can be uploaded directly as thumbnails
  if (isWebP || isAudio) {
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
    return
  }

  // For other formats (images/videos not WebP) - auto-open converter to convert to WebP
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
    // In create mode, use updatedWorkflowContent; in edit mode, use workflowContent
    const currentContent = isCreateMode.value
      ? (updatedWorkflowContent.value || workflowContent.value)
      : workflowContent.value

    if (currentContent) {
      const workflow = JSON.parse(currentContent)

      // Find all nodes and update widget values that match old filename
      if (workflow.nodes) {
        let updated = false
        for (const node of workflow.nodes) {
          if (node.widgets_values && Array.isArray(node.widgets_values)) {
            for (let i = 0; i < node.widgets_values.length; i++) {
              if (node.widgets_values[i] === oldFilename) {
                console.log(`[Edit Page] Updating node ${node.id} widget value:`, oldFilename, '→', newFilename)
                node.widgets_values[i] = newFilename
                updated = true
              }
            }
          }
        }

        if (updated) {
          // Update the appropriate content variable based on mode
          const updatedContent = JSON.stringify(workflow, null, 2)

          if (isCreateMode.value) {
            // In create mode, update updatedWorkflowContent
            updatedWorkflowContent.value = updatedContent
            workflowContent.value = updatedContent
            console.log('[Edit Page] [Create Mode] Workflow JSON updated successfully')
          } else {
            // In edit mode, update workflowContent
            workflowContent.value = updatedContent
            hasWorkflowChanged.value = true
            console.log('[Edit Page] [Edit Mode] Workflow JSON updated successfully, hasWorkflowChanged:', hasWorkflowChanged.value)
          }
        } else {
          console.warn('[Edit Page] No matching filename found in workflow')
        }
      }
    } else {
      console.warn('[Edit Page] No workflow content to update')
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

watch(isModelLinksEditorOpen, (isOpen) => {
  if (!isOpen) {
    // Re-validate when dialog is closed (user may have updated links)
    validateModelLinks()
  }
})

// Handle template reorder from sidebar
const handleTemplateReorder = (reorderedTemplates: any[]) => {
  categoryTemplates.value = reorderedTemplates
  templateOrderChanged.value = true
  console.log('[Edit Page] Templates reordered from sidebar')
  console.log('[Edit Page] New order:', reorderedTemplates.map(t => t.name).join(', '))
  console.log('[Edit Page] hasOrderChanges:', hasOrderChanges.value)
}

// Watch for category changes to reload templates
// Update category templates with new template in first position (create mode)
const updateCategoryTemplatesForCreate = async () => {
  if (!isCreateMode.value || !form.value.category || !form.value.templateName) return

  try {
    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'
    const [owner, repoName] = repo.split('/')

    // Reload index.json to get category templates
    const indexUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/index.json`
    const response = await fetch(indexUrl)

    if (!response.ok) {
      console.error('[Create Mode] Failed to load index.json')
      return
    }

    const indexData = await response.json()

    // Find the category
    const categoryData = indexData.find((cat: any) => cat.title === form.value.category)
    if (!categoryData) {
      console.error('[Create Mode] Category not found:', form.value.category)
      return
    }

    // Get existing templates
    const existingTemplates = categoryData.templates || []

    // Create a temporary template object for the new template
    const newTemplate = {
      name: form.value.templateName,
      title: form.value.title || form.value.templateName,
      description: form.value.description || '',
      mediaType: 'image',
      mediaSubtype: 'webp'
    }

    // Add new template at the first position
    categoryTemplates.value = [newTemplate, ...existingTemplates]
    originalCategoryTemplates.value = [...categoryTemplates.value]

    console.log('[Create Mode] Added new template to first position:', form.value.templateName)
  } catch (error) {
    console.error('[Create Mode] Error updating category templates:', error)
  }
}

// Watch for title/description changes in create mode to update sidebar preview
watch([() => form.value.title, () => form.value.description], () => {
  if (!isCreateMode.value || !form.value.templateName || !form.value.category) return

  // Update the first template in categoryTemplates (which is the new template)
  if (categoryTemplates.value.length > 0 && categoryTemplates.value[0].name === form.value.templateName) {
    // Create a new array to trigger reactivity properly
    const updatedTemplates = [...categoryTemplates.value]
    updatedTemplates[0] = {
      ...updatedTemplates[0],
      title: form.value.title || form.value.templateName,
      description: form.value.description || ''
    }
    categoryTemplates.value = updatedTemplates
  }
})

watch(() => form.value.category, async (newCategory, oldCategory) => {
  if (!newCategory || newCategory === oldCategory) return

  // In create mode, add new template to first position
  if (isCreateMode.value) {
    await updateCategoryTemplatesForCreate()
    return
  }

  // In edit mode, just reload the category templates
  try {
    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'
    const [owner, repoName] = repo.split('/')

    // Reload index.json to get new category templates
    // Add timestamp to bypass GitHub CDN cache
    const indexUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/index.json?t=${Date.now()}`
    const response = await fetch(indexUrl)

    if (!response.ok) {
      console.error('[Category Change] Failed to reload index.json')
      return
    }

    const indexData = await response.json()

    // Find the new category
    const newCategoryData = indexData.find((cat: any) => cat.title === newCategory)
    if (!newCategoryData) {
      console.error('[Category Change] New category not found:', newCategory)
      return
    }

    // Update category templates
    categoryTemplates.value = newCategoryData.templates || []
    originalCategoryTemplates.value = [...categoryTemplates.value]

    console.log('[Category Change] Loaded templates for new category:', newCategory, categoryTemplates.value.length)
  } catch (error) {
    console.error('[Category Change] Error reloading templates:', error)
  }
})

onMounted(async () => {
  try {
    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'
    const [owner, repoName] = repo.split('/')

    // Load template metadata from index.json
    // Add timestamp to bypass GitHub CDN cache for newly created templates
    const indexUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/index.json?t=${Date.now()}`
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

    // In create mode, skip loading existing template
    if (isCreateMode.value) {
      console.log('[Create Mode] Skipping template data load')
      loading.value = false
      return
    }

    // Find template and its category (edit mode only)
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
    form.value.openSource = foundTemplate.openSource !== undefined ? foundTemplate.openSource : true

    // Load workflow content
    await loadWorkflowContent(owner, repoName, branch)

    // Validate model links after loading workflow
    if (workflowContent.value) {
      await validateModelLinks()
    }

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
    // Add timestamp to bypass GitHub CDN cache for newly created templates
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/templates/${templateName}.json?t=${Date.now()}`
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
    // Add timestamp to bypass GitHub CDN cache for newly uploaded thumbnails
    const cacheBust = Date.now()
    for (let i = 1; i <= count; i++) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/templates/${templateName}-${i}.${mediaSubtype}?t=${cacheBust}`
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

    // In create mode, workflow is always required
    // In edit mode, only include if workflow was reuploaded or changed
    if (isCreateMode.value || updatedWorkflowContent.value || hasWorkflowChanged.value) {
      // Use updated content if manually reuploaded, otherwise use modified workflowContent
      const contentToSave = updatedWorkflowContent.value || workflowContent.value

      console.log('[Submit] Workflow to save:', {
        isCreateMode: isCreateMode.value,
        manualReupload: !!updatedWorkflowContent.value,
        formatChanged: hasWorkflowChanged.value
      })

      // Create a temporary File object to convert to base64
      const workflowBlob = new Blob([contentToSave], { type: 'application/json' })
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

    // Check if thumbnails were reuploaded (or need to be uploaded in create mode)
    if (reuploadedThumbnails.value.size > 0) {
      filesData.thumbnails = []
      // Use targetTemplateName (which is form.templateName in create mode)
      const targetTemplateName = isCreateMode.value ? form.value.templateName : templateName
      for (const [index, file] of reuploadedThumbnails.value) {
        const thumbnailBase64 = await fileToBase64(file)
        const ext = file.name.split('.').pop() || 'webp'
        filesData.thumbnails.push({
          index,
          content: thumbnailBase64.split(',')[1], // Remove data URL prefix
          filename: `${targetTemplateName}-${index}.${ext}`
        })
      }
    }

    // Prepare new template order if it was changed
    // In create mode: always send order if category is selected (user may have reordered)
    // In edit mode: only send if order was actually changed
    const templateOrder = isCreateMode.value
      ? (form.value.category && categoryTemplates.value.length > 0 ? categoryTemplates.value.map(t => t.name) : undefined)
      : (hasOrderChanges.value ? categoryTemplates.value.map(t => t.name) : undefined)

    console.log('[Submit] Template order changes:', {
      hasOrderChanges: hasOrderChanges.value,
      templateOrderChanged: templateOrderChanged.value,
      positionChanges: templatePositionChanges.value.size,
      willSendOrder: !!templateOrder
    })

    if (templateOrder) {
      console.log('[Submit] Sending template order:', templateOrder.join(', '))
    }

    // Determine which API endpoint to call based on mode
    const apiEndpoint = isCreateMode.value
      ? '/api/github/template/create'
      : '/api/github/template/update'

    // Get the template name (from form in create mode, from route in edit mode)
    const targetTemplateName = isCreateMode.value ? form.value.templateName : templateName

    // Call appropriate API endpoint
    const response = await $fetch(apiEndpoint, {
      method: 'POST',
      body: {
        repo,
        branch,
        templateName: targetTemplateName,
        metadata: {
          title: form.value.title,
          description: form.value.description,
          category: form.value.category,
          thumbnailVariant: form.value.thumbnailVariant,
          tags: form.value.tags,
          models: form.value.models,
          tutorialUrl: form.value.tutorialUrl,
          comfyuiVersion: form.value.comfyuiVersion,
          date: form.value.date,
          openSource: form.value.openSource
        },
        templateOrder,
        files: Object.keys(filesData).length > 0 ? filesData : undefined
      }
    })

    if (response.success) {
      // In create mode, show success message and redirect to homepage
      if (isCreateMode.value) {
        console.log('[Submit] Template created successfully:', response.templateName)

        // Set success state with commit info (to show in UI before redirect)
        saveSuccess.value = {
          commitSha: response.commit.sha,
          commitUrl: response.commit.url
        }

        // Set sessionStorage flag to trigger cache refresh on homepage
        if (process.client) {
          sessionStorage.setItem('template_just_saved', 'true')
          console.log('[Submit] Set template_just_saved flag for cache refresh')
        }

        // Wait 2 seconds to let user see the success message, then redirect to homepage
        setTimeout(() => {
          navigateTo('/', { replace: true })
        }, 2000)
        return
      }

      // Edit mode: Set success state with commit info
      saveSuccess.value = {
        commitSha: response.commit.sha,
        commitUrl: response.commit.url
      }

      // Set sessionStorage flag to trigger cache refresh on homepage
      if (process.client) {
        sessionStorage.setItem('template_just_saved', 'true')
        console.log('[Submit] Set template_just_saved flag for cache refresh')
      }

      // Set flag to prevent watch from clearing saveSuccess during cleanup
      isCleaningAfterSave.value = true

      // Clear reuploaded files status
      reuploadedThumbnails.value.clear()
      updatedWorkflowContent.value = ''
      hasWorkflowChanged.value = false
      reuploadedInputFiles.value.clear()
      thumbnailReuploadStatus.value = null

      // Clear format changes in WorkflowFileManager
      if (workflowFileManagerRef.value) {
        workflowFileManagerRef.value.resetFormatChanges()
      }

      // Update originalTemplate to reflect saved state (to reset change detection)
      if (originalTemplate.value) {
        originalTemplate.value.title = form.value.title
        originalTemplate.value.description = form.value.description
        originalTemplate.value.thumbnailVariant = form.value.thumbnailVariant
        originalTemplate.value.tutorialUrl = form.value.tutorialUrl
        originalTemplate.value.comfyuiVersion = form.value.comfyuiVersion
        originalTemplate.value.date = form.value.date
        originalTemplate.value.tags = [...form.value.tags]
        originalTemplate.value.models = [...form.value.models]
        originalTemplate.value.openSource = form.value.openSource
      }

      // Reset template order changes (computed property will auto-update)
      originalCategoryTemplates.value = [...categoryTemplates.value]
      templateOrderChanged.value = false // Reset the order changed flag

      // Reset sidebar component's original templates
      if (categoryOrderSidebarRef.value) {
        categoryOrderSidebarRef.value.resetOriginalTemplates()
      }

      // Clear flag after cleanup is done
      setTimeout(() => {
        isCleaningAfterSave.value = false
      }, 100)

      console.log('[Submit] Save successful:', response.commit.sha.substring(0, 7))
    }

  } catch (error: any) {
    console.error('Error saving template:', error)

    // Show error message below save button
    saveSuccess.value = null
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
