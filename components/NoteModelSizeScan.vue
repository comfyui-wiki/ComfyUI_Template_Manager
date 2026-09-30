<template>
  <div class="rounded-lg border border-border bg-card px-4 py-3 text-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <p class="font-semibold">Note model sizes</p>
        <p class="text-xs text-muted-foreground">
          {{ subtitle }}
        </p>
      </div>
      <div class="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" :disabled="scanning || fixingAll" @click="scan">
          {{ scanning ? 'Scanning...' : 'Scan notes' }}
        </Button>
        <Button v-if="templates.length > 1" size="sm" :disabled="scanning || fixingAll" @click="fixAll">
          {{ fixingAll ? 'Fixing...' : 'Fix all' }}
        </Button>
      </div>
    </div>

    <p v-if="error" class="mt-2 text-xs text-amber-700 dark:text-amber-300">{{ error }}</p>

    <ul v-if="templates.length" class="mt-3 max-h-64 space-y-2 overflow-auto">
      <li v-for="item in templates" :key="item.name" class="flex items-start justify-between gap-3 text-xs">
        <div class="min-w-0">
          <button type="button" class="font-mono font-medium underline" @click="$emit('select-template', item.name)">
            {{ item.name }}
          </button>
          <span class="text-muted-foreground">
            · note {{ item.nodeIds.join(', ') }} · {{ item.missingCount }} link{{ item.missingCount === 1 ? '' : 's' }} without a size
          </span>
          <p v-if="item.samples.length" class="truncate text-muted-foreground">{{ item.samples.join(', ') }}</p>
          <p v-if="item.message" class="text-muted-foreground">{{ item.message }}</p>
        </div>
        <Button size="sm" variant="outline" class="shrink-0" :disabled="fixingName === item.name || fixingAll" @click="fix(item)">
          {{ fixingName === item.name ? 'Fixing...' : 'Fix' }}
        </Button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'

type NoteSizeTemplate = {
  name: string
  missingCount: number
  nodeIds: string[]
  samples: string[]
  message?: string
}

type ScanResponse = {
  available: boolean
  checkedWorkflows: number
  missingTemplates: number
  templates: NoteSizeTemplate[]
}

defineEmits<{
  'select-template': [name: string]
}>()

const scanning = ref(false)
const fixingAll = ref(false)
const fixingName = ref('')
const error = ref('')
const checkedWorkflows = ref(0)
const scanned = ref(false)
const templates = ref<NoteSizeTemplate[]>([])

const subtitle = computed(() => {
  if (scanning.value) return 'Reading workflow notes in the local templates folder.'
  if (!scanned.value) return 'Find notes that list a model download link without its file size.'
  if (!templates.value.length) return `Checked ${checkedWorkflows.value} workflows. Model links in notes already include a file size.`
  return `${templates.value.length} template${templates.value.length === 1 ? '' : 's'} can be updated. Fix writes the size into that note and commits it locally.`
})

const scan = async () => {
  if (scanning.value) return
  scanning.value = true
  error.value = ''
  try {
    const result = await $fetch<ScanResponse>('/api/local/note-model-sizes')
    scanned.value = true
    checkedWorkflows.value = result.checkedWorkflows
    templates.value = result.available ? result.templates : []
    if (!result.available) error.value = 'This scan only runs in local repo mode.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Scan failed'
  } finally {
    scanning.value = false
  }
}

const fix = async (item: NoteSizeTemplate) => {
  if (fixingName.value) return
  fixingName.value = item.name
  error.value = ''
  try {
    const result = await $fetch<{ applied: number, stillMissing: number }>('/api/local/note-model-sizes/fix', {
      method: 'POST',
      body: { name: item.name }
    })
    if (result.stillMissing === 0 && result.applied > 0) {
      templates.value = templates.value.filter(entry => entry.name !== item.name)
      return
    }
    item.missingCount = result.stillMissing
    item.message = result.applied
      ? `Added ${result.applied}. ${result.stillMissing} link${result.stillMissing === 1 ? '' : 's'} still have no size.`
      : 'Could not read a file size for these links.'
  } catch (cause) {
    item.message = cause instanceof Error ? cause.message : 'Fix failed'
  } finally {
    fixingName.value = ''
  }
}

const fixAll = async () => {
  fixingAll.value = true
  const pending = [...templates.value]
  for (const item of pending) {
    if (!templates.value.some(entry => entry.name === item.name)) continue
    await fix(item)
  }
  fixingAll.value = false
}
</script>
