<template>
  <div class="inline-flex items-center gap-1">
    <Button
      v-if="aiEnabled"
      @click="openDialog"
      variant="outline"
      size="sm"
      class="h-8"
      :disabled="disabled || loading"
      :title="buttonTitle"
    >
      <svg
        v-if="!loading"
        class="h-4 w-4 mr-1.5"
        :class="{ 'text-amber-500': !disabled, 'text-muted-foreground': disabled }"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
      </svg>
      <svg
        v-else
        class="h-4 w-4 mr-1.5 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      AI Fill All
    </Button>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <svg class="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
            AI Fill All
          </DialogTitle>
          <DialogDescription>
            Enter reference materials or content. AI will generate Title, Description, Tags, and Models at once. Edit the results below before applying.
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto space-y-4 py-4 px-1">
          <!-- Reference Materials (Primary Input) -->
          <div class="space-y-2 border border-primary/30 rounded-md p-3 bg-primary/5">
            <Label class="text-sm font-medium">
              Reference Materials / Input
              <span class="text-muted-foreground font-normal">(required)</span>
            </Label>
            <Textarea
              v-model="userInput"
              placeholder="Paste workflow description, node info, model names, or any reference content to help AI understand the template..."
              rows="6"
              class="resize-none min-h-[120px]"
              :disabled="loading"
            />
            <p class="text-xs text-muted-foreground">
              e.g. workflow JSON snippet, node types, models used, feature description. More detail yields better results.
            </p>
          </div>

          <!-- Template Context (editable) -->
          <div class="space-y-2 border border-blue-200 rounded-md p-3 bg-blue-50/30">
            <div class="flex items-center justify-between">
              <Label class="text-sm font-medium text-blue-700">Current Template Context (editable)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-6 text-xs"
                @click="resetContext"
                :disabled="editableContext === defaultContext"
              >
                Reset
              </Button>
            </div>
            <Textarea
              v-model="editableContext"
              class="min-h-[5rem] max-h-24 resize-none text-xs font-mono"
              placeholder="Template context..."
              :disabled="loading"
            />
          </div>

          <!-- System Prompt (collapsible) -->
          <details class="border border-amber-200 rounded-md bg-amber-50/30">
            <summary class="px-3 py-2 text-sm font-medium text-amber-700 cursor-pointer">
              AI System Prompt (Advanced)
            </summary>
            <div class="px-3 pb-3 space-y-2">
              <Textarea
                v-model="systemPrompt"
                class="min-h-[6rem] max-h-32 resize-none text-xs font-mono"
                placeholder="Loading..."
                :disabled="loading"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-6 text-xs"
                @click="resetSystemPrompt"
                :disabled="systemPrompt === defaultSystemPrompt"
              >
                Reset to Default
              </Button>
            </div>
          </details>

          <!-- Error -->
          <div v-if="error" class="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {{ error }}
          </div>

          <!-- Result (Editable) -->
          <div v-if="result" class="space-y-3 border border-green-200 rounded-md p-4 bg-green-50/50">
            <Label class="text-sm font-medium text-green-700">AI Result — Edit before applying</Label>

            <div class="space-y-3">
              <div class="space-y-1.5">
                <Label for="editable-title" class="text-xs font-medium text-muted-foreground">Title</Label>
                <Input
                  id="editable-title"
                  v-model="editableTitle"
                  class="text-sm"
                  placeholder="Template title"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="editable-description" class="text-xs font-medium text-muted-foreground">Description</Label>
                <Textarea
                  id="editable-description"
                  v-model="editableDescription"
                  class="text-sm min-h-[80px] resize-y"
                  placeholder="Template description"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="editable-tags" class="text-xs font-medium text-muted-foreground">Tags (comma-separated)</Label>
                <Input
                  id="editable-tags"
                  v-model="editableTagsStr"
                  class="text-sm"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="editable-models" class="text-xs font-medium text-muted-foreground">Models (comma-separated)</Label>
                <Input
                  id="editable-models"
                  v-model="editableModelsStr"
                  class="text-sm"
                  placeholder="SDXL, FLUX, ControlNet"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="flex-shrink-0 pt-4 border-t">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-muted-foreground">
              {{ result ? 'Edit the fields above, then click Apply to fill the form' : 'Enter reference materials, then click Generate' }}
            </span>
            <div class="flex gap-2">
              <Button variant="outline" @click="dialogOpen = false" :disabled="loading">
                Cancel
              </Button>
              <Button
                v-if="!result"
                @click="getSuggestion"
                :disabled="loading || !userInput?.trim()"
              >
                <svg v-if="loading" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generate
              </Button>
              <template v-else>
                <Button variant="outline" @click="regenerateSuggestion" :disabled="loading">
                  <svg v-if="loading" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </Button>
                <Button @click="applyResult" variant="default">
                  Apply
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface BatchSuggestion {
  title: string
  description: string
  tags: string[]
  models: string[]
}

interface Props {
  context: Record<string, any>
  disabled?: boolean
  availableTags?: string[]
  availableModels?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  availableTags: () => [],
  availableModels: () => []
})

const emit = defineEmits<{
  'apply': [value: BatchSuggestion]
}>()

const config = useRuntimeConfig()
const aiEnabled = computed(() => config.public.aiTranslationEnabled)

const dialogOpen = ref(false)
const loading = ref(false)
const userInput = ref('')
const result = ref<BatchSuggestion | null>(null)
const error = ref<string | null>(null)
const systemPrompt = ref('')
const defaultSystemPrompt = ref('')
const editableContext = ref('')
const defaultContext = ref('')
const editableTitle = ref('')
const editableDescription = ref('')
const editableTagsStr = ref('')
const editableModelsStr = ref('')

const buttonTitle = computed(() => {
  if (props.disabled) return 'AI Fill All (disabled)'
  return 'Enter reference materials, AI fills Title, Description, Tags, Models at once'
})

const contextPreview = computed(() => {
  const lines: string[] = []
  if (props.context.title) lines.push(`Title: ${props.context.title}`)
  if (props.context.description) lines.push(`Description: ${props.context.description}`)
  if (props.context.tags?.length) lines.push(`Tags: ${props.context.tags.join(', ')}`)
  if (props.context.models?.length) lines.push(`Models: ${props.context.models.join(', ')}`)
  if (props.context.category) lines.push(`Category: ${props.context.category}`)
  return lines.join('\n') || '(none)'
})

const openDialog = async () => {
  dialogOpen.value = true
  userInput.value = ''
  result.value = null
  error.value = null
  editableContext.value = contextPreview.value
  defaultContext.value = contextPreview.value

  if (!defaultSystemPrompt.value) {
    try {
      const cfg = await $fetch<Record<string, { systemPrompt: string }>>('/api/config/ai-assistant-prompts.json')
      if (cfg?.all) {
        defaultSystemPrompt.value = cfg.all.systemPrompt
        systemPrompt.value = cfg.all.systemPrompt
      }
    } catch (err) {
      console.error('[AIAssistBatch] Failed to load prompt:', err)
    }
  }
}

const resetSystemPrompt = () => {
  systemPrompt.value = defaultSystemPrompt.value
}

const resetContext = () => {
  editableContext.value = defaultContext.value
}

const parseContextText = (text: string) => {
  const ctx: any = {}
  const titleMatch = text.match(/Title:\s*(.+?)(?=\n|$)/i)
  if (titleMatch) ctx.title = titleMatch[1].trim()
  const descMatch = text.match(/Description:\s*(.+?)(?=\nTags:|$)/is)
  if (descMatch) ctx.description = descMatch[1].trim()
  const tagsMatch = text.match(/Tags:\s*(.+?)(?=\nModels:|$)/is)
  if (tagsMatch) ctx.tags = tagsMatch[1].trim().split(',').map((t: string) => t.trim()).filter((t: string) => t)
  const modelsMatch = text.match(/Models:\s*(.+?)(?=\nCategory:|$)/is)
  if (modelsMatch) ctx.models = modelsMatch[1].trim().split(',').map((m: string) => m.trim()).filter((m: string) => m)
  const catMatch = text.match(/Category:\s*(.+?)$/is)
  if (catMatch) ctx.category = catMatch[1].trim()
  return ctx
}

const getSuggestion = async () => {
  loading.value = true
  error.value = null
  result.value = null

  try {
    const parsedContext = parseContextText(editableContext.value)

    const response = await $fetch<{ success: boolean; suggestion: BatchSuggestion; error?: string }>(
      '/api/ai/assist/suggest-batch',
      {
        method: 'POST',
        body: {
          context: parsedContext,
          userInput: userInput.value,
          availableTags: props.availableTags,
          availableModels: props.availableModels,
          customSystemPrompt: systemPrompt.value
        }
      }
    )

    if (response.success && response.suggestion) {
      result.value = response.suggestion
      editableTitle.value = response.suggestion.title || ''
      editableDescription.value = response.suggestion.description || ''
      editableTagsStr.value = (response.suggestion.tags || []).join(', ')
      editableModelsStr.value = (response.suggestion.models || []).join(', ')
    } else {
      error.value = response.error || 'Failed to get AI suggestion'
    }
  } catch (err: any) {
    console.error('[AIAssistBatch] Error:', err)
    error.value = err.data?.statusMessage || err.message || 'Failed to get AI suggestion'
  } finally {
    loading.value = false
  }
}

const regenerateSuggestion = async () => {
  await getSuggestion()
}

const applyResult = () => {
  const tags = editableTagsStr.value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  const models = editableModelsStr.value
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
  emit('apply', {
    title: editableTitle.value,
    description: editableDescription.value,
    tags,
    models
  })
  dialogOpen.value = false
}

watch(dialogOpen, (val) => {
  if (!val) {
    userInput.value = ''
    result.value = null
    error.value = null
    editableContext.value = ''
    defaultContext.value = ''
    editableTitle.value = ''
    editableDescription.value = ''
    editableTagsStr.value = ''
    editableModelsStr.value = ''
  }
})
</script>
