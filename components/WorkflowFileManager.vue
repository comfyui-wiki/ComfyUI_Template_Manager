<template>
  <div class="space-y-4">
    <!-- Workflow File Section -->
    <div class="p-4 border-2 border-primary/20 rounded-lg bg-card">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div class="font-semibold text-sm">Workflow File</div>
            <div class="font-mono text-xs text-muted-foreground">
              {{ templateName === 'new' ? (extractedTemplateName ? `${extractedTemplateName}.json` : 'workflow.json') : `${templateName}.json` }}
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <!-- Model Links Validation Button -->
          <Button
            type="button"
            :variant="getButtonVariant()"
            size="sm"
            @click="emit('openModelLinksEditor')"
            :disabled="!props.workflowContent"
            :title="getValidationButtonTitle()"
            :class="{
              'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500': isWarningOnly()
            }"
          >
            <!-- Loading icon -->
            <svg v-if="props.modelLinksValidation?.validating" class="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <!-- Warning icon for missing/invalid links (standard nodes or custom nodes) -->
            <svg v-else-if="props.modelLinksValidation && (props.modelLinksValidation.missingLinks > 0 || props.modelLinksValidation.invalidLinks > 0 || props.modelLinksValidation.customNodeMissingLinks > 0)" class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <!-- Success icon -->
            <svg v-else-if="props.modelLinksValidation && props.modelLinksValidation.totalModels > 0" class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <!-- Default icon -->
            <svg v-else class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>

            <span v-if="props.modelLinksValidation?.validating">Validating...</span>
            <span v-else-if="props.modelLinksValidation && (props.modelLinksValidation.missingLinks > 0 || props.modelLinksValidation.invalidLinks > 0)">
              Models ({{ props.modelLinksValidation.missingLinks + props.modelLinksValidation.invalidLinks }})
            </span>
            <span v-else-if="props.modelLinksValidation && props.modelLinksValidation.customNodeMissingLinks > 0">
              Models ({{ props.modelLinksValidation.customNodeMissingLinks }} ⚠️)
            </span>
            <span v-else-if="props.modelLinksValidation && props.modelLinksValidation.totalModels > 0">
              Models ✓
            </span>
            <span v-else>
              Models
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            @click="downloadWorkflow"
            :disabled="!props.workflowContent"
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
            {{ templateName === 'new' && !props.workflowContent ? 'Upload' : 'Re-upload' }}
          </Button>
        </div>
      </div>

      <!-- Status Message for workflow -->
      <div v-if="workflowStatus"
           class="p-3 rounded-lg text-sm"
           :class="workflowStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
        <div class="flex items-start gap-2">
          <svg v-if="workflowStatus.success" class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="whitespace-pre-line flex-1">{{ workflowStatus.message }}</div>
        </div>

        <!-- Template Name Editor (Create Mode - Integrated) -->
        <div v-if="templateName === 'new' && extractedTemplateName && workflowStatus.success" class="mt-4 pt-4 border-t border-green-200">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span class="font-semibold">Template Name</span>
            </div>
            <button
              v-if="!isEditingTemplateName"
              type="button"
              @click="startEditTemplateName"
              class="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Edit Name
            </button>
          </div>

          <div v-if="!isEditingTemplateName" class="flex items-center gap-2">
            <code class="px-2 py-1 bg-green-100 rounded font-mono text-sm font-semibold text-green-900">
              {{ extractedTemplateName }}
            </code>
          </div>

          <div v-else class="space-y-2">
            <div>
              <input
                v-model="editingTemplateNameValue"
                type="text"
                class="w-full px-2 py-1.5 text-sm border rounded font-mono"
                :class="{
                  'border-red-500 focus:ring-red-500': templateNameError,
                  'border-green-300 focus:ring-green-500': !templateNameError
                }"
                placeholder="my_template_name"
                @keydown.enter="saveTemplateName"
                @keydown.esc="cancelEditTemplateName"
              />
              <div v-if="templateNameError" class="text-xs text-red-600 mt-1">
                {{ templateNameError }}
              </div>
              <div v-else class="text-xs text-green-600 mt-1">
                Only letters, numbers, dashes, and underscores allowed
              </div>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                @click="saveTemplateName"
                :disabled="!!templateNameError || !editingTemplateNameValue.trim()"
                class="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button
                type="button"
                @click="cancelEditTemplateName"
                class="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Duplicate Name Warning (Create Mode) -->
      <div v-if="templateName === 'new' && duplicateNameWarning"
           class="mt-4 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-300 flex items-start gap-2">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ duplicateNameWarning }}</span>
      </div>

      <!-- Naming Rule Warning -->
      <div v-if="namingRuleWarning"
           class="mt-4 p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200 flex items-start gap-2">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1">{{ namingRuleWarning }}</div>
      </div>

      <!-- Naming Rules Notes (Collapsible) -->
      <div v-if="namingRules" class="mt-4 border rounded-lg overflow-hidden bg-white">
        <button
          type="button"
          @click="showNamingNotes = !showNamingNotes"
          class="w-full px-4 py-2.5 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
        >
          <div class="flex items-center gap-2.5">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="font-medium text-gray-700">Template Naming Guidelines</span>
          </div>
          <svg
            class="w-4 h-4 text-gray-500 transition-transform"
            :class="{ 'rotate-180': showNamingNotes }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-if="showNamingNotes" class="p-4 bg-white border-t text-sm space-y-3">
          <!-- Category Prefixes -->
          <div v-if="namingRules.namingRules">
            <div class="font-semibold text-gray-800 mb-2">📂 Category Prefixes</div>
            <div class="space-y-1.5 text-xs">
              <div v-for="(rule, category) in namingRules.namingRules" :key="category" class="flex items-start gap-2">
                <code class="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-xs">{{ rule.prefix }}</code>
                <span class="text-gray-600">{{ rule.description }}</span>
              </div>
            </div>
          </div>

          <!-- Best Practices -->
          <div v-if="namingRules.notes?.bestPractices">
            <div class="font-semibold text-gray-800 mb-2">✨ Best Practices</div>
            <ul class="space-y-1 text-xs text-gray-600 list-disc list-inside">
              <li v-for="(practice, index) in namingRules.notes.bestPractices" :key="index">
                {{ practice }}
              </li>
            </ul>
          </div>

          <!-- General Notes -->
          <div v-if="namingRules.notes?.general" class="text-xs text-gray-600 pt-2 border-t">
            {{ namingRules.notes.general }}
          </div>

          <!-- Examples -->
          <div v-if="namingRules.notes?.examples" class="pt-2 border-t">
            <div class="grid grid-cols-2 gap-3">
              <div v-if="namingRules.notes.examples.good">
                <div class="font-semibold text-green-700 mb-1.5 text-xs">✓ Good Examples</div>
                <div class="space-y-1">
                  <code v-for="(example, index) in namingRules.notes.examples.good" :key="'good-' + index"
                        class="block px-2 py-1 bg-green-50 text-green-800 rounded font-mono text-xs">
                    {{ example }}
                  </code>
                </div>
              </div>
              <div v-if="namingRules.notes.examples.bad">
                <div class="font-semibold text-red-700 mb-1.5 text-xs">✗ Bad Examples</div>
                <div class="space-y-1">
                  <code v-for="(example, index) in namingRules.notes.examples.bad" :key="'bad-' + index"
                        class="block px-2 py-1 bg-red-50 text-red-800 rounded font-mono text-xs">
                    {{ example }}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Mode Hint -->
      <div v-else-if="templateName === 'new' && !props.workflowContent"
           class="p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200 flex items-start gap-2">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <div class="flex-1">
          <div class="font-semibold mb-1">Upload Workflow File to Start</div>
          <div class="text-xs text-blue-600">
            The filename (without .json) will become the template name. Example: <code class="bg-blue-100 px-1 rounded">my_template.json</code> → <code class="bg-blue-100 px-1 rounded font-semibold">my_template</code>
          </div>
        </div>
      </div>

      <!-- Format Change Notice -->
      <div v-if="formatChangeNotice"
           class="mt-4 p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200 flex items-start gap-2">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <div class="flex-1">
          <div class="font-semibold mb-1">Input File Format Changed</div>
          <div class="text-xs">
            <code class="bg-blue-100 px-1 rounded">{{ formatChangeNotice.oldFilename }}</code>
            →
            <code class="bg-blue-100 px-1 rounded font-semibold">{{ formatChangeNotice.newFilename }}</code>
          </div>
          <div class="text-xs mt-1.5 text-blue-600">
            Changes will be applied when you save.
          </div>
        </div>
      </div>

      <!-- Hidden file input -->
      <input
        ref="workflowFileInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleWorkflowReupload"
      />
    </div>

    <!-- Input Files Section -->
    <div v-if="inputFileRefs.length > 0" class="mt-6 p-4 border-2 rounded-lg" :class="hasWarnings ? 'border-amber-300 bg-amber-50/50' : 'border-border bg-card'">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <svg v-if="hasWarnings" class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <h3 class="font-semibold">Input Files Required by Workflow</h3>
        </div>
        <span class="text-xs px-2.5 py-1 rounded font-medium" :class="hasWarnings ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'">
          {{ inputFileRefs.filter(f => f.exists).length }}/{{ inputFileRefs.length }} uploaded
        </span>
      </div>

      <!-- Input File List -->
      <div class="space-y-3">
        <div
          v-for="fileRef in inputFileRefs"
          :key="fileRef.filename"
          class="border rounded-lg"
          :class="inputFileWarnings.has(fileRef.filename) ? 'border-amber-300' : (fileRef.exists ? 'border-border' : 'border-amber-200')"
        >
          <div class="flex items-center justify-between p-3"
               :class="fileRef.exists ? 'bg-background' : 'bg-amber-50'">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <!-- Icon -->
              <div class="flex-shrink-0">
                <div class="w-10 h-10 rounded flex items-center justify-center"
                     :class="fileRef.exists ? 'bg-green-100' : 'bg-amber-100'">
                  <svg v-if="fileRef.exists" class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <svg v-else class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>

              <!-- File Info -->
              <div class="flex-1 min-w-0">
                <!-- Editable filename -->
                <div class="flex items-center gap-2 group">
                  <input
                    v-if="editingFilename === fileRef.filename"
                    v-model="tempFilename"
                    type="text"
                    class="font-mono text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    @keyup.enter="saveFilenameEdit(fileRef.filename)"
                    @keyup.esc="cancelFilenameEdit"
                    @blur="saveFilenameEdit(fileRef.filename)"
                  />
                  <div v-else class="font-mono text-sm truncate">{{ fileRef.filename }}</div>
                  <button
                    v-if="editingFilename !== fileRef.filename"
                    type="button"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="startFilenameEdit(fileRef.filename)"
                    title="Edit filename"
                  >
                    <svg class="w-3 h-3 text-muted-foreground hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <span class="capitalize">{{ fileRef.nodeType }}</span>
                  <span>•</span>
                  <span>Node #{{ fileRef.nodeId }}</span>
                  <span v-if="fileRef.size">•</span>
                  <span v-if="fileRef.size">{{ formatFileSize(fileRef.size) }}</span>
                </div>
                <div v-if="!fileRef.exists" class="text-xs text-amber-700 mt-1 font-medium">
                  ⚠️ File not found in repository
                </div>
              </div>

              <!-- Preview for images -->
              <div v-if="fileRef.exists && fileRef.previewUrl && isImageFile(fileRef.filename)" class="flex-shrink-0">
                <img
                  :src="fileRef.previewUrl"
                  :alt="fileRef.filename"
                  class="w-12 h-12 rounded object-cover border"
                  @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
                />
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 ml-3">
              <Button
                v-if="fileRef.exists"
                type="button"
                variant="outline"
                size="sm"
                @click="downloadInputFile(fileRef.filename)"
                title="Download file"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </Button>
              <Button
                v-if="fileRef.exists"
                type="button"
                variant="outline"
                size="sm"
                @click="handleConvertFile(fileRef.filename)"
                title="Convert/compress file"
              >
                Convert
              </Button>
              <Button
                type="button"
                :variant="fileRef.exists ? 'outline' : 'default'"
                size="sm"
                @click="triggerInputFileUpload(fileRef.filename)"
                :title="fileRef.exists ? 'Replace file' : 'Upload file'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </Button>
            </div>
          </div>

          <!-- Warning Message -->
          <div v-if="inputFileWarnings.has(fileRef.filename)"
               class="px-3 pb-3 pt-0">
            <div class="p-2 rounded bg-amber-100 border border-amber-300 text-xs text-amber-800">
              {{ inputFileWarnings.get(fileRef.filename) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Hidden file inputs for each input file -->
      <input
        v-for="fileRef in inputFileRefs"
        :key="'input-' + fileRef.filename"
        :ref="el => setInputFileRef(fileRef.filename, el)"
        type="file"
        class="hidden"
        @change="(e) => handleInputFileUpload(e, fileRef.filename)"
      />
    </div>

    <!-- No Input Files Message -->
    <div v-else-if="workflowParsed && inputFileRefs.length === 0" class="p-4 border rounded-lg bg-card text-center">
      <svg class="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm text-muted-foreground">No input files required by this workflow</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Button } from '@/components/ui/button'

interface InputFileRef {
  filename: string // Actual filename from workflow JSON
  nodeId: number
  nodeType: string
  exists: boolean
  previewUrl?: string
  size?: number
}

interface Props {
  templateName: string
  repo: string
  branch: string
  workflowContent?: string
  category?: string
  modelLinksValidation?: {
    totalModels: number
    missingLinks: number
    invalidLinks: number
    customNodeMissingLinks: number
    validating: boolean
  } | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  workflowUpdated: [content: string]
  inputFilesUpdated: [files: Map<string, File>]
  openConverter: [file: File, targetFilename: string, isExisting: boolean]
  formatChanged: [oldFilename: string, newFilename: string]
  templateNameExtracted: [name: string] // Emit template name from filename
  openModelLinksEditor: [] // Emit to open model links editor
  customNodesDetected: [customNodes: string[]] // Emit detected custom nodes from workflow
}>()

// Refs
const workflowFileInput = ref<HTMLInputElement>()
const inputFileInputRefs = ref<Map<string, HTMLInputElement>>(new Map())
const workflowStatus = ref<{ success: boolean; message: string } | null>(null)
const formatChangeNotice = ref<{ oldFilename: string; newFilename: string } | null>(null)
const inputFileRefs = ref<InputFileRef[]>([])
const workflowParsed = ref(false)
const reuploadedInputFiles = ref<Map<string, File>>(new Map())
const inputFileWarnings = ref<Map<string, string>>(new Map())
const pendingConversionFiles = ref<Map<string, File>>(new Map())

// Naming rules
const namingRules = ref<any>(null)
const namingRuleWarning = ref<string | null>(null)
const showNamingNotes = ref(false)

// Template name editing state (create mode)
const extractedTemplateName = ref<string>('')
const isEditingTemplateName = ref(false)
const editingTemplateNameValue = ref<string>('')
const duplicateNameWarning = ref<string | null>(null)

// Filename editing state
const editingFilename = ref<string | null>(null)
const tempFilename = ref<string>('')

// Format change tracking
const formatChangedFiles = ref<Map<string, string>>(new Map())

// Node types that require input assets (from Python script)
const ASSET_NODE_TYPES = ['LoadImage', 'LoadAudio', 'LoadVideo', 'VHS_LoadVideo']

// Computed
const hasWarnings = computed(() => {
  return inputFileRefs.value.some(f => !f.exists)
})

// Computed: Validate template name
const templateNameError = computed(() => {
  const name = editingTemplateNameValue.value.trim()
  if (!name) {
    return 'Template name is required'
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
    return 'Only letters, numbers, dashes, and underscores allowed'
  }
  return ''
})

// Helper: Set input file ref
const setInputFileRef = (filename: string, el: any) => {
  if (el) {
    inputFileInputRefs.value.set(filename, el as HTMLInputElement)
  }
}

// Helper: Check if file is an image
const isImageFile = (filename: string): boolean => {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
}

// Helper: Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// Load naming rules from config file
const loadNamingRules = async () => {
  try {
    // Fetch from API endpoint instead of public folder
    const response = await fetch('/api/config/template-naming-rules.json')
    if (!response.ok) {
      console.warn('Failed to load naming rules config')
      return
    }
    namingRules.value = await response.json()
    console.log('[WorkflowFileManager] Naming rules loaded:', namingRules.value)
  } catch (error) {
    console.error('Error loading naming rules:', error)
  }
}

// Validate template name against category naming rules
const validateTemplateNameAgainstCategory = () => {
  if (!namingRules.value || !props.category || props.templateName === 'new') {
    namingRuleWarning.value = null
    return
  }

  const rules = namingRules.value.namingRules
  const categoryRule = rules[props.category]

  if (!categoryRule) {
    namingRuleWarning.value = null
    return
  }

  const expectedPrefix = categoryRule.prefix
  const templateName = props.templateName

  if (!templateName.startsWith(expectedPrefix)) {
    namingRuleWarning.value = `💡 Templates in "${props.category}" category should start with "${expectedPrefix}". Example: ${categoryRule.example}`
  } else {
    namingRuleWarning.value = null
  }
}

// Check if template name already exists in the library
const checkDuplicateTemplateName = async (templateName: string): Promise<{ exists: boolean; category?: string }> => {
  try {
    const [owner, repoName] = props.repo.split('/')
    // Always check main branch for duplicates, not the current working branch
    const checkBranch = 'main'
    const url = `https://raw.githubusercontent.com/${owner}/${repoName}/${checkBranch}/templates/index.json`

    console.log('[Duplicate Check] Fetching templates from:', url)
    console.log('[Duplicate Check] Checking template name:', templateName)
    console.log('[Duplicate Check] Current working branch:', props.branch, '| Checking against branch:', checkBranch)

    const response = await fetch(url)
    if (!response.ok) {
      console.warn('Failed to fetch templates index for duplicate check')
      return { exists: false }
    }

    const data = await response.json()

    // Handle both array format (actual) and object format (legacy)
    const categories = Array.isArray(data) ? data : (data.categories || [])

    console.log('[Duplicate Check] JSON structure:', Array.isArray(data) ? 'Array' : 'Object')
    console.log('[Duplicate Check] Found categories:', categories.length)

    // Collect ALL matching templates across ALL categories
    const matchingCategories: string[] = []
    let totalTemplateCount = 0

    // Check all categories for existing template
    for (const category of categories) {
      const templateCount = category.templates?.length || 0
      totalTemplateCount += templateCount
      console.log('[Duplicate Check] Checking category:', category.title, '- Templates:', templateCount)

      if (category.templates && Array.isArray(category.templates)) {
        // Log first template structure for debugging (only once)
        if (matchingCategories.length === 0 && category.templates.length > 0) {
          console.log('[Duplicate Check] Sample template structure:', JSON.stringify(category.templates[0], null, 2))
        }

        const exists = category.templates.some((t: any) => {
          // Check both 'name' field and potential filename without .json extension
          const templateNameMatch = t.name === templateName
          const filenameMatch = t.file === templateName || t.file === `${templateName}.json`

          if (templateNameMatch || filenameMatch) {
            console.log('[Duplicate Check] MATCH FOUND in category:', category.title, '| Template:', JSON.stringify(t, null, 2))
          }

          return templateNameMatch || filenameMatch
        })

        if (exists) {
          matchingCategories.push(category.title)
        }
      }
    }

    console.log('[Duplicate Check] Total templates scanned:', totalTemplateCount)

    if (matchingCategories.length > 0) {
      const categoryList = matchingCategories.join(', ')
      console.log('[Duplicate Check] ⚠️ FOUND DUPLICATE in', matchingCategories.length, 'category(ies):', categoryList)
      return { exists: true, category: categoryList }
    }

    console.log('[Duplicate Check] ✓ No duplicate found')
    return { exists: false }
  } catch (error) {
    console.error('Error checking duplicate template name:', error)
    return { exists: false }
  }
}

// Extract custom nodes (cnr_id) from workflow JSON
const extractCustomNodesFromWorkflow = (workflowJson: string): string[] => {
  try {
    const data = JSON.parse(workflowJson)
    const nodes = data.nodes || []
    const customNodesSet = new Set<string>()

    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue

      // Extract cnr_id from node properties
      const properties = node.properties
      if (properties && typeof properties === 'object') {
        const cnrId = properties.cnr_id
        // Only include custom nodes (exclude comfy-core and empty/null values)
        if (cnrId && typeof cnrId === 'string' && cnrId !== 'comfy-core') {
          customNodesSet.add(cnrId)
        }
      }
    }

    return Array.from(customNodesSet).sort()
  } catch (error) {
    console.error('Failed to extract custom nodes from workflow:', error)
    return []
  }
}

// Parse workflow JSON to extract input file references
const parseWorkflowForInputFiles = (workflowJson: string): InputFileRef[] => {
  try {
    const data = JSON.parse(workflowJson)
    const nodes = data.nodes || []
    const refs: InputFileRef[] = []

    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue

      const nodeType = node.type
      if (ASSET_NODE_TYPES.includes(nodeType)) {
        const widgetsValues = node.widgets_values
        let filename: string | null = null

        // Handle different widgets_values formats
        if (nodeType === 'VHS_LoadVideo') {
          // VHS_LoadVideo uses object format: { video: "filename.mp4", ... }
          if (widgetsValues && typeof widgetsValues === 'object' && !Array.isArray(widgetsValues)) {
            filename = widgetsValues.video
          }
        } else {
          // Standard nodes use array format: ["filename.png"]
          if (Array.isArray(widgetsValues) && widgetsValues.length > 0) {
            filename = widgetsValues[0]
          }
        }

        if (filename) {
          refs.push({
            filename, // Use actual filename from workflow (backend handles prefixes)
            nodeId: node.id,
            nodeType,
            exists: false, // Will be checked against GitHub
          })
        }
      }
    }

    return refs
  } catch (error) {
    console.error('Failed to parse workflow JSON:', error)
    return []
  }
}

// Check if input files exist in GitHub repo
const checkInputFilesExistence = async () => {
  if (inputFileRefs.value.length === 0) return

  const [owner, repoName] = props.repo.split('/')

  for (const fileRef of inputFileRefs.value) {
    // Skip if already reuploaded
    if (reuploadedInputFiles.value.has(fileRef.filename)) {
      fileRef.exists = true
      continue
    }

    // Use filename from workflow JSON (backend already handles prefixes)
    const url = `https://raw.githubusercontent.com/${owner}/${repoName}/${props.branch}/input/${fileRef.filename}`
    try {
      const response = await fetch(url, { method: 'HEAD' })
      fileRef.exists = response.ok

      if (response.ok) {
        // Get file size
        const sizeHeader = response.headers.get('content-length')
        if (sizeHeader) {
          fileRef.size = parseInt(sizeHeader, 10)
        }

        // Set preview URL for images
        if (isImageFile(fileRef.filename)) {
          fileRef.previewUrl = url
        }
      }
    } catch (error) {
      console.warn(`Failed to check file: ${fileRef.filename}`, error)
      fileRef.exists = false
    }
  }
}

// Check if only custom node warnings (no errors)
const isWarningOnly = (): boolean => {
  if (!props.modelLinksValidation) return false
  const hasStandardNodeIssues = props.modelLinksValidation.missingLinks > 0 || props.modelLinksValidation.invalidLinks > 0
  const hasCustomNodeWarnings = props.modelLinksValidation.customNodeMissingLinks > 0
  return !hasStandardNodeIssues && hasCustomNodeWarnings
}

// Get button variant based on validation state
const getButtonVariant = (): string => {
  if (!props.modelLinksValidation) return 'outline'

  // Standard node errors → red
  if (props.modelLinksValidation.missingLinks > 0 || props.modelLinksValidation.invalidLinks > 0) {
    return 'destructive'
  }

  // Only custom node warnings → use outline (will be styled yellow with class)
  if (props.modelLinksValidation.customNodeMissingLinks > 0) {
    return 'outline'
  }

  // No issues → gray
  return 'outline'
}

// Get validation button title
const getValidationButtonTitle = (): string => {
  if (!props.modelLinksValidation) {
    return 'Validate model links'
  }
  if (props.modelLinksValidation.validating) {
    return 'Checking workflow for model requirements...'
  }

  const standardIssues = props.modelLinksValidation.missingLinks + props.modelLinksValidation.invalidLinks
  const customWarnings = props.modelLinksValidation.customNodeMissingLinks

  if (standardIssues > 0) {
    return `⚠️ ${props.modelLinksValidation.missingLinks} missing, ${props.modelLinksValidation.invalidLinks} invalid - Click to fix`
  }

  if (customWarnings > 0) {
    return `⚠️ ${customWarnings} custom node(s) need manual links - Click to add`
  }

  if (props.modelLinksValidation.totalModels > 0) {
    return `✓ All ${props.modelLinksValidation.totalModels} model links validated`
  }
  return 'No model requirements detected'
}

// Download workflow
const downloadWorkflow = () => {
  if (!props.workflowContent) {
    workflowStatus.value = {
      success: false,
      message: 'Workflow content not available'
    }
    return
  }

  const blob = new Blob([props.workflowContent], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // In create mode, use extractedTemplateName; otherwise use templateName
  const filename = props.templateName === 'new' && extractedTemplateName.value
    ? `${extractedTemplateName.value}.json`
    : `${props.templateName}.json`
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Trigger workflow upload
const triggerWorkflowUpload = () => {
  workflowFileInput.value?.click()
}

// Template name editing methods (create mode)
const startEditTemplateName = () => {
  editingTemplateNameValue.value = extractedTemplateName.value
  isEditingTemplateName.value = true
}

const saveTemplateName = async () => {
  const newName = editingTemplateNameValue.value.trim()

  if (!newName || templateNameError.value) {
    return
  }

  // Update extracted name
  extractedTemplateName.value = newName
  isEditingTemplateName.value = false

  // Check for duplicate name
  const duplicateCheck = await checkDuplicateTemplateName(newName)
  if (duplicateCheck.exists) {
    duplicateNameWarning.value = `A template with the name "${newName}" already exists in: ${duplicateCheck.category}. Saving will update/overwrite the existing template. Please rename if you want to create a new template.`
  } else {
    duplicateNameWarning.value = null
  }

  // Emit the new name
  emit('templateNameExtracted', newName)

  console.log('[WorkflowFileManager] Template name updated:', newName)
}

const cancelEditTemplateName = () => {
  isEditingTemplateName.value = false
  editingTemplateNameValue.value = ''
}

// Validate template name from filename
const validateTemplateName = (filename: string): { valid: boolean; name?: string; error?: string } => {
  // Remove .json extension
  if (!filename.endsWith('.json')) {
    return { valid: false, error: 'File must have .json extension' }
  }

  const nameWithoutExt = filename.slice(0, -5) // Remove '.json'

  // Check if there are other dots in the name (not allowed)
  if (nameWithoutExt.includes('.')) {
    return { valid: false, error: 'Template name cannot contain dots (except .json extension)' }
  }

  // Check for valid characters (alphanumeric, dashes, underscores only)
  if (!/^[a-zA-Z0-9_\-]+$/.test(nameWithoutExt)) {
    return { valid: false, error: 'Template name must contain only letters, numbers, dashes, and underscores' }
  }

  return { valid: true, name: nameWithoutExt }
}

// Handle workflow reupload
const handleWorkflowReupload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    const text = await file.text()
    JSON.parse(text) // Validate JSON

    // In create mode (when templateName is 'new'), extract and validate filename
    if (props.templateName === 'new') {
      const validation = validateTemplateName(file.name)

      if (!validation.valid) {
        workflowStatus.value = {
          success: false,
          message: `✗ Invalid filename: ${validation.error}`
        }
        duplicateNameWarning.value = null
        input.value = ''
        return
      }

      // Store extracted template name for editing
      extractedTemplateName.value = validation.name!
      // Reset editing state
      isEditingTemplateName.value = false
      editingTemplateNameValue.value = ''

      // Check for duplicate name
      const duplicateCheck = await checkDuplicateTemplateName(validation.name!)
      if (duplicateCheck.exists) {
        duplicateNameWarning.value = `A template with the name "${validation.name}" already exists in: ${duplicateCheck.category}. Saving will update/overwrite the existing template. Please rename the file if you want to create a new template.`
      } else {
        duplicateNameWarning.value = null
      }

      // Emit the extracted template name
      emit('templateNameExtracted', validation.name!)

      workflowStatus.value = {
        success: true,
        message: `Workflow file loaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
      }
    } else {
      workflowStatus.value = {
        success: true,
        message: `New workflow file loaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB). Click "Save Changes" to apply.`
      }
      duplicateNameWarning.value = null
    }

    emit('workflowUpdated', text)

    // Extract and emit custom nodes
    const customNodes = extractCustomNodesFromWorkflow(text)
    if (customNodes.length > 0) {
      console.log('[WorkflowFileManager] Detected custom nodes:', customNodes)
      emit('customNodesDetected', customNodes)
    }

    // Re-parse for input files
    const newRefs = parseWorkflowForInputFiles(text)
    inputFileRefs.value = newRefs
    workflowParsed.value = true
    await checkInputFilesExistence()
  } catch (error) {
    workflowStatus.value = {
      success: false,
      message: `✗ Invalid JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
    duplicateNameWarning.value = null
  }

  // Reset input
  input.value = ''
}

// Trigger input file upload
const triggerInputFileUpload = (filename: string) => {
  const input = inputFileInputRefs.value.get(filename)
  input?.click()
}

// Handle input file upload
const handleInputFileUpload = async (event: Event, originalFilename: string) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  console.log('[WorkflowFileManager] File uploaded:', file.name, file.type, file.size)

  // Clear previous warning
  inputFileWarnings.value.delete(originalFilename)

  // Validate file size and format
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  const isWebP = file.type === 'image/webp'
  const isMP4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')

  const fileSizeMB = file.size / (1024 * 1024)

  // Check MP4 size limit (8MB)
  if (isMP4 && fileSizeMB > 8) {
    inputFileWarnings.value.set(originalFilename,
      `❌ MP4 file is too large (${fileSizeMB.toFixed(2)}MB). Maximum size for MP4 is 8MB. Please reduce the file size.`
    )
    // Reset input
    input.value = ''
    return
  }

  // ALWAYS store the file first to mark it as uploaded
  reuploadedInputFiles.value.set(originalFilename, file)

  // Update the file ref to mark as exists
  const fileRef = inputFileRefs.value.find(f => f.filename === originalFilename)
  if (fileRef) {
    fileRef.exists = true
    fileRef.size = file.size

    // Create preview for images
    if (isImageFile(file.name)) {
      fileRef.previewUrl = URL.createObjectURL(file)
    }
  }

  // Check size warnings
  let sizeWarning = ''
  if (isImage && fileSizeMB > 2) {
    sizeWarning = `⚠️ Image size is ${fileSizeMB.toFixed(2)}MB (recommended: < 2MB). This may be too large for the server.`
  } else if (isMP4 && fileSizeMB > 4) {
    sizeWarning = `⚠️ MP4 size is ${fileSizeMB.toFixed(2)}MB (recommended: < 4MB for better performance).`
  }

  // Check if needs conversion (non-WebP images or non-MP4 videos should be converted)
  const needsConversion = (isImage && !isWebP) || (isVideo && !isMP4)

  if (needsConversion) {
    // Show info message - user can manually click Convert button
    inputFileWarnings.value.set(originalFilename,
      `${sizeWarning ? sizeWarning + ' ' : ''}✨ File uploaded: ${file.name} (${fileSizeMB.toFixed(2)}MB). Click "Convert" button to optimize format and size.`
    )

    // Store file for conversion
    pendingConversionFiles.value.set(originalFilename, file)

    // Emit updated files
    emit('inputFilesUpdated', reuploadedInputFiles.value)

    // Reset input
    input.value = ''

    // Note: Auto-trigger removed - user needs to manually click Convert button

    return
  }

  // WebP or MP4 file - show success message
  if (sizeWarning) {
    inputFileWarnings.value.set(originalFilename, sizeWarning)
  } else {
    const formatMsg = isWebP ? 'WebP format is optimal!' : isMP4 ? 'MP4 format is accepted!' : 'File format is valid!'
    inputFileWarnings.value.set(originalFilename,
      `✅ File uploaded successfully: ${file.name} (${fileSizeMB.toFixed(2)}MB). ${formatMsg}`
    )
    // Clear success message after 3 seconds
    setTimeout(() => {
      inputFileWarnings.value.delete(originalFilename)
    }, 3000)
  }

  // Emit updated files
  emit('inputFilesUpdated', reuploadedInputFiles.value)

  // Reset input
  input.value = ''
}

// Handle file conversion request
const handleConvertFile = async (filename: string) => {
  // First check if there's a pending file from recent upload
  let file = pendingConversionFiles.value.get(filename)
  let isExisting = false

  // If no pending file, check if there's a reuploaded file
  if (!file) {
    file = reuploadedInputFiles.value.get(filename)
  }

  // If still no file, fetch from GitHub (existing file)
  if (!file) {
    isExisting = true
    const [owner, repoName] = props.repo.split('/')
    const url = `https://raw.githubusercontent.com/${owner}/${repoName}/${props.branch}/input/${filename}`

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('File not found')

      const blob = await response.blob()
      file = new File([blob], filename, { type: blob.type })
    } catch (error) {
      console.error('Failed to fetch file for conversion:', error)
      return
    }
  }

  if (file) {
    emit('openConverter', file, filename, isExisting)
  }
}

// Handle converted file from parent
const handleConvertedFileReceived = (file: File, targetFilename: string, oldFilename?: string) => {
  console.log('[WorkflowFileManager] Received converted file:', {
    newFile: file.name,
    targetFilename,
    oldFilename
  })

  // If format changed (oldFilename provided), handle the change
  if (oldFilename && oldFilename !== targetFilename) {
    console.log('[WorkflowFileManager] Format changed:', oldFilename, '→', targetFilename)

    // Clear old file references
    inputFileWarnings.value.delete(oldFilename)
    pendingConversionFiles.value.delete(oldFilename)

    // Find and update the file ref to new filename (Vue reactive way)
    const index = inputFileRefs.value.findIndex(f => f.filename === oldFilename)
    if (index !== -1) {
      const oldRef = inputFileRefs.value[index]
      // Create new object to trigger reactivity
      const newRef = {
        ...oldRef,
        filename: targetFilename,
        exists: true,
        size: file.size,
        previewUrl: isImageFile(file.name) ? URL.createObjectURL(file) : undefined
      }

      // Replace in array to trigger Vue reactivity
      inputFileRefs.value.splice(index, 1, newRef)

      console.log('[WorkflowFileManager] Updated fileRef:', oldFilename, '→', targetFilename)
    }

    // Remove old file from map if it exists
    reuploadedInputFiles.value.delete(oldFilename)

    // Store new file
    reuploadedInputFiles.value.set(targetFilename, file)

    // Track format change (new filename -> old filename)
    formatChangedFiles.value.set(targetFilename, oldFilename)

    // Show format change notice
    formatChangeNotice.value = {
      oldFilename,
      newFilename: targetFilename
    }

    // Emit with format change info so parent can update workflow JSON
    emit('inputFilesUpdated', reuploadedInputFiles.value)
    emit('formatChanged', oldFilename, targetFilename)
  } else {
    // No format change, regular update
    const actualFilename = targetFilename || file.name

    // Clear warning and pending file
    inputFileWarnings.value.delete(actualFilename)
    pendingConversionFiles.value.delete(actualFilename)

    // Check size again
    const fileSizeMB = file.size / (1024 * 1024)
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if ((isImage && fileSizeMB > 2) || (isVideo && fileSizeMB > 4)) {
      inputFileWarnings.value.set(actualFilename,
        `⚠️ Converted file is ${fileSizeMB.toFixed(2)}MB. Still larger than recommended.`
      )
    }

    // Store the converted file
    reuploadedInputFiles.value.set(actualFilename, file)

    // Update the file ref
    const fileRef = inputFileRefs.value.find(f => f.filename === actualFilename)
    if (fileRef) {
      fileRef.exists = true
      fileRef.size = file.size

      // Create preview for images
      if (isImageFile(file.name)) {
        fileRef.previewUrl = URL.createObjectURL(file)
      }
    }

    // Emit updated files
    emit('inputFilesUpdated', reuploadedInputFiles.value)
  }
}

// Reset format changes after save
const resetFormatChanges = () => {
  formatChangedFiles.value.clear()
  formatChangeNotice.value = null
}

// Filename editing functions
const startFilenameEdit = (filename: string) => {
  editingFilename.value = filename
  tempFilename.value = filename
}

const cancelFilenameEdit = () => {
  editingFilename.value = null
  tempFilename.value = ''
}

const saveFilenameEdit = (oldFilename: string) => {
  const newFilename = tempFilename.value.trim()

  // If no change or empty, cancel
  if (!newFilename || newFilename === oldFilename) {
    cancelFilenameEdit()
    return
  }

  // Validate filename (basic check)
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(newFilename)) {
    inputFileWarnings.value.set(oldFilename, '⚠️ Invalid filename. Use only letters, numbers, dots, dashes, and underscores.')
    cancelFilenameEdit()
    return
  }

  console.log('[WorkflowFileManager] Renaming file:', oldFilename, '→', newFilename)

  // Get the file if it was uploaded
  const file = reuploadedInputFiles.value.get(oldFilename)

  // Find and update the file ref
  const index = inputFileRefs.value.findIndex(f => f.filename === oldFilename)
  if (index !== -1) {
    const oldRef = inputFileRefs.value[index]
    const newRef = {
      ...oldRef,
      filename: newFilename,
    }

    // If file was uploaded, create new File object with new name
    if (file) {
      const newFile = new File([file], newFilename, { type: file.type })
      reuploadedInputFiles.value.delete(oldFilename)
      reuploadedInputFiles.value.set(newFilename, newFile)

      // Update preview if image
      if (isImageFile(newFilename)) {
        newRef.previewUrl = URL.createObjectURL(newFile)
      }
    }

    // Replace in array to trigger Vue reactivity
    inputFileRefs.value.splice(index, 1, newRef)
  }

  // Track format change (new filename -> old filename)
  formatChangedFiles.value.set(newFilename, oldFilename)

  // Show format change notice
  formatChangeNotice.value = {
    oldFilename,
    newFilename
  }

  // Clear any warnings on old filename
  inputFileWarnings.value.delete(oldFilename)

  // Emit changes
  emit('inputFilesUpdated', reuploadedInputFiles.value)
  emit('formatChanged', oldFilename, newFilename)

  cancelFilenameEdit()
}

// Expose method for parent to call when converter finishes
defineExpose({
  handleConvertedFileReceived,
  formatChangedFiles,
  resetFormatChanges
})

// Download input file
const downloadInputFile = async (filename: string) => {
  // Check if reuploaded locally
  if (reuploadedInputFiles.value.has(filename)) {
    const file = reuploadedInputFiles.value.get(filename)!
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  // Download from GitHub (use filename from workflow JSON)
  const [owner, repoName] = props.repo.split('/')
  const url = `https://raw.githubusercontent.com/${owner}/${repoName}/${props.branch}/input/${filename}`

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('File not found')

    const blob = await response.blob()
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('Failed to download file:', error)
  }
}

// Initialize on mount and when workflow content changes
watch(() => props.workflowContent, async (newContent) => {
  if (!newContent) return

  const refs = parseWorkflowForInputFiles(newContent)

  // Preserve state of reuploaded files after parsing
  for (const ref of refs) {
    if (reuploadedInputFiles.value.has(ref.filename)) {
      const file = reuploadedInputFiles.value.get(ref.filename)!
      ref.exists = true
      ref.size = file.size
      if (isImageFile(file.name)) {
        ref.previewUrl = URL.createObjectURL(file)
      }
    }
  }

  inputFileRefs.value = refs
  workflowParsed.value = true
  await checkInputFilesExistence()
}, { immediate: true })

// Watch for category changes to re-validate template name
watch(() => props.category, () => {
  validateTemplateNameAgainstCategory()
})

// Load naming rules on mount
onMounted(async () => {
  await loadNamingRules()
  validateTemplateNameAgainstCategory()
})
</script>
