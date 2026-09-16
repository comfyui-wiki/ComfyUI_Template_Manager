<template>
  <div v-if="show" class="rounded-lg border px-4 py-3 text-sm" :class="bannerClass">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1 min-w-0">
        <p class="font-semibold">
          {{ title }}
        </p>
        <p class="text-xs opacity-90">
          {{ subtitle }}
        </p>
        <ul v-if="issueSummaries.length" class="mt-2 space-y-1 text-xs">
          <li v-for="item in visibleIssues" :key="item.name">
            <button
              type="button"
              class="underline font-mono font-medium hover:opacity-80"
              :title="item.preview"
              @click="$emit('select-template', item.name)"
            >
              {{ item.name }}
            </button>
            <span class="opacity-80"> · {{ item.issueCount }} issue{{ item.issueCount > 1 ? 's' : '' }}</span>
          </li>
        </ul>
        <p v-if="hiddenCount > 0" class="text-xs opacity-80">
          +{{ hiddenCount }} more
        </p>
      </div>
      <div v-if="issueSummaries.length" class="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" @click="$emit('filter-issues')">
          Show problem templates
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  scanning: boolean
  available: boolean
  error: string | null
  checkedWorkflows: number
  issueCount: number
  issueSummaries: Array<{ name: string, issueCount: number, preview: string }>
}>()

defineEmits<{
  'filter-issues': []
  'select-template': [name: string]
}>()

const show = computed(() => props.scanning || props.available || Boolean(props.error))

const bannerClass = computed(() => {
  if (props.scanning) {
    return 'border-muted bg-muted/40 text-foreground'
  }
  if (props.error) {
    return 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200'
  }
  if (props.issueCount > 0) {
    return 'border-rose-500/60 bg-rose-500/15 text-rose-950 dark:text-rose-100'
  }
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
})

const title = computed(() => {
  if (props.scanning) return 'Checking model download URLs…'
  if (props.error) return 'Model URL scan failed'
  if (props.issueCount > 0) {
    return `${props.issueCount} template${props.issueCount > 1 ? 's' : ''} have subgraph model URL issues`
  }
  return 'Model download URLs look good'
})

const subtitle = computed(() => {
  if (props.scanning) return 'Scanning every workflow JSON in the local templates folder.'
  if (props.error) return props.error
  if (props.issueCount > 0) {
    return 'Instance widgets_values and definition properties.models do not match. Click a name to jump to that template.'
  }
  return `Checked ${props.checkedWorkflows} workflow file${props.checkedWorkflows === 1 ? '' : 's'}. Subgraph instance models have download URLs that match the definition.`
})

const visibleIssues = computed(() => props.issueSummaries.slice(0, 8))
const hiddenCount = computed(() => Math.max(0, props.issueSummaries.length - visibleIssues.value.length))
</script>
