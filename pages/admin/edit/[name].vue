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

      <!-- Completion Progress Bar / Read-Only Notice -->
      <div class="w-full px-4 py-2" :class="canEditCurrentRepo ? 'bg-muted/30' : 'bg-amber-50 border-t border-amber-200'">
        <div class="container mx-auto">
          <!-- Read-Only Mode Notice -->
          <div v-if="!canEditCurrentRepo" class="flex items-start gap-2">
            <svg class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div class="flex-1">
              <p class="text-xs text-amber-900 font-medium">
                Read-Only Mode: Viewing <span class="font-mono">{{ selectedRepo }}</span> / <span class="font-mono">{{ selectedBranch }}</span>
              </p>
              <p class="text-xs text-amber-700 mt-0.5">
                You cannot edit or save changes on this branch.
              </p>
            </div>
          </div>

          <!-- Completion Progress (Edit Mode) -->
          <div v-if="canEditCurrentRepo">
            <div class="flex items-center justify-between mb-1">
              <div class="text-xs font-medium">
                <span>Required Fields</span>
                <span class="ml-2 text-muted-foreground">
                  {{ completionStatus.completed }}/{{ completionStatus.total }}
                </span>
              </div>
              <div class="text-xs font-semibold" :class="{
                'text-green-600': completionStatus.allRequiredComplete,
                'text-amber-600': completionStatus.percentage >= 50 && !completionStatus.allRequiredComplete,
                'text-red-600': completionStatus.percentage < 50
              }">
                {{ completionStatus.percentage }}%
              </div>
            </div>
            <div class="w-full bg-muted rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all duration-300"
                :class="{
                  'bg-green-500': completionStatus.allRequiredComplete,
                  'bg-amber-500': completionStatus.percentage >= 50 && !completionStatus.allRequiredComplete,
                  'bg-red-500': completionStatus.percentage < 50
                }"
                :style="{ width: `${completionStatus.percentage}%` }"
              ></div>
            </div>

            <!-- Missing Fields Hint -->
            <div v-if="missingFields.length > 0" class="mt-1 text-xs text-red-600">
              ⚠️ Required: {{ missingFields.join(', ') }}
            </div>

            <!-- Encouragement Message for Optional Fields -->
            <div v-else-if="completionStatus.allRequiredComplete && completionStatus.optionalCompleted > 0" class="mt-1 text-xs text-green-600 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span>
                Excellent! All required fields complete + {{ completionStatus.optionalCompleted }} bonus field{{ completionStatus.optionalCompleted > 1 ? 's' : '' }}
                ({{ completionStatus.optionalFields.join(', ') }})
              </span>
            </div>

            <!-- All Required Complete, but No Optional -->
            <div v-else-if="completionStatus.allRequiredComplete" class="mt-1 text-xs text-green-600 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span>All required fields complete! Consider adding optional fields like Tutorial URL, VRAM, or ComfyUI Version.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content with top padding for fixed header + status bar -->
    <div class="pt-[140px]">
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
          @refresh="handleRefreshCategoryOrder"
        />

        <!-- Main Content Area -->
        <div class="flex-1 container mx-auto px-4 py-8 max-w-[1600px]">
          <div class="grid gap-8 lg:grid-cols-3">
            <!-- Left/Middle Column: Workflow + Form -->
            <div class="lg:col-span-2 space-y-6">
              <!-- Workflow File Section with Input Files -->
              <WorkflowFileManager
                ref="workflowFileManagerRef"
                :template-name="templateName"
                :repo="selectedRepo"
                :branch="selectedBranch"
                :workflow-content="workflowContent"
                :category="form.category"
                :model-links-validation="modelLinksValidation"
                @workflow-updated="handleWorkflowUpdated"
                @input-files-updated="handleInputFilesUpdated"
                @open-converter="handleInputFileConversion"
                @format-changed="handleInputFileFormatChange"
                @template-name-extracted="handleTemplateNameExtracted"
                @open-model-links-editor="openModelLinksEditor"
                @custom-nodes-detected="handleCustomNodesDetected"
              />

              <!-- Template Details Form -->
              <div>
            <Card>
              <CardHeader>
                <CardTitle>Template Details</CardTitle>
                <CardDescription>
                  {{ isCreateMode ? 'Create a new template' : 'Edit the template information' }}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form @submit.prevent="() => {}" class="space-y-6">
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
                              <!-- Image preview -->
                              <img
                                v-if="getThumbnailPreview(index) && !isThumbnailAudio(index)"
                                :src="getThumbnailPreview(index)"
                                :alt="getThumbnailLabel(index)"
                                class="w-full h-full object-cover"
                                style="width: 64px; height: 64px;"
                              />
                              <!-- Audio preview - Show icon in small thumbnail -->
                              <div
                                v-else-if="getThumbnailPreview(index) && isThumbnailAudio(index)"
                                class="flex h-full w-full items-center justify-center bg-muted"
                              >
                                <svg class="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              </div>
                              <!-- Empty state -->
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
                    <div class="flex items-center justify-between">
                      <Label for="title" class="flex items-center gap-1">
                        Display Title
                        <span class="text-red-500">*</span>
                      </Label>
                      <AIAssistant
                        field-type="title"
                        field-label="Title"
                        :context="aiContext"
                        :disabled="!canEditCurrentRepo"
                        @suggestion="handleAITitleSuggestion"
                      />
                    </div>
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
                    <div class="flex items-center justify-between">
                      <Label for="description" class="flex items-center gap-1">
                        Description
                        <span class="text-red-500">*</span>
                      </Label>
                      <AIAssistant
                        field-type="description"
                        field-label="Description"
                        :context="aiContext"
                        :disabled="!canEditCurrentRepo"
                        @suggestion="handleAIDescriptionSuggestion"
                      />
                    </div>
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
                    <Label for="date" class="flex items-center gap-1">
                      Date
                      <span class="text-red-500">*</span>
                    </Label>
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
                    <div class="flex items-center justify-between">
                      <Label for="tags" class="flex items-center gap-1">
                        Tags
                        <span class="text-red-500">*</span>
                      </Label>
                      <AIAssistant
                        field-type="tags"
                        field-label="Tags"
                        :context="aiContext"
                        :available-tags="availableTags"
                        :disabled="!canEditCurrentRepo"
                        @suggestion="handleAITagsSuggestion"
                      />
                    </div>

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
                        ref="tagInputRef"
                        id="tags"
                        v-model="tagSearchInput"
                        placeholder="Type to add new tag or select existing..."
                        @keydown.enter.prevent="addCustomTag"
                        @focus="isTagsDropdownOpen = true"
                        @blur="isTagsDropdownOpen = false"
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
                          @mousedown="addCustomTag"
                        >
                          <span class="text-muted-foreground">Press Enter to add:</span>
                          <span class="font-medium ml-1">"{{ tagSearchInput.trim() }}"</span>
                        </div>

                        <!-- Existing tag suggestions -->
                        <div
                          v-for="tag in filteredAvailableTags"
                          :key="tag"
                          class="px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center justify-between"
                          @mousedown="selectTag(tag)"
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
                    <Label for="models" class="flex items-center gap-1">
                      Models
                      <span class="text-red-500">*</span>
                    </Label>

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
                        ref="modelInputRef"
                        id="models"
                        v-model="modelSearchInput"
                        placeholder="Type to add new model or select existing..."
                        @keydown.enter.prevent="addCustomModel"
                        @focus="isModelsDropdownOpen = true"
                        @blur="isModelsDropdownOpen = false"
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
                          @mousedown="addCustomModel"
                        >
                          <span class="text-muted-foreground">Press Enter to add:</span>
                          <span class="font-medium ml-1">"{{ modelSearchInput.trim() }}"</span>
                        </div>

                        <!-- Existing model suggestions -->
                        <div
                          v-for="model in filteredAvailableModels"
                          :key="model"
                          class="px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center justify-between"
                          @mousedown="selectModel(model)"
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

                  <!-- Provider Logos -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between mb-2">
                      <Label class="text-base font-semibold">Provider Logos</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        @click="isLogoManagerOpen = true"
                        class="h-8 text-xs"
                        title="Manage all provider logos"
                      >
                        <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Manage Logos
                      </Button>
                    </div>
                    <LogosEditor
                      v-model="form.logos"
                      :available-providers="availableProviders"
                      :logo-mapping="logoMapping"
                      :repo-base-url="`https://cdn.jsdelivr.net/gh/${selectedRepo}@${selectedBranch}/templates`"
                    />
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

                  <!-- Open Source (Required) -->
                  <div class="space-y-2">
                    <Label class="text-sm font-medium">
                      Open Source Status <span class="text-red-500">*</span>
                    </Label>
                    <p class="text-xs text-muted-foreground mb-2">
                      Required: Does this workflow use only open-source nodes, or does it include API nodes?
                    </p>
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
                    <p v-if="form.openSource === null" class="text-xs text-red-500 mt-1">
                      ⚠️ This field is required. Please select an option.
                    </p>
                  </div>

                  <!-- Platform Distribution -->
                  <div class="space-y-2">
                    <Label class="text-sm font-medium">Platform Availability (optional)</Label>
                    <p class="text-xs text-muted-foreground mb-2">
                      Select which platforms this template should be available on. Leave empty for all platforms.
                    </p>

                    <div class="space-y-2">
                      <label class="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          value="cloud"
                          v-model="form.includeOnDistributions"
                          class="w-4 h-4 text-primary rounded"
                        />
                        <span class="text-sm">Cloud (ComfyUI Cloud)</span>
                      </label>

                      <label class="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          value="desktop"
                          v-model="form.includeOnDistributions"
                          class="w-4 h-4 text-primary rounded"
                        />
                        <span class="text-sm">Desktop (Desktop application)</span>
                      </label>

                      <label class="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          value="local"
                          v-model="form.includeOnDistributions"
                          class="w-4 h-4 text-primary rounded"
                        />
                        <span class="text-sm">Local (Local installations, includes desktop)</span>
                      </label>
                    </div>

                    <p class="text-xs text-muted-foreground mt-2">
                      <span class="font-medium">Note:</span> If no platforms are selected, the template will be available on all platforms.
                    </p>
                  </div>

                  <!-- Required Custom Nodes -->
                  <div class="space-y-2">
                    <Label for="requiresCustomNodes">Required Custom Nodes (optional)</Label>

                    <!-- Selected Custom Nodes Display -->
                    <div v-if="form.requiresCustomNodes.length > 0" class="flex flex-wrap gap-1.5 mb-2 p-2 border rounded-md bg-muted/30">
                      <span
                        v-for="node in form.requiresCustomNodes"
                        :key="node"
                        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-md"
                      >
                        {{ node }}
                        <button
                          type="button"
                          @click="removeCustomNode(node)"
                          class="hover:text-destructive"
                        >
                          ✕
                        </button>
                      </span>
                    </div>

                    <!-- Custom Node Input with Suggestions -->
                    <div class="relative">
                      <Input
                        id="requiresCustomNodes"
                        v-model="customNodeSearchInput"
                        placeholder="Type custom node name and press Enter..."
                        @keydown.enter.prevent="addCustomNode"
                        @focus="isCustomNodesDropdownOpen = true"
                        @blur="() => setTimeout(() => isCustomNodesDropdownOpen = false, 200)"
                      />

                      <!-- Dropdown suggestions -->
                      <div
                        v-if="isCustomNodesDropdownOpen"
                        class="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto"
                      >
                        <!-- Add new custom node option -->
                        <div
                          v-if="customNodeSearchInput.trim()"
                          class="px-3 py-2 text-sm hover:bg-accent cursor-pointer border-b"
                          @mousedown.prevent="addCustomNode"
                        >
                          <span class="text-muted-foreground">Press Enter to add:</span>
                          <span class="font-medium ml-1">"{{ customNodeSearchInput.trim() }}"</span>
                        </div>

                        <!-- Existing custom node suggestions -->
                        <div
                          v-for="node in filteredAvailableCustomNodes"
                          :key="node"
                          class="px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center justify-between"
                          @mousedown.prevent="selectCustomNode(node)"
                        >
                          <span>{{ node }}</span>
                          <span v-if="form.requiresCustomNodes.includes(node)" class="text-primary text-xs">✓</span>
                        </div>

                        <!-- Empty state -->
                        <div
                          v-if="!customNodeSearchInput.trim() && filteredAvailableCustomNodes.length === 0"
                          class="px-3 py-2 text-sm text-muted-foreground text-center"
                        >
                          Type to add custom nodes
                        </div>
                      </div>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      List of custom node packages required to run this workflow (e.g., "comfyui-kjnodes", "comfyui_essentials")
                    </p>
                  </div>

                  <!-- Size and VRAM (GB) -->
                  <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <Label for="sizeGB" class="flex items-center gap-1">
                          Model Size (GB)
                          <span class="text-red-500">*</span>
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          @click="calculateModelSizes"
                          :disabled="calculatingModelSize || !workflowContent"
                          class="text-xs h-7"
                        >
                          <svg v-if="calculatingModelSize" class="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <svg v-else class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {{ calculatingModelSize ? 'Calculating...' : 'Auto Calculate' }}
                        </Button>
                      </div>
                      <Input
                        id="sizeGB"
                        v-model.number="form.sizeGB"
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="Enter model size in GB"
                      />
                      <p class="text-xs text-muted-foreground">
                        Total size of models in GB (can be 0 if no models needed)
                      </p>
                      <!-- Show suggested value in edit mode -->
                      <div v-if="!isCreateMode && modelSizeCalculation.suggested > 0" class="text-xs text-green-600 font-medium">
                        💡 Suggested: {{ modelSizeCalculation.suggested.toFixed(3) }} GB (based on {{ modelSizeCalculation.totalModels }} model{{ modelSizeCalculation.totalModels > 1 ? 's' : '' }})
                      </div>

                      <!-- Individual Model Sizes List (with manual edit) -->
                      <div v-if="modelSizes.length > 0" class="mt-3 space-y-2">
                        <div class="flex items-center justify-between gap-2">
                          <div class="text-xs font-medium text-muted-foreground">
                            Model Details ({{ modelSizes.length }} total)
                          </div>
                          <div class="flex items-center gap-2">
                            <div class="text-xs font-medium text-primary">
                              Auto Total: {{ totalModelSizeFromIndividual.toFixed(3) }} GB
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              @click="applyModelSizeTotal"
                              class="text-xs h-6 px-2"
                            >
                              Apply to Model Size
                            </Button>
                          </div>
                        </div>

                        <div class="border rounded-md max-h-60 overflow-y-auto">
                          <div v-for="(model, index) in modelSizes" :key="model.url" class="border-b last:border-b-0">
                            <div class="px-3 py-2 space-y-1">
                              <!-- Model filename -->
                              <div class="flex items-start justify-between gap-2">
                                <div class="flex-1 min-w-0">
                                  <div class="text-xs font-medium truncate" :title="model.filename">
                                    {{ model.filename }}
                                  </div>
                                  <!-- Repository link for failed models -->
                                  <a
                                    v-if="model.status === 'failed'"
                                    :href="model.repoUrl"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    View Repository
                                  </a>
                                </div>

                                <!-- Size input (editable) -->
                                <div class="flex items-center gap-2">
                                  <Input
                                    v-model.number="model.editableSize"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    class="w-24 h-7 text-xs"
                                    :class="{
                                      'border-amber-500': model.status === 'failed',
                                      'border-green-500': model.status === 'success'
                                    }"
                                    :placeholder="model.status === 'failed' ? 'Enter GB' : '0'"
                                  />
                                  <span class="text-xs text-muted-foreground">GB</span>
                                </div>
                              </div>

                              <!-- Status badge -->
                              <div class="flex items-center gap-1">
                                <span
                                  v-if="model.status === 'success'"
                                  class="inline-flex items-center px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded"
                                >
                                  ✓ Auto-fetched
                                </span>
                                <span
                                  v-else
                                  class="inline-flex items-center px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded"
                                >
                                  ⚠️ Manual input required
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- Instructions -->
                        <p class="text-xs text-muted-foreground">
                          Edit individual model sizes above. Click "Apply to Model Size" or "Apply to VRAM" to use the calculated total.
                        </p>
                      </div>
                    </div>

                    <div class="space-y-2">
                      <Label for="vramGB">VRAM Required (GB, optional)</Label>
                      <Input
                        id="vramGB"
                        v-model.number="form.vramGB"
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="Enter VRAM requirement (optional)"
                      />
                      <p class="text-xs text-muted-foreground">
                        Minimum VRAM needed in GB
                      </p>
                      <!-- Show fake VRAM warning -->
                      <div v-if="form.sizeGB > 0 && form.vramGB > 0 && form.sizeGB === form.vramGB" class="text-xs text-blue-600">
                        ℹ️ VRAM is currently using a placeholder value (same as Model Size). Please update with actual VRAM requirements if known.
                      </div>
                      <!-- Show suggested value in edit mode -->
                      <div v-if="!isCreateMode && modelSizeCalculation.suggested > 0 && form.vramGB !== Math.round(modelSizeCalculation.suggested * 10) / 10" class="text-xs text-green-600 font-medium">
                        💡 Suggested: {{ modelSizeCalculation.suggested.toFixed(3) }} GB (placeholder)
                      </div>
                      <!-- Apply button for calculated total (show if model sizes available) -->
                      <div v-if="modelSizes.length > 0" class="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          @click="applyVramTotal"
                          class="text-xs h-7"
                        >
                          Apply Calculated Total ({{ totalModelSizeFromIndividual.toFixed(3) }} GB)
                        </Button>
                      </div>
                    </div>
                  </div>

                  <!-- Usage Count and Search Rank -->
                  <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                      <Label for="usage">Usage Count (optional)</Label>
                      <Input
                        id="usage"
                        v-model.number="form.usage"
                        type="number"
                        min="0"
                        placeholder="Leave empty if unknown"
                      />
                      <p class="text-xs text-muted-foreground">
                        Number of times this template has been used
                      </p>
                    </div>

                    <div class="space-y-2">
                      <Label for="searchRank">Search Rank (optional)</Label>
                      <Input
                        id="searchRank"
                        v-model.number="form.searchRank"
                        type="number"
                        min="0"
                        placeholder="Leave empty for default"
                      />
                      <p class="text-xs text-muted-foreground">
                        Higher rank = better search visibility
                      </p>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
              </div>
            </div>

            <!-- Right Column: Preview (sticky) -->
            <div class="lg:col-span-1">
              <div class="sticky top-24 space-y-4">
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
                    :logos="form.logos"
                    :logo-mapping="logoMapping"
                    :repo-base-url="`https://cdn.jsdelivr.net/gh/${selectedRepo}@${selectedBranch}/templates`"
                    :tutorial-url="form.tutorialUrl"
                    :filename="templateName"
                    :category="currentCategoryTitle"
                    :media-type="form.mediaType"
                    :media-subtype="form.mediaSubtype"
                    :has-workflow="true"
                    :model-count="form.models.length"
                    :comfyui-version="form.comfyuiVersion"
                    :date="form.date"
                  />
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
      :workflow-filename="`${displayTemplateName}.json`"
      @workflow-updated="handleModelLinksWorkflowUpdated"
    />

    <!-- Logo Manager Dialog -->
    <LogoManager
      v-model:open="isLogoManagerOpen"
      :logo-mapping="logoMapping"
      :repo-base-url="`https://cdn.jsdelivr.net/gh/${selectedRepo}@${selectedBranch}/templates`"
      :repo="selectedRepo"
      :branch="selectedBranch"
      @refresh="handleLogoManagerRefresh"
    />

    <!-- Main Branch Warning Dialog -->
    <MainBranchWarningDialog
      v-model:open="showMainBranchWarning"
      :repo="selectedRepo"
      :branch="selectedBranch"
      :timing="warningTiming"
      action-type="Commit"
      @confirm="handleConfirmMainBranchSubmit"
      @cancel="handleCancelMainBranchSubmit"
    />
  </div>
  <!-- Close min-h-screen container -->
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
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
import AIAssistant from '~/components/AIAssistant.vue'
import LogosEditor from '~/components/LogosEditor.vue'
import LogoManager from '~/components/LogoManager.vue'
import MainBranchWarningDialog from '~/components/MainBranchWarningDialog.vue'
import { calculateWorkflowModelSizes, type ModelSizeDetail } from '~/lib/utils'

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

// Main branch warning dialog state
const showMainBranchWarning = ref(false)
const pendingSubmit = ref(false)
const warningTiming = ref<'opening' | 'saving'>('opening')

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

// Model size calculation state
const calculatingModelSize = ref(false)
const modelSizeCalculation = ref<{
  suggested: number // Suggested size in GB
  failedModels: string[] // List of model filenames that failed to fetch
  totalModels: number // Total number of models found
}>({
  suggested: 0,
  failedModels: [],
  totalModels: 0
})

// Individual model sizes (editable by user)
const modelSizes = ref<Array<ModelSizeDetail & { editableSize: number | null }>>([])

// Computed: Auto-calculate total size from individual model sizes (keep 3 decimals for display)
const totalModelSizeFromIndividual = computed(() => {
  const total = modelSizes.value.reduce((sum, model) => {
    const size = model.editableSize ?? model.sizeGB ?? 0
    return sum + size
  }, 0)
  return Math.round(total * 1000) / 1000 // Keep 3 decimals for display
})

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
  mediaType: 'image' as string, // Media type: image, video, audio
  mediaSubtype: 'webp' as string, // Media subtype: webp, mp3, mp4, etc.
  tutorialUrl: '',
  tags: [] as string[],
  models: [] as string[],
  logos: [] as Array<{
    provider: string | string[]
    label?: string
    gap?: number
    position?: string
    opacity?: number
  }>,
  requiresCustomNodes: [] as string[],
  comfyuiVersion: '',
  date: '',
  openSource: null as boolean | null, // Required field, no default selection
  includeOnDistributions: [] as string[], // Platform availability: ['cloud', 'desktop', 'local'] or empty for all
  sizeGB: null as number | null, // Size in GB (will be converted to bytes when saving), null means not filled yet
  vramGB: null as number | null, // VRAM in GB (optional, null means not filled)
  usage: null as number | null, // Usage count (optional, null means not filled)
  searchRank: null as number | null // Search rank (optional, null means not filled)
})

const availableCategories = ref<Array<{ moduleName: string; title: string }>>([])
const availableTags = ref<string[]>([])
const availableModels = ref<string[]>([])
const availableCustomNodes = ref<string[]>([])
const availableProviders = ref<string[]>([])
const logoMapping = ref<Record<string, string>>({})
const tagSearchInput = ref('')
const modelSearchInput = ref('')
const customNodeSearchInput = ref('')
const isTagsDropdownOpen = ref(false)
const isModelsDropdownOpen = ref(false)
const isCustomNodesDropdownOpen = ref(false)
const isLogoManagerOpen = ref(false)

// Refs for input elements
const tagInputRef = ref<HTMLInputElement | null>(null)
const modelInputRef = ref<HTMLInputElement | null>(null)

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

// Computed: Filter available custom nodes based on search
const filteredAvailableCustomNodes = computed(() => {
  const searchLower = customNodeSearchInput.value.toLowerCase()
  return availableCustomNodes.value.filter(node =>
    node.toLowerCase().includes(searchLower)
  )
})

// Select existing tag from dropdown
const selectTag = (tag: string) => {
  if (!form.value.tags.includes(tag)) {
    form.value.tags.push(tag)
  }
  tagSearchInput.value = ''
  // Immediately refocus input to keep dropdown open
  if (tagInputRef.value) {
    tagInputRef.value.focus()
  }
}

// Add custom tag (when pressing Enter)
const addCustomTag = () => {
  const tag = tagSearchInput.value.trim()
  if (tag && !form.value.tags.includes(tag)) {
    form.value.tags.push(tag)
  }
  tagSearchInput.value = ''
  // When pressing Enter, input is already focused, just need to keep it open
  if (tagInputRef.value) {
    tagInputRef.value.focus()
  }
}

// Remove a tag from the selection
const removeTag = (tag: string) => {
  form.value.tags = form.value.tags.filter(t => t !== tag)
}

// AI Assistant Handlers
const handleAITagsSuggestion = (suggestion: string | string[]) => {
  if (Array.isArray(suggestion)) {
    // Add new tags from AI (avoiding duplicates)
    suggestion.forEach(tag => {
      if (!form.value.tags.includes(tag)) {
        form.value.tags.push(tag)
      }
    })
    console.log('[AI Tags] Added tags:', suggestion)
  }
}

const handleAITitleSuggestion = (suggestion: string | string[]) => {
  if (typeof suggestion === 'string') {
    form.value.title = suggestion
    console.log('[AI Title] Updated title:', suggestion)
  }
}

const handleAIDescriptionSuggestion = (suggestion: string | string[]) => {
  if (typeof suggestion === 'string') {
    form.value.description = suggestion
    console.log('[AI Description] Updated description:', suggestion)
  }
}

// Computed: Context for AI assistant
const aiContext = computed(() => ({
  title: form.value.title,
  description: form.value.description,
  tags: form.value.tags,
  models: form.value.models
}))

// Select existing model from dropdown
const selectModel = (model: string) => {
  if (!form.value.models.includes(model)) {
    form.value.models.push(model)
  }
  modelSearchInput.value = ''
  // Immediately refocus input to keep dropdown open
  if (modelInputRef.value) {
    modelInputRef.value.focus()
  }
}

// Add custom model (when pressing Enter)
const addCustomModel = () => {
  const model = modelSearchInput.value.trim()
  if (model && !form.value.models.includes(model)) {
    form.value.models.push(model)
  }
  modelSearchInput.value = ''
  // When pressing Enter, input is already focused, just need to keep it open
  if (modelInputRef.value) {
    modelInputRef.value.focus()
  }
}

// Remove a model from the selection
const removeModel = (model: string) => {
  form.value.models = form.value.models.filter(m => m !== model)
}

// Select existing custom node from dropdown
const selectCustomNode = (node: string) => {
  if (!form.value.requiresCustomNodes.includes(node)) {
    form.value.requiresCustomNodes.push(node)
  }
  customNodeSearchInput.value = ''
  isCustomNodesDropdownOpen.value = false
}

// Add custom node (when pressing Enter)
const addCustomNode = () => {
  const node = customNodeSearchInput.value.trim()
  if (node && !form.value.requiresCustomNodes.includes(node)) {
    form.value.requiresCustomNodes.push(node)
  }
  customNodeSearchInput.value = ''
  isCustomNodesDropdownOpen.value = false
}

// Remove a custom node from the selection
const removeCustomNode = (node: string) => {
  form.value.requiresCustomNodes = form.value.requiresCustomNodes.filter(n => n !== node)
}

// Calculate model sizes from workflow
const calculateModelSizes = async () => {
  const currentWorkflow = workflowContent.value || updatedWorkflowContent.value
  if (!currentWorkflow) {
    console.warn('[Model Size Calculator] No workflow content available')
    return
  }

  calculatingModelSize.value = true

  try {
    const result = await calculateWorkflowModelSizes(currentWorkflow)

    // Update calculation result
    modelSizeCalculation.value = {
      suggested: result.totalGB,
      failedModels: result.failedUrls,
      totalModels: result.successCount + result.failedUrls.length
    }

    // Update individual model sizes with editable field
    modelSizes.value = result.models.map(model => ({
      ...model,
      editableSize: model.sizeGB // Initialize with fetched size (or null if failed)
    }))

    // Don't auto-update form values - user must click Apply button
    console.log('[Model Size Calculator] Calculated:', result.totalGB, 'GB')

    if (result.failedUrls.length > 0) {
      console.warn('[Model Size Calculator] Failed to fetch', result.failedUrls.length, 'models:', result.failedUrls)
    }
  } catch (error) {
    console.error('[Model Size Calculator] Error:', error)
    modelSizeCalculation.value = {
      suggested: 0,
      failedModels: [],
      totalModels: 0
    }
    modelSizes.value = []
  } finally {
    calculatingModelSize.value = false
  }
}

// Update total model size when user edits individual sizes (keep 3 decimals in form)
const updateTotalFromIndividual = () => {
  // Keep 3 decimals in the form field (rounding only happens when saving to index.json)
  form.value.sizeGB = totalModelSizeFromIndividual.value
}

// Apply calculated model size total to Model Size field
const applyModelSizeTotal = () => {
  form.value.sizeGB = totalModelSizeFromIndividual.value
  console.log('[Apply] Model Size updated to:', totalModelSizeFromIndividual.value, 'GB')
}

// Apply calculated model size total to VRAM field
const applyVramTotal = () => {
  form.value.vramGB = totalModelSizeFromIndividual.value
  console.log('[Apply] VRAM updated to:', totalModelSizeFromIndividual.value, 'GB')
}

// Utility: Convert bytes to GB
const bytesToGB = (bytes: number): number => {
  if (!bytes || bytes === 0) return 0
  return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10 // Round to 1 decimal place
}

// Utility: Convert GB to bytes
const gbToBytes = (gb: number | null): number => {
  if (gb === null || gb === undefined) return 0
  if (gb === 0) return 0
  return Math.round(gb * 1024 * 1024 * 1024)
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
    // Compare rounded values (1 decimal) to match what's saved in index.json
    gbToBytes(form.value.sizeGB !== null ? Math.round(form.value.sizeGB * 10) / 10 : null) !== (originalTemplate.value.size || 0) ||
    gbToBytes(form.value.vramGB !== null ? Math.round(form.value.vramGB * 10) / 10 : null) !== (originalTemplate.value.vram || 0) ||
    (form.value.usage ?? 0) !== (originalTemplate.value.usage || 0) ||
    (form.value.searchRank ?? 0) !== (originalTemplate.value.searchRank || 0) ||
    JSON.stringify(form.value.tags.sort()) !== JSON.stringify((originalTemplate.value.tags || []).sort()) ||
    JSON.stringify(form.value.models.sort()) !== JSON.stringify((originalTemplate.value.models || []).sort()) ||
    JSON.stringify(form.value.requiresCustomNodes.sort()) !== JSON.stringify((originalTemplate.value.requiresCustomNodes || []).sort()) ||
    JSON.stringify(form.value.includeOnDistributions.sort()) !== JSON.stringify((originalTemplate.value.includeOnDistributions || []).sort())
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

  // Required: Tags (at least one)
  if (form.value.tags.length === 0) {
    missing.push('Tags')
  }

  // Required: Models (at least one)
  if (form.value.models.length === 0) {
    missing.push('Models')
  }

  // Required: Date
  if (!form.value.date?.trim()) {
    missing.push('Date')
  }

  // Required: Model Size (null means not filled yet, 0 is acceptable if explicitly set)
  if (form.value.sizeGB === null || form.value.sizeGB === undefined) {
    missing.push('Model Size')
  }

  // Required: Open Source Status
  if (form.value.openSource === null || form.value.openSource === undefined) {
    missing.push('Open Source Status')
  }

  return missing
})

// Computed: Completion status with required vs optional fields
const completionStatus = computed(() => {
  // Required fields count
  // In create mode: 10 required (title, description, category, thumbnails, workflow, tags, models, date, sizeGB, openSource)
  // In edit mode: 9 required (same but no workflow)
  const totalRequired = isCreateMode.value ? 10 : 9
  let completedRequired = 0

  // Required fields
  if (form.value.title?.trim()) completedRequired++
  if (form.value.description?.trim()) completedRequired++
  if (form.value.category?.trim()) completedRequired++

  // Thumbnails (required)
  const requiredCount = requiredThumbnailCount.value
  if (thumbnailFiles.value.length >= requiredCount) completedRequired++

  // Workflow file (required in create mode only)
  if (isCreateMode.value) {
    if (updatedWorkflowContent.value) completedRequired++
  }

  // Tags (now required)
  if (form.value.tags.length > 0) completedRequired++

  // Models (now required)
  if (form.value.models.length > 0) completedRequired++

  // Date (now required)
  if (form.value.date?.trim()) completedRequired++

  // Model Size (now required, null means not filled, 0 is acceptable)
  if (form.value.sizeGB !== null && form.value.sizeGB !== undefined) completedRequired++

  // Open Source Status (now required)
  if (form.value.openSource !== null && form.value.openSource !== undefined) completedRequired++

  // Optional fields
  let completedOptional = 0
  const optionalFields = []

  if (form.value.tutorialUrl?.trim()) {
    completedOptional++
    optionalFields.push('Tutorial URL')
  }
  if (form.value.vramGB && form.value.vramGB > 0) {
    completedOptional++
    optionalFields.push('VRAM')
  }
  if (form.value.comfyuiVersion?.trim()) {
    completedOptional++
    optionalFields.push('ComfyUI Version')
  }
  if (form.value.requiresCustomNodes.length > 0) {
    completedOptional++
    optionalFields.push('Custom Nodes')
  }
  if (form.value.includeOnDistributions.length > 0) {
    completedOptional++
    optionalFields.push('Platform Availability')
  }

  const allRequiredComplete = completedRequired === totalRequired

  return {
    completed: completedRequired,
    total: totalRequired,
    percentage: Math.round((completedRequired / totalRequired) * 100),
    allRequiredComplete,
    optionalCompleted: completedOptional,
    optionalFields
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
    form.value.logos.length,
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
            // Use correct MIME type based on file extension
            const correctMimeType = getMimeTypeFromExtension(mediaSubtype)
            const file = new File([blob], `${templateName}-${i}.${mediaSubtype}`, { type: correctMimeType })

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

// Check if thumbnail is audio file
const isThumbnailAudio = (index: number): boolean => {
  // Check reuploaded files first
  if (reuploadedThumbnails.value.has(index)) {
    const file = reuploadedThumbnails.value.get(index)
    return file?.type.startsWith('audio/') || false
  }

  // Check loaded files
  const file = thumbnailFiles.value[index - 1]
  return file?.type.startsWith('audio/') || false
}

// Get MIME type from file extension
const getMimeTypeFromExtension = (extension: string): string => {
  const ext = extension.toLowerCase()
  const mimeTypes: Record<string, string> = {
    // Images
    'webp': 'image/webp',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// Auto-detect mediaType and mediaSubtype from thumbnail file
const detectMediaTypeFromFile = (file: File): { mediaType: string; mediaSubtype: string } => {
  const mimeType = file.type
  console.log('[detectMediaType] File:', file.name, 'MIME:', mimeType)

  // Extract main type and subtype from MIME type (e.g., "image/webp" -> "image", "webp")
  const [mainType, subType] = mimeType.split('/')
  console.log('[detectMediaType] Parsed:', { mainType, subType })

  // Map MIME types to our mediaType categories
  let mediaType = 'image' // default
  if (mainType === 'audio') {
    mediaType = 'audio'
  } else if (mainType === 'video') {
    mediaType = 'video'
  } else if (mainType === 'image') {
    mediaType = 'image'
  }

  // Get file extension from filename as fallback
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'webp'

  // Use subType from MIME or file extension
  const mediaSubtype = subType || fileExtension

  console.log('[detectMediaType] Result:', { mediaType, mediaSubtype })
  return { mediaType, mediaSubtype }
}

// Update form mediaType/mediaSubtype when thumbnail is uploaded
const updateMediaTypeFromThumbnail = () => {
  // Check if we have any thumbnail files
  const firstThumbnail = thumbnailFiles.value[0] || reuploadedThumbnails.value.get(1)

  if (!firstThumbnail) {
    console.log('[Media Type] No thumbnail found, keeping current values:', {
      mediaType: form.value.mediaType,
      mediaSubtype: form.value.mediaSubtype
    })
    return
  }

  const oldMediaType = form.value.mediaType
  const oldMediaSubtype = form.value.mediaSubtype

  const { mediaType, mediaSubtype } = detectMediaTypeFromFile(firstThumbnail)

  // Only update if values changed
  if (oldMediaType !== mediaType || oldMediaSubtype !== mediaSubtype) {
    form.value.mediaType = mediaType
    form.value.mediaSubtype = mediaSubtype
    console.log(`[Media Type] Updated: ${oldMediaType}/${oldMediaSubtype} → ${mediaType}/${mediaSubtype}`)
  } else {
    console.log(`[Media Type] No change needed: ${mediaType}/${mediaSubtype}`)
  }
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

  // Auto-calculate model sizes when workflow is uploaded
  // Run in background to avoid blocking
  setTimeout(() => {
    calculateModelSizes()
  }, 100)
}

// Handler for input files updates from WorkflowFileManager
const handleInputFilesUpdated = (files: Map<string, File>) => {
  reuploadedInputFiles.value = files
}

// Handler for custom nodes detected from workflow
const handleCustomNodesDetected = (customNodes: string[]) => {
  console.log('[Edit Page] Custom nodes detected from workflow:', customNodes)
  // Merge with existing custom nodes, avoiding duplicates
  const existingNodes = new Set(form.value.requiresCustomNodes)
  customNodes.forEach(node => existingNodes.add(node))
  form.value.requiresCustomNodes = Array.from(existingNodes).sort()
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

      // Load config from API endpoint
      const configResponse = await fetch('/api/config/workflow-model-config.json')
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

    // Auto-detect and update mediaType/mediaSubtype
    const oldMediaType = form.value.mediaType
    const oldMediaSubtype = form.value.mediaSubtype
    updateMediaTypeFromThumbnail()

    let message = `✓ ${getThumbnailLabel(index)} updated: ${file.name} (${formatFileSize(file.size)})`

    // Add media type change notification if it changed
    if (oldMediaType !== form.value.mediaType || oldMediaSubtype !== form.value.mediaSubtype) {
      message += ` | Media type auto-updated: ${form.value.mediaType}/${form.value.mediaSubtype}`
    }

    message += '. Click "Save Changes" to apply.'

    thumbnailReuploadStatus.value = {
      success: true,
      message
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

  // Auto-detect and update mediaType/mediaSubtype
  const oldMediaType = form.value.mediaType
  const oldMediaSubtype = form.value.mediaSubtype
  updateMediaTypeFromThumbnail()

  // Clear initial file and close dialog
  converterInitialFile.value = null
  isConverterDialogOpen.value = false

  let message = `✓ ${getThumbnailLabel(index)} converted: ${file.name} (${formatFileSize(file.size)})`

  // Add media type change notification if it changed
  if (oldMediaType !== form.value.mediaType || oldMediaSubtype !== form.value.mediaSubtype) {
    message += ` | Media type auto-updated: ${form.value.mediaType}/${form.value.mediaSubtype}`
  }

  message += '. Click "Save Changes" to apply.'

  // Show success message
  thumbnailReuploadStatus.value = {
    success: true,
    message
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
  const oldOrder = categoryTemplates.value.map(t => t.name)
  const newOrder = reorderedTemplates.map(t => t.name)

  categoryTemplates.value = reorderedTemplates
  templateOrderChanged.value = true

  console.log('[Edit Page] Templates reordered from sidebar')
  console.log('[Edit Page] Old order:', oldOrder.join(', '))
  console.log('[Edit Page] New order:', newOrder.join(', '))
  console.log('[Edit Page] Original order:', originalCategoryTemplates.value.map(t => t.name).join(', '))
  console.log('[Edit Page] hasOrderChanges:', hasOrderChanges.value)
  console.log('[Edit Page] templateOrderChanged:', templateOrderChanged.value)
  console.log('[Edit Page] templatePositionChanges size:', templatePositionChanges.value.size)
}

// Handle refresh category order (clear cache and reload from GitHub)
const handleRefreshCategoryOrder = async () => {
  if (!form.value.category) {
    console.warn('[Edit Page] Cannot refresh: no category selected')
    return
  }

  console.log('[Edit Page] Refreshing category order from GitHub...')

  try {
    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
    const branch = selectedBranch.value || 'main'

    console.log('[Edit Page] Fetching fresh index.json via API:', { repo, branch })

    // Use server-side API to bypass CORS
    const response = await $fetch('/api/github/index/fresh', {
      query: {
        repo,
        branch
      }
    })

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch fresh index.json')
    }

    const indexData = response.data

    // Find the current category
    const categoryData = indexData.find((cat: any) => cat.title === form.value.category)
    if (!categoryData) {
      console.error('[Edit Page] Category not found after refresh:', form.value.category)
      alert(`Category "${form.value.category}" not found in refreshed data`)
      return
    }

    const refreshedTemplates = categoryData.templates || []

    // Update category templates with refreshed data
    categoryTemplates.value = refreshedTemplates
    originalCategoryTemplates.value = [...refreshedTemplates]

    // Reset order change flags
    templateOrderChanged.value = false

    // Update sidebar component's original templates
    if (categoryOrderSidebarRef.value) {
      categoryOrderSidebarRef.value.resetOriginalTemplates()
    }

    console.log('[Edit Page] ✓ Category order refreshed successfully')
    console.log('[Edit Page] Loaded', refreshedTemplates.length, 'templates')
    console.log('[Edit Page] New order:', refreshedTemplates.map((t: any) => t.name).join(', '))

    // Show success message
    alert(`✅ Order refreshed!\nLoaded ${refreshedTemplates.length} templates from GitHub.`)
  } catch (error: any) {
    console.error('[Edit Page] Failed to refresh category order:', error)
    alert(`❌ Failed to refresh order:\n\n${error.message || 'Unknown error'}`)
  }
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
      mediaType: form.value.mediaType,
      mediaSubtype: form.value.mediaSubtype
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

  // In edit mode, reload the category templates and add current template
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

    // Find if current template already exists in the new category
    const currentTemplateName = route.params.name as string
    const templateExistsIndex = categoryTemplates.value.findIndex((t: any) => t.name === currentTemplateName)

    if (templateExistsIndex === -1) {
      // Current template doesn't exist in new category, add it
      // Create a temporary template object with current form data
      const currentTemplate = {
        name: currentTemplateName,
        title: form.value.title || currentTemplateName,
        description: form.value.description || '',
        thumbnailVariant: form.value.thumbnailVariant === 'none' ? undefined : form.value.thumbnailVariant,
        tags: form.value.tags || [],
        models: form.value.models || [],
        requiresCustomNodes: form.value.requiresCustomNodes?.length ? form.value.requiresCustomNodes : undefined,
        tutorialUrl: form.value.tutorialUrl || undefined,
        comfyuiVersion: form.value.comfyuiVersion || undefined,
        date: form.value.date || undefined,
        openSource: form.value.openSource,
        includeOnDistributions: form.value.includeOnDistributions?.length ? form.value.includeOnDistributions : undefined,
        // Round to 1 decimal before converting to bytes for storage (same as submit logic)
        size: gbToBytes(form.value.sizeGB !== null ? Math.round(form.value.sizeGB * 10) / 10 : null),
        vram: gbToBytes(form.value.vramGB !== null ? Math.round(form.value.vramGB * 10) / 10 : null),
        usage: form.value.usage ?? 0,
        searchRank: form.value.searchRank ?? 0
      }

      // Add current template to the end of the list
      categoryTemplates.value.push(currentTemplate)
      console.log('[Category Change] Added current template to new category:', currentTemplateName)
    } else {
      console.log('[Category Change] Current template already exists in new category at index:', templateExistsIndex)
    }

    originalCategoryTemplates.value = [...categoryTemplates.value]

    console.log('[Category Change] Loaded templates for new category:', newCategory, categoryTemplates.value.length)
  } catch (error) {
    console.error('[Category Change] Error reloading templates:', error)
  }
})

// Load logo configuration from index_logo.json
const loadLogoConfiguration = async (owner: string, repoName: string, branch: string) => {
  try {
    // Add timestamp to bypass cache
    const logoUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/index_logo.json?t=${Date.now()}`
    const logoResponse = await fetch(logoUrl)
    if (logoResponse.ok) {
      const logoData = await logoResponse.json()
      logoMapping.value = logoData
      availableProviders.value = Object.keys(logoData).sort()
      console.log('[Edit Page] Loaded logo providers:', availableProviders.value.length)
    }
  } catch (err) {
    console.warn('[Edit Page] Failed to load index_logo.json:', err)
  }
}

// Refresh logo data (called after Logo Manager saves)
const handleLogoManagerRefresh = async () => {
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'
  const [owner, repoName] = repo.split('/')
  await loadLogoConfiguration(owner, repoName, branch)
  console.log('[Logo Manager] Refreshed logo data')
}

// Watch for permission changes (both create and edit modes)
watch(canEditCurrentRepo, async (hasPermission) => {
  if (!hasPermission) {
    const errorType = isCreateMode.value ? 'no_permission_create' : 'no_permission_edit'
    console.warn(`[Edit Page] Permission lost for ${isCreateMode.value ? 'create' : 'edit'} mode, redirecting to home`)
    await navigateTo(`/?error=${errorType}`)
  }
})

onMounted(async () => {
  // Check permissions for both create and edit modes
  if (!canEditCurrentRepo.value) {
    const errorType = isCreateMode.value ? 'no_permission_create' : 'no_permission_edit'
    console.warn(`[Edit Page] No permission to ${isCreateMode.value ? 'create' : 'edit'} templates on this branch, redirecting to home`)
    await navigateTo(`/?error=${errorType}`)
    return
  }

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

      // Get all unique tags, models, and custom nodes
      const tagsSet = new Set<string>()
      const modelsSet = new Set<string>()
      const customNodesSet = new Set<string>()
      for (const category of indexData) {
        for (const template of category.templates || []) {
          if (template.tags && Array.isArray(template.tags)) {
            template.tags.forEach((tag: string) => tagsSet.add(tag))
          }
          if (template.models && Array.isArray(template.models)) {
            template.models.forEach((model: string) => modelsSet.add(model))
          }
          if (template.requiresCustomNodes && Array.isArray(template.requiresCustomNodes)) {
            template.requiresCustomNodes.forEach((node: string) => customNodesSet.add(node))
          }
        }
      }
      availableTags.value = Array.from(tagsSet).sort()
      availableModels.value = Array.from(modelsSet).sort()
      availableCustomNodes.value = Array.from(customNodesSet).sort()
    }

    // Load logo configuration from index_logo.json
    await loadLogoConfiguration(owner, repoName, branch)

    // In create mode, skip loading existing template
    if (isCreateMode.value) {
      console.log('[Create Mode] Skipping template data load')
      // Set default date to current date (YYYY-MM-DD)
      form.value.date = new Date().toISOString().split('T')[0]
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
            templateCount: foundCategoryTemplates.length,
            // Debug: Check size/vram values immediately after finding template
            templateSize: found.size,
            templateVram: found.vram,
            hasSizeField: 'size' in found,
            hasVramField: 'vram' in found
          })
          break
        }
      }
    }

    if (!foundTemplate) {
      // Template not found - might be a newly created template where GitHub cache hasn't updated yet
      // Try one more time with a delay and force refresh
      console.warn(`[Edit Page] Template "${templateName}" not found on first load, retrying in 2s...`)

      // Wait 2 seconds for GitHub to update
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Retry loading with force refresh (stronger cache-busting)
      try {
        console.log('[Edit Page] Retrying template load...')
        const retryUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/templates/index.json?nocache=${Date.now()}&r=${Math.random()}`
        const retryResponse = await fetch(retryUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })

        if (retryResponse.ok) {
          const retryIndexData = await retryResponse.json()

          // Search again in retry data
          if (Array.isArray(retryIndexData)) {
            for (const category of retryIndexData) {
              const found = category.templates?.find((t: any) => t.name === templateName)
              if (found) {
                foundTemplate = found
                foundCategoryTitle = category.title
                foundCategoryTemplates = category.templates || []
                console.log('[Edit Page] ✓ Template found on retry!')
                break
              }
            }
          }
        }
      } catch (retryError) {
        console.error('[Edit Page] Retry failed:', retryError)
      }

      // If still not found after retry, show error
      if (!foundTemplate) {
        throw new Error(`Template "${templateName}" not found. If you just created this template, please wait a moment and refresh the page.`)
      }
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
    form.value.mediaType = foundTemplate.mediaType || 'image'
    form.value.mediaSubtype = foundTemplate.mediaSubtype || 'webp'
    form.value.tutorialUrl = foundTemplate.tutorialUrl || ''
    form.value.tags = foundTemplate.tags || []
    form.value.models = foundTemplate.models || []
    // Load logos and add UI state (isStacked, showAdvanced)
    form.value.logos = (foundTemplate.logos || []).map((logo: any) => ({
      ...logo,
      isStacked: Array.isArray(logo.provider) ? 'stacked' : 'single',
      showAdvanced: false // Default to collapsed
    }))
    form.value.requiresCustomNodes = foundTemplate.requiresCustomNodes || []
    form.value.comfyuiVersion = foundTemplate.comfyuiVersion || ''
    form.value.date = foundTemplate.date || ''
    form.value.openSource = foundTemplate.openSource !== undefined ? foundTemplate.openSource : true
    form.value.includeOnDistributions = foundTemplate.includeOnDistributions || []
    // Convert bytes to GB for display (use !== undefined to preserve 0 values)
    console.log('[Load Template] Size/VRAM values from index.json:', {
      size: foundTemplate.size,
      vram: foundTemplate.vram,
      sizeType: typeof foundTemplate.size,
      vramType: typeof foundTemplate.vram,
      sizeIsUndefined: foundTemplate.size === undefined,
      vramIsUndefined: foundTemplate.vram === undefined
    })
    form.value.sizeGB = foundTemplate.size !== undefined ? bytesToGB(foundTemplate.size) : null
    form.value.vramGB = foundTemplate.vram !== undefined ? bytesToGB(foundTemplate.vram) : null
    console.log('[Load Template] Converted to GB:', {
      sizeGB: form.value.sizeGB,
      vramGB: form.value.vramGB
    })
    form.value.usage = foundTemplate.usage !== undefined ? foundTemplate.usage : null
    form.value.searchRank = foundTemplate.searchRank !== undefined ? foundTemplate.searchRank : null

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
          // Use correct MIME type based on file extension, not blob.type
          const correctMimeType = getMimeTypeFromExtension(mediaSubtype)
          const file = new File([blob], `${templateName}-${i}.${mediaSubtype}`, { type: correctMimeType })
          console.log(`[loadThumbnails] Created file ${i}:`, file.name, 'type:', file.type)
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

    // Auto-detect and update mediaType/mediaSubtype after loading thumbnails
    if (files.length > 0) {
      updateMediaTypeFromThumbnail()
    }
  } catch (err) {
    console.error('Error loading thumbnails:', err)
  }
}

// Handle main branch warning confirmation
const handleConfirmMainBranchSubmit = () => {
  showMainBranchWarning.value = false
  pendingSubmit.value = true
  // Trigger submit again with confirmation
  handleSubmit()
}

// Handle main branch warning cancellation
const handleCancelMainBranchSubmit = () => {
  showMainBranchWarning.value = false
  pendingSubmit.value = false

  // If user cancels on opening warning, go back to homepage
  if (warningTiming.value === 'opening') {
    navigateTo('/')
  }
}

const handleSubmit = async () => {
  if (isSubmitting.value) return

  // Check if committing to main branch and show warning if needed
  const branch = selectedBranch.value || 'main'
  const isMainBranch = branch === 'main' || branch === 'master'

  // If on main branch and haven't confirmed yet, show warning dialog
  if (isMainBranch && !pendingSubmit.value) {
    warningTiming.value = 'saving'
    showMainBranchWarning.value = true
    return
  }

  // Reset pending submit flag after proceeding
  pendingSubmit.value = false

  // Auto-detect and fix mediaType/mediaSubtype before saving
  // This ensures previously incorrect values are corrected
  console.log('[Save] Validating mediaType/mediaSubtype before save...')
  updateMediaTypeFromThumbnail()
  console.log('[Save] Current mediaType/mediaSubtype:', {
    mediaType: form.value.mediaType,
    mediaSubtype: form.value.mediaSubtype
  })

  // Validate required fields
  if (form.value.openSource === null) {
    alert('Please select Open Source Status (required field)')
    return
  }

  try {
    isSubmitting.value = true

    const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'

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
    } else {
      console.warn('[Submit] ⚠️ Template order NOT being sent - Debug Info:', {
        hasOrderChanges: hasOrderChanges.value,
        templateOrderChanged: templateOrderChanged.value,
        positionChangesSize: templatePositionChanges.value.size,
        categoryTemplatesLength: categoryTemplates.value.length,
        originalLength: originalCategoryTemplates.value.length,
        currentOrder: categoryTemplates.value.map(t => t.name).join(', '),
        originalOrder: originalCategoryTemplates.value.map(t => t.name).join(', ')
      })
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
          mediaType: form.value.mediaType,
          mediaSubtype: form.value.mediaSubtype,
          tags: form.value.tags,
          models: form.value.models,
          // Clean up logos: remove internal UI state (isStacked, showAdvanced) and empty optional fields
          logos: form.value.logos.map(logo => {
            const { isStacked, showAdvanced, ...cleanLogo } = logo as any
            // Remove undefined/empty optional fields
            const result: any = { provider: cleanLogo.provider }
            if (cleanLogo.label) result.label = cleanLogo.label
            if (cleanLogo.gap !== undefined) result.gap = cleanLogo.gap
            if (cleanLogo.position) result.position = cleanLogo.position
            if (cleanLogo.opacity !== undefined) result.opacity = cleanLogo.opacity
            return result
          }),
          requiresCustomNodes: form.value.requiresCustomNodes,
          tutorialUrl: form.value.tutorialUrl,
          comfyuiVersion: form.value.comfyuiVersion,
          date: form.value.date,
          openSource: form.value.openSource,
          includeOnDistributions: form.value.includeOnDistributions,
          // Round to 1 decimal before converting to bytes for storage (data loss minimization)
          size: gbToBytes(form.value.sizeGB !== null ? Math.round(form.value.sizeGB * 10) / 10 : null),
          vram: gbToBytes(form.value.vramGB !== null ? Math.round(form.value.vramGB * 10) / 10 : null),
          usage: form.value.usage ?? 0,
          searchRank: form.value.searchRank ?? 0
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
        // Store requiresCustomNodes (empty array means field should be deleted, so store undefined)
        originalTemplate.value.requiresCustomNodes = form.value.requiresCustomNodes.length > 0
          ? [...form.value.requiresCustomNodes]
          : undefined
        originalTemplate.value.openSource = form.value.openSource
        // Store includeOnDistributions (empty array means field should be deleted, so store undefined)
        originalTemplate.value.includeOnDistributions = form.value.includeOnDistributions.length > 0
          ? [...form.value.includeOnDistributions]
          : undefined
        // Store rounded values (1 decimal) to match what's saved in index.json
        originalTemplate.value.size = gbToBytes(form.value.sizeGB !== null ? Math.round(form.value.sizeGB * 10) / 10 : null)
        originalTemplate.value.vram = gbToBytes(form.value.vramGB !== null ? Math.round(form.value.vramGB * 10) / 10 : null)
        originalTemplate.value.usage = form.value.usage ?? 0
        originalTemplate.value.searchRank = form.value.searchRank ?? 0
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

// Check for main branch on page load
onMounted(() => {
  const branch = selectedBranch.value || 'main'
  const isMainBranch = branch === 'main' || branch === 'master'

  if (isMainBranch) {
    // Show warning when opening edit page on main branch
    warningTiming.value = 'opening'
    showMainBranchWarning.value = true
  }
})

useHead({
  title: `Edit ${templateName} - ComfyUI Template Manager`
})
</script>
