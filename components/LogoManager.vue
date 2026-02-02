<template>
  <Dialog v-model:open="isOpen">
    <DialogScrollContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle>Logo Manager</DialogTitle>
        <DialogDescription>
          Manage provider logos for templates. Add new providers or update existing logo images.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Add New Provider -->
        <div class="border rounded-lg p-3 bg-muted/30">
          <h3 class="text-sm font-semibold mb-2">Add New Provider</h3>
          <div class="flex gap-3">
            <div class="flex-1">
              <Input
                v-model="newProviderName"
                placeholder="Provider name (e.g., Google, OpenAI)"
                class="h-9"
              />
            </div>
            <div class="flex-1">
              <div class="relative">
                <Input
                  type="file"
                  accept="image/*"
                  @change="handleNewProviderImage"
                  class="h-9"
                  ref="newProviderFileInput"
                />
              </div>
            </div>
            <Button
              @click="addNewProvider"
              :disabled="!newProviderName.trim() || !newProviderFile || isSubmitting"
              class="h-9"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </Button>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Logo will be saved as: logo/[provider-name].[ext] (lowercase, spaces replaced with hyphens, original format preserved)
          </p>
        </div>

        <!-- Existing Providers List -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold">Existing Providers ({{ Object.keys(localLogoMapping).length }})</h3>
            <div class="flex items-center gap-2">
              <Input
                v-model="searchQuery"
                placeholder="Search providers..."
                class="h-8 w-64 text-sm"
              />
            </div>
          </div>

          <!-- Provider Grid -->
          <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 h-[40vh] overflow-y-auto border rounded-lg p-3 bg-card">
            <div
              v-for="[providerName, logoPath] in filteredProviders"
              :key="providerName"
              class="border rounded-lg p-2 space-y-1.5 hover:border-primary/50 transition-colors"
            >
              <!-- Logo Preview -->
              <div class="aspect-square rounded bg-muted flex items-center justify-center overflow-hidden" style="height: 80px;">
                <img
                  :key="pendingFilePreviews[providerName] || logoPath"
                  :src="pendingFilePreviews[providerName] || `${repoBaseUrl}/${logoPath}`"
                  :alt="providerName"
                  class="w-full h-full object-contain p-1.5"
                  @error="handleImageError"
                  @load="() => console.log('[Logo Manager] Image loaded:', providerName)"
                />
              </div>

              <!-- Provider Info -->
              <div class="space-y-1.5">
                <div class="text-xs font-medium truncate" :title="providerName">
                  {{ providerName }}
                </div>
                <div class="text-[10px] text-muted-foreground font-mono truncate" :title="logoPath">
                  {{ logoPath }}
                </div>

                <!-- Actions -->
                <div class="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    @click="triggerUpdateLogo(providerName)"
                    class="flex-1 h-6 px-1"
                    :disabled="isSubmitting"
                    title="Update logo"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    @click="confirmDeleteProvider(providerName)"
                    class="flex-1 h-6 px-1 text-destructive hover:bg-destructive/10"
                    :disabled="isSubmitting"
                    title="Delete logo"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </div>

              <!-- Hidden file input for updating -->
              <input
                type="file"
                accept="image/*"
                class="hidden"
                :ref="el => updateFileInputs[providerName] = el"
                @change="(e) => handleUpdateProviderImage(e, providerName)"
              />
            </div>

            <!-- Empty State -->
            <div v-if="filteredProviders.length === 0" class="col-span-full text-center py-8 text-muted-foreground">
              <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>No providers found matching "{{ searchQuery }}"</p>
            </div>
          </div>
        </div>

        <!-- Success Message -->
        <div v-if="saveSuccess" class="border rounded-lg p-3 bg-green-50 border-green-200">
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-medium text-green-900">Changes saved successfully!</p>
              <p class="text-xs text-green-700 mt-1">
                Commit:
                <a
                  :href="saveSuccess.commitUrl"
                  target="_blank"
                  class="font-mono hover:underline"
                >
                  {{ saveSuccess.commitSha.substring(0, 7) }}
                </a>
              </p>
            </div>
          </div>
        </div>

        <!-- Save/Cancel Actions -->
        <div class="flex items-center justify-between pt-3 border-t">
          <div class="text-sm" :class="pendingChanges.length > 0 && !saveSuccess ? 'text-orange-600 font-medium' : 'text-muted-foreground'">
            {{ saveSuccess ? 'All changes saved' : `${pendingChanges.length} pending change(s)` }}
          </div>
          <div class="flex gap-2">
            <Button
              variant="outline"
              @click="closeDialog"
              :disabled="isSubmitting"
            >
              {{ saveSuccess ? 'Close' : 'Cancel' }}
            </Button>
            <Button
              v-if="!saveSuccess"
              @click="saveChanges"
              :disabled="pendingChanges.length === 0 || isSubmitting"
            >
              <svg v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogScrollContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
  logoMapping: Record<string, string>
  repoBaseUrl: string
  repo: string
  branch: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'refresh': []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// Local state
const localLogoMapping = ref<Record<string, string>>({ ...props.logoMapping })
const searchQuery = ref('')
const isSubmitting = ref(false)

// New provider
const newProviderName = ref('')
const newProviderFile = ref<File | null>(null)
const newProviderFileInput = ref<HTMLInputElement | null>(null)

// Update provider
const updateFileInputs = ref<Record<string, HTMLInputElement>>({})

// Track pending changes
interface PendingChange {
  type: 'add' | 'update' | 'delete'
  providerName: string
  file?: File
  oldPath?: string
}
const pendingChanges = ref<PendingChange[]>([])

// Track file previews for pending changes
const pendingFilePreviews = ref<Record<string, string>>({})

// Success state
const saveSuccess = ref<{ commitSha: string; commitUrl: string } | null>(null)

// Track if we just saved (to avoid overwriting with stale cache)
const justSaved = ref(false)

// Watch for dialog open/close
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // When dialog opens, reload from props
    console.log('[Logo Manager] Dialog opened, loading', Object.keys(props.logoMapping).length, 'providers from props')
    localLogoMapping.value = { ...props.logoMapping }
    // Reset justSaved flag when dialog reopens
    justSaved.value = false
  }
})

// Watch for prop changes
watch(() => props.logoMapping, (newMapping) => {
  // Only update if dialog is open AND we didn't just save
  // (to avoid overwriting correct local state with stale cached data from GitHub)
  if (props.open && !justSaved.value) {
    console.log('[Logo Manager] logoMapping changed, updating local state')
    console.log('[Logo Manager] New mapping has', Object.keys(newMapping).length, 'providers')
    localLogoMapping.value = { ...newMapping }
  } else if (justSaved.value) {
    console.log('[Logo Manager] Ignoring prop change after save (avoiding stale cache)')
  }
}, { deep: true })

// Filtered providers
const filteredProviders = computed(() => {
  const query = searchQuery.value.toLowerCase()
  return Object.entries(localLogoMapping.value)
    .filter(([name]) => name.toLowerCase().includes(query))
    .sort((a, b) => a[0].localeCompare(b[0]))
})

// Handle new provider image
const handleNewProviderImage = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    newProviderFile.value = target.files[0]
  }
}

// Add new provider
const addNewProvider = () => {
  if (!newProviderName.value.trim() || !newProviderFile.value) return

  const providerName = newProviderName.value.trim()

  // Get file extension from uploaded file
  const fileExt = newProviderFile.value.name.split('.').pop()?.toLowerCase() || 'png'
  const filename = providerName.toLowerCase().replace(/\s+/g, '-') + '.' + fileExt
  const logoPath = `logo/${filename}`

  console.log('[Logo Manager] Adding new provider:', providerName)
  console.log('[Logo Manager] File:', newProviderFile.value.name, newProviderFile.value.type, newProviderFile.value.size)
  console.log('[Logo Manager] Using extension:', fileExt)

  // Create preview URL for the new file
  const previewUrl = URL.createObjectURL(newProviderFile.value)
  console.log('[Logo Manager] Created preview URL:', previewUrl)

  // Add to local mapping
  localLogoMapping.value[providerName] = logoPath

  // Store preview URL
  pendingFilePreviews.value[providerName] = previewUrl

  console.log('[Logo Manager] Pending previews:', Object.keys(pendingFilePreviews.value))

  // Track change
  pendingChanges.value.push({
    type: 'add',
    providerName,
    file: newProviderFile.value
  })

  // Reset form
  newProviderName.value = ''
  newProviderFile.value = null
  if (newProviderFileInput.value) {
    newProviderFileInput.value.value = ''
  }
}

// Trigger update logo
const triggerUpdateLogo = (providerName: string) => {
  const input = updateFileInputs.value[providerName]
  if (input) {
    input.click()
  }
}

// Handle update provider image
const handleUpdateProviderImage = (e: Event, providerName: string) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    const oldPath = localLogoMapping.value[providerName]

    // Create preview URL for the updated file
    if (pendingFilePreviews.value[providerName]) {
      URL.revokeObjectURL(pendingFilePreviews.value[providerName])
    }
    pendingFilePreviews.value[providerName] = URL.createObjectURL(file)

    // Remove previous update change for this provider if exists
    pendingChanges.value = pendingChanges.value.filter(
      change => !(change.type === 'update' && change.providerName === providerName)
    )

    // Track change
    pendingChanges.value.push({
      type: 'update',
      providerName,
      file,
      oldPath
    })
  }
}

// Confirm delete provider
const confirmDeleteProvider = (providerName: string) => {
  if (!confirm(`Are you sure you want to delete the logo for "${providerName}"?`)) {
    return
  }

  console.log('[Logo Manager] Deleting provider:', providerName)

  const oldPath = localLogoMapping.value[providerName]

  // Revoke preview URL if exists
  if (pendingFilePreviews.value[providerName]) {
    URL.revokeObjectURL(pendingFilePreviews.value[providerName])
    delete pendingFilePreviews.value[providerName]
  }

  // Remove from local mapping
  delete localLogoMapping.value[providerName]

  // Track change
  pendingChanges.value.push({
    type: 'delete',
    providerName,
    oldPath
  })

  console.log('[Logo Manager] Pending changes after delete:', pendingChanges.value.length)
  console.log('[Logo Manager] Changes:', pendingChanges.value)
}

// Handle image error
const handleImageError = (e: Event) => {
  const img = e.target as HTMLImageElement
  console.warn('[Logo Manager] Image load error:', img.src)

  // Don't replace blob URLs with placeholder (they should be valid)
  if (img.src.startsWith('blob:')) {
    console.error('[Logo Manager] Blob URL failed to load:', img.src)
    return
  }

  // Only replace remote URLs with placeholder
  img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E'
}

// Save changes
const saveChanges = async () => {
  if (pendingChanges.value.length === 0) return

  try {
    isSubmitting.value = true

    // Prepare files data
    const filesToUpload: Record<string, string> = {}
    const filesToDelete: string[] = []

    for (const change of pendingChanges.value) {
      if (change.type === 'add' || change.type === 'update') {
        if (change.file) {
          console.log('[Logo Manager] Processing file:', change.file.name, change.file.type, change.file.size, 'bytes')

          const base64Content = await fileToBase64(change.file)
          console.log('[Logo Manager] Base64 content length:', base64Content.length)
          console.log('[Logo Manager] Base64 content start:', base64Content.substring(0, 100))

          const logoPath = localLogoMapping.value[change.providerName]
          filesToUpload[logoPath] = base64Content
        }
      } else if (change.type === 'delete') {
        // Track deleted file path
        if (change.oldPath) {
          filesToDelete.push(change.oldPath)
          console.log('[Logo Manager] Marking file for deletion:', change.oldPath)
        }
      }
    }

    console.log('[Logo Manager] Files to upload:', Object.keys(filesToUpload).length)
    console.log('[Logo Manager] Files to delete:', filesToDelete.length)

    // Call API to update logos
    const response = await $fetch('/api/github/logos/update', {
      method: 'POST',
      body: {
        repo: props.repo,
        branch: props.branch,
        logoMapping: localLogoMapping.value,
        files: filesToUpload,
        deletedFiles: filesToDelete
      }
    })

    if (response.success) {
      // Set success state with commit info
      saveSuccess.value = {
        commitSha: response.commit.sha,
        commitUrl: response.commit.url
      }

      // Mark that we just saved (to avoid overwriting with stale cache)
      justSaved.value = true

      // Clear pending changes and previews
      pendingChanges.value = []

      // Revoke old preview URLs
      Object.values(pendingFilePreviews.value).forEach(url => URL.revokeObjectURL(url))
      pendingFilePreviews.value = {}

      console.log('[Logo Manager] Save successful, local mapping has', Object.keys(localLogoMapping.value).length, 'providers')

      // Trigger refresh (will update parent's logoMapping)
      emit('refresh')

      // Note: localLogoMapping already reflects the changes (add/update/delete were applied locally)
      // So the UI should already show the correct state
    } else {
      throw new Error(response.message || 'Failed to save changes')
    }
  } catch (error: any) {
    console.error('Failed to save logo changes:', error)
    alert(`Failed to save changes: ${error.message || 'Unknown error'}`)
  } finally {
    isSubmitting.value = false
  }
}

// Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer
      // Convert ArrayBuffer to base64
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      console.log('[Logo Manager] Converted file to base64:', {
        fileName: file.name,
        fileSize: file.size,
        base64Length: base64.length
      })
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// Close dialog
const closeDialog = () => {
  if (pendingChanges.value.length > 0 && !saveSuccess.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
      return
    }
    // If user discards unsaved changes, reset to props
    localLogoMapping.value = { ...props.logoMapping }
  }

  // If changes were saved successfully, keep localLogoMapping as is
  // (it already reflects the saved state, and parent will refresh on next open)

  // Revoke preview URLs
  Object.values(pendingFilePreviews.value).forEach(url => URL.revokeObjectURL(url))

  // Reset state
  pendingChanges.value = []
  pendingFilePreviews.value = {}
  searchQuery.value = ''
  newProviderName.value = ''
  newProviderFile.value = null
  saveSuccess.value = null

  emit('update:open', false)
}
</script>
