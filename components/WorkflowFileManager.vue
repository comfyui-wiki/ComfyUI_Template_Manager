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
      </div>

      <!-- Status Message for workflow -->
      <div v-if="workflowStatus"
           class="p-3 rounded-lg text-sm"
           :class="workflowStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
        {{ workflowStatus.message }}
      </div>

      <!-- Format Change Notice -->
      <div v-if="formatChangeNotice"
           class="p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200">
        <div class="font-semibold mb-1">🔄 Input File Format Changed</div>
        <div class="text-xs">
          Workflow JSON has been automatically updated:<br>
          <code class="bg-blue-100 px-1 rounded">{{ formatChangeNotice.oldFilename }}</code>
          →
          <code class="bg-blue-100 px-1 rounded font-semibold">{{ formatChangeNotice.newFilename }}</code>
        </div>
        <div class="text-xs mt-2 text-blue-600">
          💡 The old file will be deleted and the new file will be uploaded when you save.
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
    <div v-if="inputFileRefs.length > 0" class="p-4 border-2 rounded-lg" :class="hasWarnings ? 'border-amber-300 bg-amber-50/50' : 'border-border bg-card'">
      <div class="flex items-center gap-2 mb-3">
        <svg v-if="hasWarnings" class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <svg v-else class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <h3 class="font-semibold text-sm">Input Files Required by Workflow</h3>
        <span class="ml-auto text-xs px-2 py-1 rounded" :class="hasWarnings ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'">
          {{ inputFileRefs.filter(f => f.exists).length }}/{{ inputFileRefs.length }} uploaded
        </span>
      </div>

      <p class="text-xs text-muted-foreground mb-4">
        These files are referenced in the workflow JSON and must be uploaded to the <code class="bg-muted px-1 py-0.5 rounded font-mono text-xs">input/</code> folder.
      </p>

      <!-- Input File List -->
      <div class="space-y-2">
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
  filename: string
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
}

const props = defineProps<Props>()

const emit = defineEmits<{
  workflowUpdated: [content: string]
  inputFilesUpdated: [files: Map<string, File>]
  openConverter: [file: File, targetFilename: string, isExisting: boolean]
  formatChanged: [oldFilename: string, newFilename: string]
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
const formatChangedFiles = ref<Map<string, string>>(new Map()) // new filename -> old filename
const editingFilename = ref<string | null>(null)
const tempFilename = ref<string>('')

// Node types that require input assets (from Python script)
const ASSET_NODE_TYPES = ['LoadImage', 'LoadAudio', 'LoadVideo']

// Computed
const hasWarnings = computed(() => {
  return inputFileRefs.value.some(f => !f.exists)
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
        const widgetsValues = node.widgets_values || []
        // First element is typically the filename
        if (widgetsValues.length > 0 && widgetsValues[0]) {
          const filename = widgetsValues[0]
          refs.push({
            filename,
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
  a.download = `${props.templateName}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Trigger workflow upload
const triggerWorkflowUpload = () => {
  workflowFileInput.value?.click()
}

// Handle workflow reupload
const handleWorkflowReupload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    const text = await file.text()
    JSON.parse(text) // Validate JSON

    workflowStatus.value = {
      success: true,
      message: `✓ New workflow file loaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB). Click "Save Changes" to apply.`
    }

    emit('workflowUpdated', text)

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

  const fileSizeMB = file.size / (1024 * 1024)

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

  // Check size limits
  let sizeWarning = ''
  if (isImage && fileSizeMB > 2) {
    sizeWarning = `⚠️ Image size is ${fileSizeMB.toFixed(2)}MB (recommended: < 2MB). This may be too large for the server.`
  } else if (isVideo && fileSizeMB > 4) {
    sizeWarning = `⚠️ Video size is ${fileSizeMB.toFixed(2)}MB (recommended: < 4MB). This may be too large for the server.`
  }

  // Check if needs conversion (non-WebP images or videos should be converted)
  const needsConversion = (isImage && !isWebP) || isVideo

  if (needsConversion) {
    // Show info message about auto-opening converter
    inputFileWarnings.value.set(originalFilename,
      `${sizeWarning ? sizeWarning + ' ' : ''}✨ File uploaded: ${file.name} (${fileSizeMB.toFixed(2)}MB). Opening converter to optimize format and size...`
    )

    // Store file for conversion
    pendingConversionFiles.value.set(originalFilename, file)

    // Emit updated files
    emit('inputFilesUpdated', reuploadedInputFiles.value)

    // Reset input
    input.value = ''

    // Auto-trigger converter after a short delay to let UI update
    setTimeout(() => {
      emit('openConverter', file, originalFilename, false)
    }, 500)

    return
  }

  // WebP file - show success message
  if (sizeWarning) {
    inputFileWarnings.value.set(originalFilename, sizeWarning)
  } else {
    inputFileWarnings.value.set(originalFilename,
      `✅ File uploaded successfully: ${file.name} (${fileSizeMB.toFixed(2)}MB). WebP format is optimal!`
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

  // Download from GitHub
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
</script>
