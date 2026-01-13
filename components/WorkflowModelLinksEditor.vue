<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>Workflow Model Links Editor</DialogTitle>
        <DialogDescription>
          Validate and edit model links in workflow JSON files
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto space-y-4">
        <!-- Notification Toast -->
        <div
          v-if="notification"
          class="p-3 rounded-lg text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300"
          :class="{
            'bg-green-50 text-green-800 border border-green-200': notification.type === 'success',
            'bg-red-50 text-red-800 border border-red-200': notification.type === 'error',
            'bg-blue-50 text-blue-800 border border-blue-200': notification.type === 'info'
          }"
        >
          <span>{{ notification.message }}</span>
          <button
            @click="notification = null"
            class="ml-4 text-current opacity-70 hover:opacity-100"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Upload Section -->
        <Card v-if="!workflowData">
          <CardContent class="pt-6">
            <div class="flex flex-col items-center gap-4">
              <input
                ref="fileInput"
                type="file"
                accept=".json"
                @change="handleFileUpload"
                class="hidden"
              />
              <Button @click="() => fileInput?.click()" size="lg" class="gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Workflow JSON
              </Button>
              <p class="text-xs text-muted-foreground">Or paste JSON content below</p>
              <Textarea
                v-model="jsonInput"
                placeholder="Paste your workflow JSON here..."
                class="min-h-[200px] font-mono text-xs"
              />
              <Button
                v-if="jsonInput"
                @click="parseJSON"
                :disabled="parsing"
                class="w-full"
              >
                {{ parsing ? 'Parsing...' : 'Parse JSON' }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Statistics Panel -->
        <Card v-if="workflowData">
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle class="text-base">Model Links Statistics</CardTitle>
              <Button variant="outline" size="sm" @click="resetEditor">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div class="text-center p-3 bg-gray-50 rounded-lg">
                <div class="text-2xl font-bold text-gray-900">{{ stats.totalModels }}</div>
                <div class="text-xs text-muted-foreground">Total Models</div>
              </div>
              <div class="text-center p-3 bg-green-50 rounded-lg">
                <div class="text-2xl font-bold text-green-600">{{ stats.validModels }}</div>
                <div class="text-xs text-muted-foreground">Valid Links</div>
              </div>
              <div class="text-center p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100" @click="scrollToFirstMissing">
                <div class="text-2xl font-bold text-yellow-600">{{ stats.missingLinks }}</div>
                <div class="text-xs text-muted-foreground">Missing Links</div>
              </div>
              <div class="text-center p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100" @click="scrollToFirstInvalid">
                <div class="text-2xl font-bold text-red-600">{{ stats.invalidLinks }}</div>
                <div class="text-xs text-muted-foreground">Invalid Links</div>
              </div>
              <div class="text-center p-3 bg-blue-50 rounded-lg">
                <div class="text-2xl font-bold text-blue-600">{{ stats.errorFormats }}</div>
                <div class="text-xs text-muted-foreground">Format Errors</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Model Nodes List -->
        <div v-if="workflowData && modelNodes.length > 0" class="space-y-4">
          <div
            v-for="(nodeInfo, index) in modelNodes"
            :key="`${nodeInfo.node.id}-${index}`"
            :ref="el => { if (el) nodeRefs[index] = el }"
            class="border rounded-lg p-4"
            :class="{
              'border-red-300 bg-red-50': nodeInfo.hasErrors,
              'border-yellow-300 bg-yellow-50': nodeInfo.hasWarnings && !nodeInfo.hasErrors,
              'border-green-300 bg-green-50': !nodeInfo.hasErrors && !nodeInfo.hasWarnings
            }"
          >
            <!-- Node Header -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm">{{ nodeInfo.node.type }}</span>
                <span class="text-xs text-muted-foreground">ID: {{ nodeInfo.node.id }}</span>
                <span v-if="nodeInfo.node._source === 'subgraph'" class="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                  📦 Subgraph
                </span>
                <span v-if="nodeInfo.isCustomNode" class="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded" title="Custom node - manual link addition required">
                  🔧 Custom Node
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span v-if="nodeInfo.hasErrors" class="text-xs text-red-600 font-medium">Errors: {{ nodeInfo.errorCount }}</span>
                <span v-if="nodeInfo.hasWarnings" class="text-xs text-yellow-600 font-medium">Warnings: {{ nodeInfo.warningCount }}</span>
              </div>
            </div>

            <!-- Model File Path -->
            <div v-if="nodeInfo.modelFiles.length > 0" class="mb-3">
              <Label class="text-xs">Model File Path</Label>
              <Input
                v-model="nodeInfo.modelFiles[0]"
                @input="updateWidgetsValue(nodeInfo, 0, $event.target.value)"
                placeholder="Model file path"
                class="font-mono text-xs"
              />
            </div>

            <!-- Models List -->
            <div class="space-y-3">
              <div
                v-for="(model, modelIndex) in nodeInfo.existingModels"
                :key="`${nodeInfo.node.id}-model-${modelIndex}`"
                class="p-3 bg-white rounded border"
                :class="{
                  'border-red-300': !model.valid,
                  'border-green-300': model.valid
                }"
              >
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <!-- Model Name -->
                  <div>
                    <Label class="text-xs">Model Name</Label>
                    <div class="relative">
                      <Input
                        v-model="model.name"
                        @input="validateModel(model, nodeInfo)"
                        placeholder="Model file name"
                        class="text-xs"
                      />
                      <div
                        v-if="model.nameValid === false"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500"
                        title="Name doesn't match file"
                      ></div>
                      <div
                        v-else-if="model.nameValid === true"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500"
                        title="Name matches file"
                      ></div>
                    </div>
                  </div>

                  <!-- Model URL -->
                  <div>
                    <Label class="text-xs">Model URL</Label>
                    <div class="relative">
                      <Input
                        v-model="model.url"
                        @input="validateModel(model, nodeInfo)"
                        @blur="convertHuggingFaceUrl(model)"
                        placeholder="Model download URL"
                        class="text-xs"
                      />
                      <div
                        v-if="!model.url"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-yellow-500"
                        title="URL is missing"
                      ></div>
                      <div
                        v-else-if="model.urlValid === false"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500"
                        title="Invalid URL format"
                      ></div>
                      <div
                        v-else-if="model.urlValid === true"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500"
                        title="Valid URL"
                      ></div>
                    </div>
                  </div>

                  <!-- Directory -->
                  <div>
                    <Label class="text-xs">Directory</Label>
                    <Input
                      v-model="model.directory"
                      placeholder="Storage directory"
                      class="text-xs"
                      :disabled="true"
                    />
                  </div>
                </div>

                <!-- Remove Button -->
                <div class="mt-2 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    @click="removeModel(nodeInfo, modelIndex)"
                    class="text-xs"
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <!-- Add Model Button -->
              <Button
                variant="outline"
                size="sm"
                @click="addModel(nodeInfo)"
                class="w-full text-xs"
              >
                + Add Model
              </Button>

              <!-- Custom Node Info -->
              <div v-if="nodeInfo.isCustomNode" class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="text-blue-900">
                    <div class="font-semibold mb-1">💡 Custom Node Detected</div>
                    <p>This is a custom node. Please manually add model download links to the generated note below. The workflow will work without embedding links in properties.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <Card v-if="workflowData && modelNodes.length === 0">
          <CardContent class="pt-6">
            <div class="text-center text-muted-foreground">
              <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No model nodes found in this workflow</p>
            </div>
          </CardContent>
        </Card>

        <!-- Generate Note Section -->
        <Card v-if="workflowData && modelNodes.length > 0">
          <CardHeader>
            <CardTitle class="text-base">Generate Markdown Note</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div>
              <Label class="text-xs">Tutorial URL (optional)</Label>
              <Input
                v-model="tutorialUrl"
                placeholder="https://docs.comfy.org/tutorials/..."
                class="text-xs"
              />
            </div>
            <div>
              <Label class="text-xs">Tutorial Title (optional)</Label>
              <Input
                v-model="tutorialTitle"
                placeholder="Tutorial"
                class="text-xs"
              />
            </div>
            <div class="flex gap-2">
              <Button @click="generateNote" class="flex-1" variant="outline">
                Generate Note
              </Button>
              <Button
                v-if="generatedNote"
                @click="copyNote"
                class="flex-1"
              >
                Copy Note
              </Button>
            </div>
            <Textarea
              v-if="generatedNote"
              v-model="generatedNote"
              readonly
              class="min-h-[300px] font-mono text-xs"
            />
          </CardContent>
        </Card>
      </div>

      <!-- Instructions -->
      <Card v-if="workflowData" class="border-blue-200 bg-blue-50">
        <CardContent class="pt-4">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="text-sm text-blue-900">
              <div class="font-semibold mb-1">📝 Next Steps</div>
              <ol class="list-decimal list-inside space-y-1 text-xs">
                <li>Click <strong>"Download Updated JSON"</strong> to save the workflow with model links</li>
                <li>Generate and copy the <strong>Note</strong> above (contains model download links)</li>
                <li>Add the note to your workflow documentation to help users find required models</li>
                <li>Re-upload the updated workflow file to replace the current version</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <DialogFooter class="flex-col sm:flex-row gap-2">
        <Button variant="outline" @click="isOpen = false">
          Close
        </Button>
        <Button
          v-if="workflowData"
          @click="saveWorkflow"
          :disabled="stats.errorFormats > 0"
          class="gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Updated JSON
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

interface Props {
  open?: boolean
  initialWorkflow?: any
  workflowFilename?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'workflow-updated': [workflow: any]
}>()

const isOpen = ref(props.open || false)
const fileInput = ref<HTMLInputElement | null>(null)
const jsonInput = ref('')
const parsing = ref(false)
const workflowData = ref<any>(null)
const modelNodes = ref<any[]>([])
const tutorialUrl = ref('')
const tutorialTitle = ref('Tutorial')
const generatedNote = ref('')
const nodeRefs = ref<any[]>([])

// Notification system
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
let notificationTimeout: ReturnType<typeof setTimeout> | null = null

const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  notification.value = { message, type }
  if (notificationTimeout) clearTimeout(notificationTimeout)
  notificationTimeout = setTimeout(() => {
    notification.value = null
  }, 3000)
}

// Configuration loaded from public directory
const config = ref<any>(null)
const directoryRules = computed(() => config.value?.directoryRules || {})
const customNodeRules = computed(() => config.value?.customNodeRules || [])

watch(() => props.open, (value) => {
  isOpen.value = value || false
  if (value && props.initialWorkflow) {
    try {
      // If initialWorkflow is a string, parse it; otherwise use it directly
      if (typeof props.initialWorkflow === 'string') {
        workflowData.value = JSON.parse(props.initialWorkflow)
      } else {
        workflowData.value = props.initialWorkflow
      }
      parseWorkflow()
    } catch (error) {
      console.error('[WorkflowModelLinksEditor] Failed to parse initial workflow:', error)
    }
  }
}, { immediate: true })

watch(isOpen, (value, oldValue) => {
  emit('update:open', value)
  // When dialog closes, save models to workflow and emit the updated workflow
  if (oldValue && !value && workflowData.value) {
    // Save all model data to node properties before emitting
    for (const nodeInfo of modelNodes.value) {
      // Skip custom nodes - they don't need properties.models
      if (nodeInfo.isCustomNode) continue

      const node = findNode(nodeInfo.node.id, nodeInfo.node._source, nodeInfo.node._subgraphIndex)
      if (!node) continue

      if (!node.properties) node.properties = {}

      // Filter valid models
      const validModels = nodeInfo.existingModels.filter((m: any) =>
        m.name && m.url && m.directory
      )

      if (validModels.length > 0) {
        node.properties.models = validModels.map((m: any) => ({
          name: m.name,
          url: m.url,
          directory: m.directory
        }))
      }
    }

    emit('workflow-updated', workflowData.value)
  }
})

// Load configuration on mount
onMounted(async () => {
  try {
    // Fetch from API endpoint instead of public folder
    const response = await fetch('/api/config/workflow-model-config.json')
    config.value = await response.json()
  } catch (error) {
    console.error('[WorkflowModelLinksEditor] Failed to load config:', error)
  }
})

// Statistics
const stats = computed(() => {
  let total = 0
  let valid = 0
  let missing = 0
  let invalid = 0
  let errors = 0

  for (const nodeInfo of modelNodes.value) {
    for (const model of nodeInfo.existingModels) {
      total++
      if (model.valid) {
        valid++
      } else {
        if (!model.url) {
          missing++
        } else if (model.urlValid === false) {
          invalid++
        }
        if (model.nameValid === false) {
          errors++
        }
      }
    }
  }

  return {
    totalModels: total,
    validModels: valid,
    missingLinks: missing,
    invalidLinks: invalid,
    errorFormats: errors
  }
})

// Handle file upload
const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    jsonInput.value = text
    await parseJSON()
  } catch (error) {
    console.error('Failed to read file:', error)
    showNotification('Failed to read file', 'error')
  }
}

// Parse JSON
const parseJSON = async () => {
  if (!jsonInput.value.trim()) return

  parsing.value = true
  try {
    workflowData.value = JSON.parse(jsonInput.value)
    parseWorkflow()
  } catch (error: any) {
    console.error('Failed to parse JSON:', error)
    showNotification(`Failed to parse JSON: ${error.message}`, 'error')
  } finally {
    parsing.value = false
  }
}

// Parse workflow to extract model nodes
const parseWorkflow = () => {
  if (!workflowData.value) return

  const nodes: any[] = []

  // Main nodes
  if (workflowData.value.nodes && Array.isArray(workflowData.value.nodes)) {
    for (const node of workflowData.value.nodes) {
      nodes.push({
        ...node,
        _source: 'main',
        _subgraphIndex: null
      })
    }
  }

  // Subgraph nodes
  if (workflowData.value.definitions?.subgraphs) {
    for (let i = 0; i < workflowData.value.definitions.subgraphs.length; i++) {
      const subgraph = workflowData.value.definitions.subgraphs[i]
      if (subgraph.nodes && Array.isArray(subgraph.nodes)) {
        for (const node of subgraph.nodes) {
          nodes.push({
            ...node,
            _source: 'subgraph',
            _subgraphIndex: i
          })
        }
      }
    }
  }

  // Filter model nodes
  const modelNodesList = []
  for (const node of nodes) {
    const isModelNode = node.properties?.['Node name for S&R'] && node.type in directoryRules.value
    if (!isModelNode) continue

    const modelFiles = extractModelFiles(node)
    if (modelFiles.length === 0) continue

    // Check if this is a custom node
    const isCustomNode = customNodeRules.value.includes(node.type)

    const existingModels = node.properties?.models || []
    const models = []

    // Process existing models
    for (const model of existingModels) {
      models.push({
        name: model.name || '',
        url: model.url || '',
        directory: model.directory || directoryRules.value[node.type] || '',
        valid: false,
        nameValid: null,
        urlValid: null
      })
    }

    // Add missing models
    const existingNames = models.map(m => m.name)
    for (const file of modelFiles) {
      const fileName = file.split(/[\\\/]/).pop()
      if (!existingNames.includes(fileName)) {
        models.push({
          name: fileName,
          url: '',
          directory: directoryRules.value[node.type] || '',
          valid: false,
          nameValid: null,
          urlValid: null
        })
      }
    }

    modelNodesList.push({
      node,
      modelFiles,
      existingModels: models,
      isCustomNode, // Mark if this is a custom node
      hasErrors: false,
      hasWarnings: false,
      errorCount: 0,
      warningCount: 0
    })
  }

  modelNodes.value = modelNodesList

  // Validate all models
  for (const nodeInfo of modelNodes.value) {
    for (const model of nodeInfo.existingModels) {
      validateModel(model, nodeInfo)
    }
  }
}

// Extract model files from node
const extractModelFiles = (node: any): string[] => {
  if (!node.widgets_values || !Array.isArray(node.widgets_values)) return []

  const files = []
  for (const value of node.widgets_values) {
    if (typeof value === 'string' && value.trim()) {
      const lowerValue = value.toLowerCase()
      if (lowerValue.includes('.safetensors') || lowerValue.includes('.sft')) {
        files.push(value)
      }
    }
  }
  return files
}

// Validate model
const validateModel = (model: any, nodeInfo: any) => {
  // Validate name
  const fileName = nodeInfo.modelFiles[0]?.split(/[\\\/]/).pop() || ''
  model.nameValid = fileName && model.name ? model.name === fileName : null

  // Validate URL
  if (!model.url) {
    model.urlValid = null
  } else if (!model.url.includes('http')) {
    model.urlValid = false
  } else {
    // Check Hugging Face format
    const isHF = model.url.includes('huggingface.co')
    const hasBlob = model.url.includes('/blob/')
    const hasTree = model.url.includes('/tree/')
    const hasResolve = model.url.includes('/resolve/')

    if (isHF && (hasBlob || hasTree) && !hasResolve) {
      model.urlValid = false
    } else {
      // Check if URL contains model name
      const urlFileName = model.url.split('/').pop()?.split('?')[0] || ''
      model.urlValid = urlFileName === model.name
    }
  }

  model.valid = model.nameValid === true && model.urlValid === true

  // Update node stats
  updateNodeStats(nodeInfo)
  updateAllStats()
}

// Update node statistics
const updateNodeStats = (nodeInfo: any) => {
  let errors = 0
  let warnings = 0

  // Custom nodes only show warnings, not errors
  if (nodeInfo.isCustomNode) {
    for (const model of nodeInfo.existingModels) {
      if (!model.url) {
        warnings++
      }
    }
  } else {
    // Standard nodes show errors for invalid links
    for (const model of nodeInfo.existingModels) {
      if (model.nameValid === false || model.urlValid === false) {
        errors++
      }
      if (!model.url) {
        warnings++
      }
    }
  }

  nodeInfo.errorCount = errors
  nodeInfo.warningCount = warnings
  nodeInfo.hasErrors = errors > 0
  nodeInfo.hasWarnings = warnings > 0
}

// Update all statistics
const updateAllStats = () => {
  // Trigger reactivity
  modelNodes.value = [...modelNodes.value]
}

// Convert Hugging Face URL
const convertHuggingFaceUrl = (model: any) => {
  if (!model.url) return

  let url = model.url.trim()
  if (url.includes('huggingface.co') && !url.includes('/resolve/')) {
    if (url.includes('/blob/')) {
      model.url = url.replace('/blob/', '/resolve/')
      showNotification('Converted Hugging Face blob link to resolve link', 'success')
    } else if (url.includes('/tree/')) {
      model.url = url.replace('/tree/', '/resolve/')
      showNotification('Converted Hugging Face tree link to resolve link', 'success')
    }
  }

  validateModel(model, modelNodes.value.find(n => n.existingModels.includes(model)))
}

// Update widgets value
const updateWidgetsValue = (nodeInfo: any, index: number, newValue: string) => {
  const oldValue = nodeInfo.modelFiles[index]
  nodeInfo.modelFiles[index] = newValue

  // Update in workflow data
  const node = findNode(nodeInfo.node.id, nodeInfo.node._source, nodeInfo.node._subgraphIndex)
  if (node && node.widgets_values) {
    const idx = node.widgets_values.indexOf(oldValue)
    if (idx !== -1) {
      node.widgets_values[idx] = newValue
    }
  }

  // Update model names if needed
  const newFileName = newValue.split(/[\\\/]/).pop()
  if (nodeInfo.existingModels.length > 0 && nodeInfo.existingModels[0].name === oldValue.split(/[\\\/]/).pop()) {
    nodeInfo.existingModels[0].name = newFileName
  }

  // Revalidate
  for (const model of nodeInfo.existingModels) {
    validateModel(model, nodeInfo)
  }
}

// Find node in workflow data
const findNode = (nodeId: number, source: string, subgraphIndex: number | null) => {
  if (source === 'subgraph' && subgraphIndex !== null) {
    const subgraph = workflowData.value.definitions?.subgraphs[subgraphIndex]
    return subgraph?.nodes?.find((n: any) => n.id === nodeId)
  }
  return workflowData.value.nodes?.find((n: any) => n.id === nodeId)
}

// Add model
const addModel = (nodeInfo: any) => {
  nodeInfo.existingModels.push({
    name: '',
    url: '',
    directory: directoryRules.value[nodeInfo.node.type] || '',
    valid: false,
    nameValid: null,
    urlValid: null
  })
}

// Remove model
const removeModel = (nodeInfo: any, index: number) => {
  nodeInfo.existingModels.splice(index, 1)
  updateNodeStats(nodeInfo)
}

// Scroll to first missing
const scrollToFirstMissing = () => {
  const index = modelNodes.value.findIndex(n =>
    n.existingModels.some((m: any) => !m.url)
  )
  if (index !== -1 && nodeRefs.value[index]) {
    nodeRefs.value[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// Scroll to first invalid
const scrollToFirstInvalid = () => {
  const index = modelNodes.value.findIndex(n => n.hasErrors)
  if (index !== -1 && nodeRefs.value[index]) {
    nodeRefs.value[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// Generate note
const generateNote = () => {
  if (!workflowData.value || !config.value) return

  const template = config.value.noteTemplate
  let note = template.header

  // Tutorial
  if (tutorialUrl.value) {
    note += `[${tutorialTitle.value}](${tutorialUrl.value})\n\n`
  }

  // Model links
  note += template.modelLinksHeader

  // Group by directory
  const modelsByDir: Record<string, any[]> = {}
  for (const nodeInfo of modelNodes.value) {
    for (const model of nodeInfo.existingModels) {
      if (!model.url) continue
      const dir = model.directory || 'unknown'
      if (!modelsByDir[dir]) modelsByDir[dir] = []
      modelsByDir[dir].push(model)
    }
  }

  // Add models by directory
  for (const dir in modelsByDir) {
    note += `**${dir}**\n\n`
    for (const model of modelsByDir[dir]) {
      note += `- [${model.name}](${model.url})\n`
    }
    note += '\n'
  }

  // Add custom nodes section (models without URLs)
  const customNodeModels: Record<string, any[]> = {}
  for (const nodeInfo of modelNodes.value) {
    if (nodeInfo.isCustomNode) {
      for (const model of nodeInfo.existingModels) {
        const dir = model.directory || 'unknown'
        if (!customNodeModels[dir]) customNodeModels[dir] = []
        customNodeModels[dir].push({ ...model, nodeType: nodeInfo.node.type })
      }
    }
  }

  if (Object.keys(customNodeModels).length > 0) {
    note += `**Custom Nodes** (Please add download links manually)\n\n`
    for (const dir in customNodeModels) {
      note += `*${dir}/* (from custom node loaders)\n`
      for (const model of customNodeModels[dir]) {
        note += `- ${model.name} (${model.nodeType}): [Add link here]\n`
      }
      note += '\n'
    }
  }

  // Storage location
  note += template.storageLocationHeader
  for (const dir in modelsByDir) {
    note += `│   ├── 📂 ${dir}/\n`
    for (const model of modelsByDir[dir]) {
      note += `│   │   ├── ${model.name}\n`
    }
  }
  note += template.storageLocationFooter

  // Report issue section (moved to bottom)
  note += template.reportIssueSection

  generatedNote.value = note
}

// Copy note
const copyNote = async () => {
  if (!generatedNote.value) return

  try {
    await navigator.clipboard.writeText(generatedNote.value)
    showNotification('Note copied to clipboard!', 'success')
  } catch (error) {
    console.error('Failed to copy:', error)
    showNotification('Failed to copy to clipboard', 'error')
  }
}

// Save workflow
const saveWorkflow = () => {
  if (!workflowData.value) return

  // Update all nodes with model data (skip custom nodes)
  for (const nodeInfo of modelNodes.value) {
    // Skip custom nodes - they don't need properties.models
    if (nodeInfo.isCustomNode) {
      console.log(`[WorkflowModelLinksEditor] Skipping custom node: ${nodeInfo.node.type}`)
      continue
    }

    const node = findNode(nodeInfo.node.id, nodeInfo.node._source, nodeInfo.node._subgraphIndex)
    if (!node) continue

    if (!node.properties) node.properties = {}

    // Filter valid models
    const validModels = nodeInfo.existingModels.filter((m: any) =>
      m.name && m.url && m.directory
    )

    if (validModels.length > 0) {
      node.properties.models = validModels.map((m: any) => ({
        name: m.name,
        url: m.url,
        directory: m.directory
      }))
    }
  }

  // Download JSON
  const json = JSON.stringify(workflowData.value, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // Use the provided workflow filename, or fallback to generic name
  const filename = props.workflowFilename || 'workflow_updated.json'
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  emit('workflow-updated', workflowData.value)
  showNotification(`Workflow downloaded as ${filename}!`, 'success')
}

// Reset editor
const resetEditor = () => {
  workflowData.value = null
  modelNodes.value = []
  jsonInput.value = ''
  generatedNote.value = ''
  tutorialUrl.value = ''
  tutorialTitle.value = 'Tutorial'
}
</script>
