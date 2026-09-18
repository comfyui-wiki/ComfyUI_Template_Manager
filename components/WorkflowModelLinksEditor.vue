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
            'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800': notification.type === 'success',
            'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900': notification.type === 'error',
            'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800': notification.type === 'info'
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
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <div class="text-center p-3 dm-muted-row">
                <div class="text-2xl font-bold text-foreground">{{ stats.totalModels }}</div>
                <div class="text-xs text-muted-foreground">Total Models</div>
              </div>
              <div class="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/35">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats.validModels }}</div>
                <div class="text-xs text-muted-foreground">Valid Links</div>
              </div>
              <div class="text-center p-3 rounded-lg bg-amber-100/35 dark:bg-amber-950/[0.14] cursor-pointer hover:bg-amber-100/55 dark:hover:bg-amber-950/25" @click="scrollToFirstMissing">
                <div class="text-2xl font-bold text-amber-800 dark:text-amber-300/95">{{ stats.missingLinks }}</div>
                <div class="text-xs text-muted-foreground">Missing Links</div>
              </div>
              <div class="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/35 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50" @click="scrollToFirstInvalid">
                <div class="text-2xl font-bold text-red-600 dark:text-red-400">{{ stats.invalidLinks }}</div>
                <div class="text-xs text-muted-foreground">Invalid Links</div>
              </div>
              <div class="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/35">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ stats.errorFormats }}</div>
                <div class="text-xs text-muted-foreground">Format Errors</div>
              </div>
              <div
                class="text-center p-3 rounded-lg cursor-pointer"
                :class="stats.subgraphIssues > 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/55'
                  : 'bg-emerald-50 dark:bg-emerald-950/35'"
                @click="scrollToFirstSubgraphIssue"
              >
                <div
                  class="text-2xl font-bold"
                  :class="stats.subgraphIssues > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'"
                >
                  {{ stats.subgraphIssues }}
                </div>
                <div class="text-xs text-muted-foreground">Subgraph URL Issues</div>
              </div>
            </div>
            <div
              v-if="subgraphIssueMessages.length"
              class="mt-4 rounded-lg border border-rose-400/70 bg-rose-50 px-3 py-3 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
            >
              <p class="font-semibold">Subgraph instance models do not match download metadata</p>
              <p class="mt-1 text-xs opacity-90">
                Detection only: the filename on the subgraph instance must match the inner loader <code>properties.models</code>. This editor does not auto-write model links onto the subgraph definition.
              </p>
              <ul class="mt-2 space-y-1 text-xs font-mono">
                <li v-for="(message, index) in subgraphIssueMessages" :key="index">
                  {{ message }}
                </li>
              </ul>
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
              'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40': nodeInfo.hasErrors,
              'border-amber-300/70 bg-amber-100/30 dark:border-amber-800/60 dark:bg-amber-950/[0.12]': nodeInfo.hasWarnings && !nodeInfo.hasErrors,
              'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/35': !nodeInfo.hasErrors && !nodeInfo.hasWarnings
            }"
          >
            <!-- Node Header -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm">{{ nodeInfo.node.type }}</span>
                <span class="text-xs text-muted-foreground">ID: {{ nodeInfo.node.id }}</span>
                <span v-if="nodeInfo.isSubgraphInstance" class="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200">
                  Subgraph instance
                </span>
                <span v-else-if="nodeInfo.node._source === 'subgraph'" class="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/55 dark:text-purple-200">
                  📦 Subgraph
                </span>
                <span v-if="nodeInfo.isCustomNode" class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/55 dark:text-blue-200" title="Custom node - manual link addition required">
                  🔧 Custom Node
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span v-if="nodeInfo.hasErrors" class="text-xs text-red-600 font-medium">Errors: {{ nodeInfo.errorCount }}</span>
                <span v-if="nodeInfo.hasWarnings" class="text-xs text-amber-800 dark:text-amber-400/95 font-medium">Warnings: {{ nodeInfo.warningCount }}</span>
              </div>
            </div>

            <div
              v-if="nodeInfo.subgraphIssues?.length"
              class="mb-3 rounded-md border border-rose-300/80 bg-rose-50 px-3 py-2 text-xs text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
            >
              <p v-for="(issue, issueIndex) in nodeInfo.subgraphIssues" :key="issueIndex">
                {{ issue }}
              </p>
            </div>

            <!-- Model File Paths -->
            <div v-if="nodeInfo.modelFiles.length > 0" class="mb-3 space-y-2">
              <Label class="text-xs">Model File Path{{ nodeInfo.modelFiles.length > 1 ? 's' : '' }}</Label>
              <div v-for="(filePath, fileIndex) in nodeInfo.modelFiles" :key="`file-${fileIndex}`">
                <div class="flex items-center gap-2">
                  <span v-if="nodeInfo.modelFiles.length > 1" class="text-xs text-muted-foreground min-w-[20px]">{{ fileIndex + 1 }}.</span>
                  <Input
                    :value="filePath"
                    @input="updateWidgetsValue(nodeInfo, fileIndex, $event.target.value)"
                    :placeholder="`Model file path ${nodeInfo.modelFiles.length > 1 ? (fileIndex + 1) : ''}`"
                    class="font-mono text-xs flex-1"
                  />
                </div>
              </div>
            </div>

            <!-- Models List -->
            <div class="space-y-3">
              <div
                v-for="(model, modelIndex) in nodeInfo.existingModels"
                :key="`${nodeInfo.node.id}-model-${modelIndex}`"
                class="p-3 bg-card rounded border"
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
                    <div class="flex items-center gap-1.5 mb-1">
                      <Label class="text-xs">Download URL</Label>
                      <span
                        v-if="model.autoFilled"
                        class="text-[10px] px-1.5 py-0.5 rounded font-medium leading-none bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                        title="URL auto-filled from supported models list"
                      >✓ auto</span>
                    </div>
                    <div class="relative">
                      <Input
                        v-model="model.url"
                        @input="model.autoFilled = false; validateModel(model, nodeInfo)"
                        @blur="convertHuggingFaceUrl(model)"
                        placeholder="Direct file download URL"
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
                        v-else-if="model.isCivitai"
                        class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-orange-400 text-white text-[9px] font-bold leading-none cursor-default"
                        title="CivitAI URL — filename cannot be verified automatically"
                      >?</div>
                      <div
                        v-else-if="model.urlValid === true"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500"
                        title="Valid URL"
                      ></div>
                    </div>
                    <a
                      v-if="model.isCivitai && model.url"
                      :href="model.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 mt-1 text-[10px] text-orange-600 hover:text-orange-500 hover:underline dark:text-orange-400 dark:hover:text-orange-300"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Visit to verify
                    </a>
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

                <div class="mt-3">
                  <div class="flex items-center gap-1.5 mb-1">
                    <Label class="text-xs">Repository URL</Label>
                    <span
                      v-if="model.repoAutoFilled"
                      class="text-[10px] px-1.5 py-0.5 rounded font-medium leading-none bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                    >from download URL</span>
                  </div>
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <Input
                        v-model="model.repo"
                        @input="model.repoAutoFilled = false; validateModel(model, nodeInfo)"
                        placeholder="Hugging Face / ModelScope / GitHub repo page"
                        class="text-xs pr-7"
                      />
                      <div
                        v-if="model.repo && model.repoValid === false"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500"
                        title="Invalid repository URL"
                      ></div>
                      <div
                        v-else-if="model.repo && model.repoValid === true"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500"
                        title="Valid repository URL"
                      ></div>
                    </div>
                    <a
                      v-if="model.repo && model.repoValid"
                      :href="model.repo"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex h-9 shrink-0 items-center rounded-md border px-2 text-[11px] text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
                    >
                      Open repo
                    </a>
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
              <div v-if="nodeInfo.isCustomNode" class="mt-3 p-3 dm-callout-info rounded text-xs border-0">
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="opacity-95">
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
        <Card v-if="workflowData">
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
      <Card v-if="workflowData" class="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/35">
        <CardContent class="pt-4">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="text-sm text-foreground opacity-95">
              <div class="font-semibold mb-1">📝 Next Steps</div>
              <ol class="list-decimal list-inside space-y-1 text-xs">
                <li>Click <strong>"Download Updated JSON"</strong> to save the workflow with model links</li>
                <li>Generate and copy the <strong>Note</strong> above (download URLs plus repository pages)</li>
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
        <div v-if="workflowData" class="flex flex-col gap-2 w-full sm:w-auto">
          <Button
            @click="saveWorkflow"
            class="gap-2"
            :variant="stats.errorFormats > 0 || stats.missingLinks > 0 || stats.invalidLinks > 0 || stats.subgraphIssues > 0 ? 'destructive' : 'default'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Updated JSON
          </Button>
          <p v-if="stats.errorFormats > 0 || stats.missingLinks > 0 || stats.invalidLinks > 0 || stats.subgraphIssues > 0" class="text-xs text-orange-600 text-center">
            ⚠️ There are {{ stats.errorFormats + stats.missingLinks + stats.invalidLinks + stats.subgraphIssues }} issue(s), but you can still download
          </p>
        </div>
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
import { analyzeWorkflowModelLinks, isSubgraphNode, normalizeWhitelist } from '~/lib/model-link-scan/analyze'
import { isHttpUrl, repoLinkLabel, repoUrlFromDownloadUrl } from '~/lib/model-repo-url'

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
const inputAssets = ref<Array<{ name: string; url: string; path: string }>>([])

const INPUT_NODE_TYPES = new Set(['LoadImage', 'LoadImageOutput', 'LoadImageSetFromFolderNode', 'LoadImageMask', 'LoadVideo', 'VHS_LoadVideo', 'LoadAudio', 'Load3D'])
const INPUT_FILE_RE = /\.(png|jpe?g|webp|gif|bmp|mp4|webm|mov|avi|mkv|mp3|wav|flac|ogg|glb|gltf|obj|ply|fbx)$/i
const INPUT_ASSET_BASE_URL = 'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/refs/heads/main/input/'

const extractInputFiles = (nodes: any[]) => {
  const assets = new Map<string, { name: string; url: string; path: string }>()
  for (const node of nodes) {
    if (!INPUT_NODE_TYPES.has(node.type) || !Array.isArray(node.widgets_values)) continue
    for (const value of node.widgets_values) {
      if (typeof value !== 'string' || !INPUT_FILE_RE.test(value.trim())) continue
      const name = value.trim().split(/[\\/]/).pop()
      if (!name) continue
      const path = `input/${name}`
      assets.set(name, { name, path, url: `${INPUT_ASSET_BASE_URL}${encodeURIComponent(name)}` })
    }
  }
  return [...assets.values()]
}
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

// Resolve directory for a node type. directoryRules value can be a string or an array of strings
// (indexed by model position within the node). Falls back to first element / string if index OOB.
const getDirectory = (nodeType: string, modelIndex: number = 0): string => {
  const rule = directoryRules.value[nodeType]
  if (Array.isArray(rule)) return rule[modelIndex] ?? rule[0] ?? ''
  return rule || ''
}

// Supported models lookup: model_name → download URL (directory always comes from node type rules)
const supportedModelsMap = ref<Map<string, string>>(new Map())

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
  if (oldValue && !value && workflowData.value) {
    persistModelsToWorkflow()
    emit('workflow-updated', workflowData.value)
  }
})

// Load configuration on mount
onMounted(async () => {
  try {
    const [configRes, modelsRes] = await Promise.all([
      fetch('/api/config/workflow-model-config.json'),
      fetch('/api/config/supported_models.json')
    ])
    config.value = await configRes.json()

    const modelsData = await modelsRes.json()
    const map = new Map<string, string>()
    for (const entry of modelsData.models ?? []) {
      if (entry.model_name && entry.url) {
        map.set(entry.model_name, entry.url)
      }
    }
    supportedModelsMap.value = map
    if (workflowData.value) parseWorkflow()
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
    errorFormats: errors,
    subgraphIssues: subgraphIssueMessages.value.length
  }
})

const detectedSubgraphIssues = ref<string[]>([])

const subgraphIssueMessages = computed(() => {
  const messages = [...detectedSubgraphIssues.value]
  for (const nodeInfo of modelNodes.value) {
    for (const issue of nodeInfo.subgraphIssues || []) {
      if (!messages.includes(issue)) messages.push(issue)
    }
  }
  return messages
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

let isParsingWorkflow = false
let subgraphRefreshTimer: ReturnType<typeof setTimeout> | null = null

const persistModelsToWorkflow = () => {
  if (!workflowData.value) return

  for (const nodeInfo of modelNodes.value) {
    if (nodeInfo.isCustomNode) continue
    if (nodeInfo.isSubgraphInstance) continue

    const node = findNode(nodeInfo.node.id, nodeInfo.node._source, nodeInfo.node._subgraphIndex)
    if (!node) continue
    if (!node.properties) node.properties = {}

    const validModels = nodeInfo.existingModels.filter((m: any) => {
      if (!m.name || !m.url || !m.directory) return false
      // Do not auto-write supported-model URLs onto subgraph definitions (blueprints).
      if (nodeInfo.node._source === 'subgraph' && m.autoFilled) return false
      return true
    })

    if (validModels.length > 0) {
      node.properties.models = validModels.map((m: any) => ({
        name: m.name,
        url: m.url,
        directory: m.directory,
        ...(m.repo && isHttpUrl(m.repo) ? { repo: m.repo.trim() } : {})
      }))
    }
  }
}

const collectSubgraphIssuesByNode = () => {
  const issuesByNode = new Map<string, string[]>()
  if (!workflowData.value) return issuesByNode

  const subgraphAnalysis = analyzeWorkflowModelLinks(
    'workflow',
    workflowData.value,
    normalizeWhitelist(config.value?.modelCheckIgnoreNodeTypes)
  )
  for (const issue of subgraphAnalysis.issues) {
    if (issue.kind !== 'subgraph_missing_urls' && issue.kind !== 'subgraph_stale_definition') continue
    const keys = [`${issue.scope}:${issue.nodeId}`]
    if (issue.innerNodeId && issue.nodeType) {
      keys.push(`subgraph ${issue.nodeType}:${issue.innerNodeId}`)
    }
    for (const key of keys) {
      const list = issuesByNode.get(key) || []
      list.push(issue.message)
      issuesByNode.set(key, list)
    }
  }
  return issuesByNode
}

const subgraphIssueKey = (nodeInfo: any) => {
  const node = nodeInfo.node
  const scope = node._source === 'subgraph' ? `subgraph ${node._subgraphId || node._subgraphIndex}` : 'top-level'
  return `${scope}:${node.id}`
}

const refreshSubgraphIssues = () => {
  persistModelsToWorkflow()
  const issuesByNode = collectSubgraphIssuesByNode()
  const bannerMessages: string[] = []
  for (const list of issuesByNode.values()) {
    for (const message of list) {
      if (!bannerMessages.includes(message)) bannerMessages.push(message)
    }
  }
  detectedSubgraphIssues.value = bannerMessages
  for (const nodeInfo of modelNodes.value) {
    nodeInfo.subgraphIssues = issuesByNode.get(subgraphIssueKey(nodeInfo))
      || issuesByNode.get(`top-level:${nodeInfo.node.id}`)
      || []
    updateNodeStats(nodeInfo)
  }
  updateAllStats()
}

const scheduleSubgraphRefresh = () => {
  if (isParsingWorkflow) return
  if (subgraphRefreshTimer) clearTimeout(subgraphRefreshTimer)
  subgraphRefreshTimer = setTimeout(() => {
    subgraphRefreshTimer = null
    refreshSubgraphIssues()
  }, 200)
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
            _subgraphIndex: i,
            _subgraphId: subgraph.id
          })
        }
      }
    }
  }

  inputAssets.value = extractInputFiles(nodes)

  const issuesByNode = collectSubgraphIssuesByNode()
  const bannerMessages: string[] = []
  for (const list of issuesByNode.values()) {
    for (const message of list) {
      if (!bannerMessages.includes(message)) bannerMessages.push(message)
    }
  }
  detectedSubgraphIssues.value = bannerMessages

  // Filter model nodes. Subgraph instances are detection-only, never auto-filled here.
  const modelNodesList = []
  for (const node of nodes) {
    if (isSubgraphNode(String(node.type || ''))) continue
    const isModelNode = node.properties?.['Node name for S&R'] && node.type in directoryRules.value
    if (!isModelNode) continue

    const modelFiles = extractModelFiles(node)
    if (modelFiles.length === 0) continue

    // Check if this is a custom node
    const isCustomNode = customNodeRules.value.includes(node.type)

    const savedModelsByName = new Map<string, { name?: string; url?: string; directory?: string; repo?: string }>()
    for (const model of node.properties?.models || []) {
      if (model?.name) savedModelsByName.set(model.name, model)
    }

    const models = []

    // Build from widget file order so directoryRules array indices stay aligned
    for (let fileIdx = 0; fileIdx < modelFiles.length; fileIdx++) {
      const file = modelFiles[fileIdx]
      const fileName = file.split(/[\\\/]/).pop()
      if (!fileName) continue

      const saved = savedModelsByName.get(fileName)
      const supportedUrl = node._source === 'subgraph'
        ? ''
        : (supportedModelsMap.value.get(fileName) || '')
      const url = saved?.url || supportedUrl || ''
      const derivedRepo = repoUrlFromDownloadUrl(url)
      const repo = saved?.repo || derivedRepo || ''

      models.push({
        name: fileName,
        url,
        repo,
        directory: getDirectory(node.type, fileIdx),
        autoFilled: !saved?.url && !!supportedUrl,
        repoAutoFilled: !saved?.repo && !!derivedRepo,
        valid: false,
        nameValid: null,
        urlValid: null,
        repoValid: null
      })
    }

    // Keep saved entries that no longer appear in widgets (rare)
    for (const saved of node.properties?.models || []) {
      if (!saved?.name || models.some(m => m.name === saved.name)) continue
      const supportedUrl = node._source === 'subgraph'
        ? ''
        : (supportedModelsMap.value.get(saved.name) || '')
      const derivedRepo = repoUrlFromDownloadUrl(saved.url || supportedUrl || '')
      models.push({
        name: saved.name,
        url: saved.url || supportedUrl || '',
        repo: saved.repo || derivedRepo || '',
        directory: getDirectory(node.type, models.length),
        autoFilled: !saved.url && !!supportedUrl,
        repoAutoFilled: !saved.repo && !!derivedRepo,
        valid: false,
        nameValid: null,
        urlValid: null,
        repoValid: null
      })
    }

    const scope = node._source === 'subgraph' ? `subgraph ${node._subgraphId || node._subgraphIndex}` : 'top-level'
    const subgraphIssues = issuesByNode.get(`${scope}:${node.id}`)
      || issuesByNode.get(`top-level:${node.id}`)
      || []

    modelNodesList.push({
      node,
      modelFiles,
      existingModels: models,
      isCustomNode, // Mark if this is a custom node
      isSubgraphInstance: false,
      subgraphIssues,
      hasErrors: false,
      hasWarnings: false,
      errorCount: 0,
      warningCount: 0
    })
  }

  modelNodes.value = modelNodesList

  isParsingWorkflow = true
  try {
    for (const nodeInfo of modelNodes.value) {
      for (const model of nodeInfo.existingModels) {
        validateModel(model, nodeInfo)
      }
    }
  } finally {
    isParsingWorkflow = false
  }
}

// Extract model files from node
const extractModelFiles = (node: any): string[] => {
  const widgets = node.widgets_values
  let values: unknown[] = []
  if (Array.isArray(widgets)) {
    values = widgets
  } else if (widgets && typeof widgets === 'object') {
    values = Object.values(widgets)
  } else {
    return []
  }

  const files = []
  for (const value of values) {
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
  // Validate name - match against any of the model files
  let nameMatched = false
  for (const filePath of nodeInfo.modelFiles) {
    const fileName = filePath.split(/[\\\/]/).pop() || ''
    if (fileName && model.name && model.name === fileName) {
      nameMatched = true
      break
    }
  }
  model.nameValid = model.name ? (nameMatched || null) : null

  if (model.repoAutoFilled !== false) {
    const derivedRepo = repoUrlFromDownloadUrl(model.url || '')
    if (derivedRepo && (!model.repo || model.repoAutoFilled)) {
      model.repo = derivedRepo
      model.repoAutoFilled = true
    }
  }
  if (!model.repo) {
    model.repoValid = null
  } else {
    model.repoValid = isHttpUrl(model.repo)
  }

  // Validate URL
  model.isCivitai = false
  if (!model.url) {
    model.urlValid = null
  } else if (!model.url.includes('http')) {
    model.urlValid = false
  } else if (model.url.includes('civitai.com')) {
    // CivitAI URLs don't embed the filename — mark as unverifiable, not invalid
    model.isCivitai = true
    model.urlValid = null
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

  // CivitAI: treat as valid when URL is present and name is not mismatched
  model.valid = (model.nameValid === true && model.urlValid === true) ||
    (model.isCivitai && !!model.url && model.nameValid !== false)

  // Update node stats
  updateNodeStats(nodeInfo)
  updateAllStats()
  scheduleSubgraphRefresh()
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
      if (model.nameValid === false || model.urlValid === false || model.repoValid === false) {
        errors++
      }
      if (!model.url) {
        warnings++
      }
    }
  }

  const subgraphErrors = nodeInfo.subgraphIssues?.length || 0
  nodeInfo.errorCount = errors + subgraphErrors
  nodeInfo.warningCount = warnings
  nodeInfo.hasErrors = errors + subgraphErrors > 0
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
  scheduleSubgraphRefresh()
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
    repo: '',
    directory: getDirectory(nodeInfo.node.type, nodeInfo.existingModels.length),
    valid: false,
    nameValid: null,
    urlValid: null,
    repoValid: null,
    repoAutoFilled: false
  })
  scheduleSubgraphRefresh()
}

// Remove model
const removeModel = (nodeInfo: any, index: number) => {
  nodeInfo.existingModels.splice(index, 1)
  updateNodeStats(nodeInfo)
  scheduleSubgraphRefresh()
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

const scrollToFirstSubgraphIssue = () => {
  const index = modelNodes.value.findIndex(n => n.subgraphIssues?.length)
  if (index !== -1 && nodeRefs.value[index]) {
    nodeRefs.value[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const UUID_TYPE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const workflowHasSubgraphs = (workflow: any): boolean => {
  const defs = workflow?.definitions?.subgraphs
  if (Array.isArray(defs) && defs.length > 0) return true
  return Array.isArray(workflow?.nodes)
    && workflow.nodes.some((node: any) => typeof node?.type === 'string' && UUID_TYPE_RE.test(node.type))
}

// Generate note
const generateNote = () => {
  if (!workflowData.value || !config.value) return

  const template = config.value.noteTemplate
  let note = ''

  if (workflowHasSubgraphs(workflowData.value)) {
    note += template.header
  }

  // Tutorial
  if (tutorialUrl.value) {
    note += `[${tutorialTitle.value}](${tutorialUrl.value})\n\n`
  }

  // Input assets sit in their own section above Model Links (not nested under it).
  if (inputAssets.value.length > 0) {
    const singular = inputAssets.value.length === 1
    note += singular
      ? (template.inputAssetHeader || '## Input Asset\n\n')
      : (template.inputAssetsHeader || '## Input Assets\n\n')
    for (const asset of inputAssets.value) {
      note += `- [${asset.name}](${asset.url})\n`
    }
    note += '\n'
  }

  // Group by directory, deduplicate by URL (same model can be used by multiple nodes)
  const modelsByDir: Record<string, any[]> = {}
  const seenUrlByDir: Record<string, Set<string>> = {}
  for (const nodeInfo of modelNodes.value) {
    for (const model of nodeInfo.existingModels) {
      if (!model.url) continue
      const dir = model.directory || 'unknown'
      if (!modelsByDir[dir]) {
        modelsByDir[dir] = []
        seenUrlByDir[dir] = new Set()
      }
      if (seenUrlByDir[dir].has(model.url)) continue
      seenUrlByDir[dir].add(model.url)
      modelsByDir[dir].push(model)
    }
  }

  // Custom nodes section (models without URLs), deduplicate by dir+name
  const customNodeModels: Record<string, any[]> = {}
  const seenCustomByDir: Record<string, Set<string>> = {}
  for (const nodeInfo of modelNodes.value) {
    if (nodeInfo.isCustomNode) {
      for (const model of nodeInfo.existingModels) {
        const dir = model.directory || 'unknown'
        if (!customNodeModels[dir]) {
          customNodeModels[dir] = []
          seenCustomByDir[dir] = new Set()
        }
        const key = `${dir}:${model.name}`
        if (seenCustomByDir[dir].has(key)) continue
        seenCustomByDir[dir].add(key)
        customNodeModels[dir].push({ ...model, nodeType: nodeInfo.node.type })
      }
    }
  }

  const linkedModelCount = Object.values(modelsByDir).reduce((sum, models) => sum + models.length, 0)
  const customModelCount = Object.values(customNodeModels).reduce((sum, models) => sum + models.length, 0)
  const totalModelCount = linkedModelCount + customModelCount

  if (totalModelCount > 0) {
    note += totalModelCount === 1
      ? (template.modelLinkHeader || '## Model Link\n\n')
      : (template.modelLinksHeader || '## Model Links\n\n')

    const seenRepos = new Set<string>()
    for (const dir in modelsByDir) {
      for (const model of modelsByDir[dir]) {
        const repo = typeof model.repo === 'string' ? model.repo.trim() : ''
        if (!repo || !isHttpUrl(repo) || seenRepos.has(repo)) continue
        seenRepos.add(repo)
        note += `- [${repoLinkLabel(repo)}](${repo})\n`
      }
    }
    if (seenRepos.size) note += '\n'
    for (const dir in modelsByDir) {
      note += `**${dir}**\n\n`
      for (const model of modelsByDir[dir]) {
        note += `- [${model.name}](${model.url})\n`
      }
      note += '\n'
    }

    if (customModelCount > 0) {
      note += `**Custom Nodes** (Please add download links manually)\n\n`
      for (const dir in customNodeModels) {
        note += `*${dir}/* (from custom node loaders)\n`
        for (const model of customNodeModels[dir]) {
          note += `- ${model.name} (${model.nodeType}): [Add link here]\n`
        }
        note += '\n'
      }
    }

    // Storage location (├── for branch, └── for last/only)
    note += template.storageLocationHeader
    const dirs = Object.keys(modelsByDir)
    const lastDirIndex = dirs.length - 1
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i]
      const isLastDir = i === lastDirIndex
      const dirBranch = isLastDir ? '└──' : '├──'
      note += `│   ${dirBranch} 📂 ${dir}/\n`
      const models = modelsByDir[dir]
      const lastModelIndex = models.length - 1
      const modelIndent = isLastDir ? '│       ' : '│   │   '
      for (let j = 0; j < models.length; j++) {
        const model = models[j]
        const isLastModel = j === lastModelIndex
        const modelBranch = isLastModel ? '└──' : '├──'
        note += `${modelIndent}${modelBranch} ${model.name}\n`
      }
    }
    note += template.storageLocationFooter
  }

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

  persistModelsToWorkflow()
  refreshSubgraphIssues()

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
  inputAssets.value = []
  jsonInput.value = ''
  generatedNote.value = ''
  tutorialUrl.value = ''
  tutorialTitle.value = 'Tutorial'
}
</script>
