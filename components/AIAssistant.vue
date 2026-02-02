<template>
  <div class="inline-flex items-center gap-1">
    <!-- AI Assistant Button -->
    <Button
      v-if="aiEnabled"
      @click="openDialog"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0"
      :disabled="disabled || loading"
      :title="buttonTitle"
    >
      <svg
        v-if="!loading"
        class="h-4 w-4"
        :class="{ 'text-amber-500': !disabled, 'text-muted-foreground': disabled }"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
      </svg>
      <svg
        v-else
        class="h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </Button>

    <!-- AI Assistant Dialog -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <svg class="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
            AI Assistant - {{ fieldLabel }}
          </DialogTitle>
          <DialogDescription>
            Let AI help you {{ actionDescription }}. You can add additional context below.
          </DialogDescription>
        </DialogHeader>

        <!-- Scrollable Content Area -->
        <div class="flex-1 overflow-y-auto space-y-4 py-4 px-1">
          <!-- System Prompt (editable) -->
          <div class="space-y-2 border border-amber-200 rounded-md p-3 bg-amber-50/30">
            <div class="flex items-center justify-between">
              <Label class="text-sm font-medium text-amber-700">
                <svg class="inline w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                AI System Prompt (Editable)
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-6 text-xs"
                @click="resetSystemPrompt"
                :disabled="systemPrompt === defaultSystemPrompt"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset to Default
              </Button>
            </div>

            <Textarea
              v-model="systemPrompt"
              class="min-h-[8rem] max-h-32 resize-none text-xs font-mono"
              placeholder="Loading system prompt..."
              :disabled="loading"
            />

            <div class="text-xs text-amber-600 flex items-start gap-1">
              <svg class="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <span>Edit this prompt to customize how AI processes your request. Changes apply to this session only.</span>
            </div>
          </div>

          <!-- Template Context (editable) -->
          <div class="space-y-2 border border-blue-200 rounded-md p-3 bg-blue-50/30">
            <div class="flex items-center justify-between">
              <Label class="text-sm font-medium text-blue-700">Template Context (Editable)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-6 text-xs"
                @click="resetContext"
                :disabled="editableContext === defaultContext"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset to Default
              </Button>
            </div>

            <Textarea
              v-model="editableContext"
              class="min-h-[6rem] max-h-32 resize-none text-xs font-mono"
              placeholder="Template context..."
              :disabled="loading"
            />

            <div class="text-xs text-blue-600 flex items-start gap-1">
              <svg class="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <span>Edit template information that will be sent to AI. Changes apply to this request only.</span>
            </div>
          </div>


          <!-- User Input -->
          <div class="space-y-2">
            <Label for="userInput" class="text-sm font-medium">
              Additional Context (Optional)
            </Label>
            <Textarea
              id="userInput"
              v-model="userInput"
              placeholder="Enter any additional information, model details, or specific requirements..."
              rows="4"
              class="resize-none"
            />
          </div>

          <!-- Error Message -->
          <div v-if="error" class="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {{ error }}
          </div>

          <!-- Result -->
          <div v-if="result !== null" class="space-y-2">
            <Label class="text-sm font-medium text-green-600">AI Suggestion</Label>
            <div class="bg-green-50 p-3 rounded-md text-sm">
              <!-- Tags field -->
              <div v-if="fieldType === 'tags'">
                <!-- Empty array = no new tags needed -->
                <div v-if="Array.isArray(result) && result.length === 0" class="flex items-center gap-2 text-green-700">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Current tags are already appropriate. No new tags needed.</span>
                </div>
                <!-- Has new tags to add -->
                <div v-else class="flex flex-wrap gap-2">
                  <Badge v-for="tag in result" :key="tag" variant="secondary">
                    {{ tag }}
                  </Badge>
                </div>
              </div>
              <!-- Other fields -->
              <div v-else class="whitespace-pre-wrap break-words">
                {{ result }}
              </div>
            </div>
          </div>
        </div>

        <!-- Fixed Actions Area -->
        <div class="flex-shrink-0 pt-4 border-t">
          <div class="flex items-center justify-between gap-2">
          <div class="text-xs text-muted-foreground">
            <span v-if="fieldType === 'tags' && result && Array.isArray(result) && result.length === 0">
              No changes needed - current tags are good
            </span>
            <span v-else-if="fieldType === 'tags'">
              New tags will be added to existing ones
            </span>
            <span v-else>This will replace the current {{ fieldLabel.toLowerCase() }}</span>
          </div>
          <div class="flex gap-2">
            <Button
              variant="outline"
              @click="dialogOpen = false"
              :disabled="loading"
            >
              Cancel
            </Button>
            <Button
              v-if="!result"
              @click="getSuggestion"
              :disabled="loading"
            >
              <svg v-if="loading" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Get AI Suggestion
            </Button>
            <template v-else>
              <Button
                variant="outline"
                @click="regenerateSuggestion"
                :disabled="loading"
              >
                <svg v-if="loading" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </Button>
              <Button
                @click="applyResult"
                variant="default"
                :disabled="fieldType === 'tags' && Array.isArray(result) && result.length === 0"
              >
                <template v-if="fieldType === 'tags' && Array.isArray(result) && result.length === 0">
                  Close (No Changes)
                </template>
                <template v-else>
                  Apply
                </template>
              </Button>
            </template>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface Props {
  fieldType: 'tags' | 'title' | 'description'
  fieldLabel?: string
  context: Record<string, any>
  disabled?: boolean
  availableTags?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  fieldLabel: '',
  disabled: false,
  availableTags: () => []
})

const emit = defineEmits<{
  'suggestion': [value: string | string[]]
}>()

// Check if AI is enabled
const config = useRuntimeConfig()
const aiEnabled = computed(() => config.public.aiTranslationEnabled)

// State
const dialogOpen = ref(false)
const loading = ref(false)
const userInput = ref('')
const result = ref<string | string[] | null>(null)
const error = ref<string | null>(null)
const showPrompts = ref(false)
const systemPrompt = ref<string>('')
const defaultSystemPrompt = ref<string>('') // Store default for reset
const userPrompt = ref<string>('')
const editableContext = ref<string>('')
const defaultContext = ref<string>('')

// Computed
const buttonTitle = computed(() => {
  if (props.disabled) return 'AI Assistant (disabled)'
  return `Get AI suggestion for ${props.fieldLabel.toLowerCase()}`
})

const actionDescription = computed(() => {
  switch (props.fieldType) {
    case 'tags':
      return 'suggest relevant tags'
    case 'title':
      return 'generate a compelling title'
    case 'description':
      return 'write a clear description'
    default:
      return 'improve this field'
  }
})

const contextPreview = computed(() => {
  const lines: string[] = []

  if (props.context.title) {
    lines.push(`Title: ${props.context.title}`)
  }
  if (props.context.description) {
    lines.push(`Description: ${props.context.description}`)
  }
  if (props.context.tags && props.context.tags.length > 0) {
    lines.push(`Tags: ${props.context.tags.join(', ')}`)
  }
  if (props.context.models && props.context.models.length > 0) {
    lines.push(`Models: ${props.context.models.join(', ')}`)
  }

  // Note: availableTags are already shown in System Prompt, no need to repeat here

  return lines.join('\n')
})

// Methods
const openDialog = async () => {
  dialogOpen.value = true
  userInput.value = ''
  result.value = null
  error.value = null
  showPrompts.value = false
  userPrompt.value = ''

  // Initialize editable context from props
  const contextText = contextPreview.value
  editableContext.value = contextText
  defaultContext.value = contextText

  // Load system prompt from config if not already loaded
  if (!defaultSystemPrompt.value) {
    try {
      const config = await $fetch(`/api/config/ai-assistant-prompts.json`)
      if (config && config[props.fieldType]) {
        defaultSystemPrompt.value = config[props.fieldType].systemPrompt
        systemPrompt.value = config[props.fieldType].systemPrompt
      }
    } catch (err) {
      console.error('[AIAssistant] Failed to load system prompt:', err)
    }
  }
}

const resetSystemPrompt = () => {
  systemPrompt.value = defaultSystemPrompt.value
}

const resetContext = () => {
  editableContext.value = defaultContext.value
}

// Parse context text back to structured format
const parseContextText = (text: string) => {
  const context: any = {}

  // Extract title
  const titleMatch = text.match(/Title:\s*(.+?)(?=\n|$)/i)
  if (titleMatch) context.title = titleMatch[1].trim()

  // Extract description
  const descMatch = text.match(/Description:\s*(.+?)(?=\nTags:|$)/is)
  if (descMatch) context.description = descMatch[1].trim()

  // Extract tags
  const tagsMatch = text.match(/Tags:\s*(.+?)(?=\nModels:|$)/is)
  if (tagsMatch) {
    const tagsStr = tagsMatch[1].trim()
    context.tags = tagsStr.split(',').map(t => t.trim()).filter(t => t)
  }

  // Extract models
  const modelsMatch = text.match(/Models:\s*(.+?)$/is)
  if (modelsMatch) {
    const modelsStr = modelsMatch[1].trim()
    context.models = modelsStr.split(',').map(m => m.trim()).filter(m => m)
  }

  return context
}

const getSuggestion = async () => {
  loading.value = true
  error.value = null
  result.value = null

  try {
    // Parse edited context text to extract structured data
    const parsedContext = parseContextText(editableContext.value)

    const response = await $fetch('/api/ai/assist/suggest', {
      method: 'POST',
      body: {
        fieldType: props.fieldType,
        context: parsedContext,
        userInput: userInput.value,
        availableTags: props.availableTags,
        customSystemPrompt: systemPrompt.value, // Send custom prompt
        customContextText: editableContext.value // Send raw text for user prompt
      }
    })

    if (response.success) {
      result.value = response.suggestion

      // Special handling for empty tags array
      if (props.fieldType === 'tags' && Array.isArray(response.suggestion) && response.suggestion.length === 0) {
        result.value = []
        error.value = null
        // Show a success message instead
      }

      if (response.prompts) {
        systemPrompt.value = response.prompts.system
        userPrompt.value = response.prompts.user
        showPrompts.value = true
      }
    } else {
      error.value = response.error || 'Failed to get AI suggestion'
    }
  } catch (err: any) {
    console.error('[AIAssistant] Error:', err)
    error.value = err.data?.statusMessage || err.message || 'Failed to get AI suggestion'
  } finally {
    loading.value = false
  }
}

const regenerateSuggestion = async () => {
  // Keep the current inputs but regenerate the suggestion
  await getSuggestion()
}

const applyResult = () => {
  if (result.value) {
    // For tags, if empty array, just close dialog without emitting
    if (props.fieldType === 'tags' && Array.isArray(result.value) && result.value.length === 0) {
      dialogOpen.value = false
      return
    }

    emit('suggestion', result.value)
    dialogOpen.value = false
  }
}

// Reset state when dialog closes
watch(dialogOpen, (newVal) => {
  if (!newVal) {
    userInput.value = ''
    result.value = null
    error.value = null
    showPrompts.value = false
    userPrompt.value = ''
    editableContext.value = ''
    defaultContext.value = ''
    // Keep systemPrompt loaded for next time
  }
})
</script>
