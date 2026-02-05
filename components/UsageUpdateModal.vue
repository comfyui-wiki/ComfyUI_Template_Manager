<template>
  <Dialog v-model:open="isOpen">
    <DialogScrollContent class="max-w-3xl max-h-[90vh]">
      <DialogHeader>
        <DialogTitle>Update Template Usage Data</DialogTitle>
        <DialogDescription>
          Upload a CSV file to batch update usage counts for all templates across all index files
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Upload Section -->
        <div v-if="!parsedData" class="space-y-3">
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              ref="fileInput"
              type="file"
              accept=".csv"
              @change="handleFileUpload"
              class="hidden"
            />
            <div class="space-y-3">
              <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <Button @click="() => fileInput?.click()" size="lg">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload CSV File
                </Button>
                <p class="text-xs text-muted-foreground mt-2">
                  CSV format: Metric, workflow_name, usage_count
                </p>
              </div>
            </div>
          </div>

          <!-- Example Format -->
          <Card>
            <CardHeader>
              <CardTitle class="text-sm">Expected CSV Format</CardTitle>
            </CardHeader>
            <CardContent>
              <pre class="text-xs bg-muted p-3 rounded overflow-x-auto">Metric,workflow_name,"Date Range"
Total Events of execution_start,flux_dev_checkpoint_example,372
Total Events of execution_start,image_qwen_Image_2512,1847
...</pre>
            </CardContent>
          </Card>
        </div>

        <!-- Parsed Data Preview -->
        <div v-if="parsedData && !isSubmitting" class="space-y-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm">Parsed Data Summary</CardTitle>
                <Button variant="outline" size="sm" @click="resetUpload">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-3 gap-4 text-center">
                <div class="p-3 bg-blue-50 rounded-lg">
                  <div class="text-2xl font-bold text-blue-600">{{ Object.keys(parsedData).length }}</div>
                  <div class="text-xs text-muted-foreground">Templates Found</div>
                </div>
                <div class="p-3 bg-green-50 rounded-lg">
                  <div class="text-2xl font-bold text-green-600">{{ totalUsage }}</div>
                  <div class="text-xs text-muted-foreground">Total Usage</div>
                </div>
                <div class="p-3 bg-purple-50 rounded-lg">
                  <div class="text-2xl font-bold text-purple-600">12</div>
                  <div class="text-xs text-muted-foreground">Index Files</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Data Preview -->
          <Card>
            <CardHeader>
              <CardTitle class="text-sm">Data Preview (First 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="max-h-60 overflow-y-auto">
                <table class="w-full text-xs">
                  <thead class="sticky top-0 bg-muted">
                    <tr>
                      <th class="text-left p-2">Template Name</th>
                      <th class="text-right p-2">Usage Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(value, name) in previewData" :key="name" class="border-b">
                      <td class="p-2 font-mono">{{ name }}</td>
                      <td class="p-2 text-right font-semibold">{{ value }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="Object.keys(parsedData).length > 10" class="text-xs text-muted-foreground mt-2 text-center">
                ... and {{ Object.keys(parsedData).length - 10 }} more
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>{{ error }}</div>
          </div>
        </div>

        <!-- Success Message -->
        <div v-if="success" class="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>{{ success }}</div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="isSubmitting" class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium">Updating templates...</span>
            <span class="text-muted-foreground">{{ updateProgress.current }} / {{ updateProgress.total }}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              class="bg-primary h-2 transition-all duration-300"
              :style="{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" @click="closeModal" :disabled="isSubmitting">
          Cancel
        </Button>
        <Button
          @click="handleSubmit"
          :disabled="!parsedData || isSubmitting"
        >
          <svg v-if="isSubmitting" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isSubmitting ? 'Updating...' : 'Update All Templates' }}
        </Button>
      </div>
    </DialogScrollContent>
  </Dialog>

  <!-- Main Branch Warning Dialog -->
  <MainBranchWarningDialog
    v-model:open="showMainBranchWarning"
    :repo="repo"
    :branch="branch"
    :timing="warningTiming"
    action-type="Update Usage Data"
    @confirm="handleConfirmMainBranchSubmit"
    @cancel="handleCancelMainBranchSubmit"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogScrollContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import MainBranchWarningDialog from '~/components/MainBranchWarningDialog.vue'

interface Props {
  open: boolean
  repo: string
  branch: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'updated': []
}>()

const isOpen = ref(props.open)
const fileInput = ref<HTMLInputElement>()
const parsedData = ref<Record<string, number> | null>(null)
const error = ref('')
const success = ref('')
const isSubmitting = ref(false)
const updateProgress = ref({ current: 0, total: 0 })

// Main branch warning dialog state
const showMainBranchWarning = ref(false)
const pendingSubmit = ref(false)
const warningTiming = ref<'opening' | 'saving'>('opening')

watch(() => props.open, (value) => {
  isOpen.value = value

  // Check for main branch when opening dialog
  if (value) {
    const isMainBranch = props.branch === 'main' || props.branch === 'master'

    if (isMainBranch) {
      // Show warning when opening usage updater on main branch
      warningTiming.value = 'opening'
      showMainBranchWarning.value = true
    }
  }
})

watch(isOpen, (value) => {
  emit('update:open', value)
  if (!value) {
    // Reset on close
    setTimeout(() => {
      resetUpload()
    }, 300)
  }
})

// Computed: Total usage count
const totalUsage = computed(() => {
  if (!parsedData.value) return 0
  return Object.values(parsedData.value).reduce((sum, count) => sum + count, 0)
})

// Computed: Preview data (first 10)
const previewData = computed(() => {
  if (!parsedData.value) return {}
  const entries = Object.entries(parsedData.value)
  return Object.fromEntries(entries.slice(0, 10))
})

// Parse CSV file
const parseCSV = (text: string): Record<string, number> => {
  const lines = text.trim().split('\n')
  const result: Record<string, number> = {}

  // Skip header line (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse CSV line (handle quoted fields)
    const match = line.match(/^[^,]*,([^,]+),(\d+)$/)
    if (match) {
      const templateName = match[1].trim()
      const usage = parseInt(match[2], 10)
      if (templateName && !isNaN(usage)) {
        result[templateName] = usage
      }
    }
  }

  return result
}

// Handle file upload
const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  error.value = ''
  success.value = ''

  try {
    const text = await file.text()
    const data = parseCSV(text)

    if (Object.keys(data).length === 0) {
      throw new Error('No valid data found in CSV file')
    }

    parsedData.value = data
    console.log(`[Usage Update] Parsed ${Object.keys(data).length} templates from CSV`)
  } catch (err: any) {
    console.error('[Usage Update] Parse error:', err)
    error.value = `Failed to parse CSV: ${err.message}`
    parsedData.value = null
  } finally {
    // Reset input
    input.value = ''
  }
}

// Reset upload
const resetUpload = () => {
  parsedData.value = null
  error.value = ''
  success.value = ''
  updateProgress.value = { current: 0, total: 0 }
}

// Close modal
const closeModal = () => {
  isOpen.value = false
}

// Handle main branch warning confirmation
const handleConfirmMainBranchSubmit = () => {
  pendingSubmit.value = true
  handleSubmit()
}

// Handle main branch warning cancellation
const handleCancelMainBranchSubmit = () => {
  pendingSubmit.value = false

  // If user cancels on opening warning, close usage modal
  if (warningTiming.value === 'opening') {
    isOpen.value = false
  }
}

// Handle submit
const handleSubmit = async () => {
  if (!parsedData.value) return

  // Check if committing to main branch and show warning if needed
  const isMainBranch = props.branch === 'main' || props.branch === 'master'

  // If on main branch and haven't confirmed yet, show warning dialog
  if (isMainBranch && !pendingSubmit.value) {
    warningTiming.value = 'saving'
    showMainBranchWarning.value = true
    return
  }

  // Reset pending submit flag after proceeding
  pendingSubmit.value = false

  error.value = ''
  success.value = ''
  isSubmitting.value = true

  // Total index files to update (default index.json + 11 language files)
  const totalFiles = 12
  updateProgress.value = { current: 0, total: totalFiles }

  try {
    // Call API to update all index files
    const response = await fetch('/api/github/usage/batch-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        repo: props.repo,
        branch: props.branch,
        usageData: parsedData.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update usage data')
    }

    const result = await response.json()
    console.log('[Usage Update] Success:', result)

    success.value = `Successfully updated ${result.updatedCount} templates across ${result.updatedFiles.length} files!`
    emit('updated')

    // Close modal after 2 seconds
    setTimeout(() => {
      closeModal()
    }, 2000)
  } catch (err: any) {
    console.error('[Usage Update] Error:', err)
    error.value = err.message || 'Failed to update usage data'
  } finally {
    isSubmitting.value = false
  }
}
</script>
