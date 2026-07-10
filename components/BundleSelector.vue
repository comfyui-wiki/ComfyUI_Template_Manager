<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <Label class="text-sm font-medium">Distribution Bundle</Label>
      <Button
        v-if="!loading"
        type="button"
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-xs"
        @click="loadBundleStatus"
      >
        Refresh sizes
      </Button>
    </div>

    <p class="text-xs text-muted-foreground">
      Choose which PyPI sub-package this template belongs to. New templates should use
      <code class="font-mono">{{ recommendedAssetBundle }}</code>.
      Legacy <code class="font-mono">media-*</code> bundles are frozen and not selectable.
    </p>

    <div
      v-if="legacyCurrentBundle"
      class="p-3 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 space-y-1"
    >
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-medium">{{ legacyCurrentBundle.label }}</span>
        <code class="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{{ legacyCurrentBundle.id }}</code>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          frozen · current assignment
        </span>
      </div>
      <p class="text-[11px] text-muted-foreground">
        {{ legacyCurrentBundle.frozenReason || 'This legacy bundle is frozen — no new templates should be added.' }}
        Save keeps this assignment; choose an active bundle below only when migrating.
      </p>
    </div>

    <div v-if="loading" class="text-xs text-muted-foreground py-2">
      Loading bundle status...
    </div>

    <div v-else-if="error" class="text-xs text-red-600 py-2">
      {{ error }}
    </div>

    <div v-else class="space-y-2">
      <label
        v-for="bundle in bundles"
        :key="bundle.id"
        class="flex items-start gap-3 p-3 rounded-lg border transition-colors"
        :class="[
          bundle.selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
          modelValue === bundle.id
            ? 'border-primary bg-primary/5'
            : 'border-border hover:bg-muted/40'
        ]"
      >
        <input
          type="radio"
          class="mt-1"
          :value="bundle.id"
          :checked="modelValue === bundle.id"
          :disabled="!bundle.selectable"
          @change="bundle.selectable && $emit('update:modelValue', bundle.id)"
        />

        <div class="flex-1 min-w-0 space-y-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium">{{ bundle.label }}</span>
            <code class="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{{ bundle.id }}</code>
            <span
              v-if="bundle.id === recommendedAssetBundle"
              class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              recommended
            </span>
            <span
              v-if="bundle.containsCurrentTemplate"
              class="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
            >
              current
            </span>
            <span
              v-else-if="bundle.id === suggestedBundle"
              class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            >
              suggested
            </span>
          </div>

          <div class="text-xs text-muted-foreground">
            {{ bundle.templateCount }} template{{ bundle.templateCount !== 1 ? 's' : '' }}
            <span v-if="bundle.publishedSizeLabel !== '—'">
              · Published wheel: <strong class="text-foreground">{{ bundle.publishedSizeLabel }}</strong> / {{ bundle.sizeLimitLabel }}
            </span>
            <span v-else>· Published size unavailable</span>
          </div>

          <div v-if="bundle.usagePercent != null" class="space-y-1">
            <div class="h-2 rounded-full bg-muted overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="bundle.isOverLimit
                  ? 'bg-red-500'
                  : bundle.isNearLimit
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'"
                :style="{ width: `${Math.min(bundle.usagePercent, 100)}%` }"
              />
            </div>
            <p
              class="text-[11px]"
              :class="bundle.isOverLimit
                ? 'text-red-600'
                : bundle.isNearLimit
                  ? 'text-amber-600'
                  : 'text-muted-foreground'"
            >
              {{ bundle.usagePercent }}% of limit used
              <span v-if="bundle.isNearLimit"> — near capacity</span>
            </p>
          </div>
        </div>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface BundleStatusItem {
  id: string
  label: string
  templateCount: number
  publishedSizeLabel: string
  sizeLimitLabel: string
  usagePercent: number | null
  isNearLimit: boolean
  isOverLimit: boolean
  containsCurrentTemplate: boolean
  frozen?: boolean
  frozenReason?: string | null
  selectable?: boolean
}

const props = defineProps<{
  modelValue: string
  repo: string
  branch: string
  templateName?: string
  category?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const loading = ref(false)
const error = ref('')
const bundles = ref<BundleStatusItem[]>([])
const legacyCurrentBundle = ref<BundleStatusItem | null>(null)
const suggestedBundle = ref('')
const recommendedAssetBundle = ref('media-assets-01')
const sizeLimitLabel = ref('100.0 MB')

const loadBundleStatus = async () => {
  if (!props.repo || !props.branch) return

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/github/bundles/status', {
      query: {
        repo: props.repo,
        branch: props.branch,
        ...(props.templateName ? { templateName: props.templateName } : {}),
        ...(props.category ? { category: props.category } : {})
      }
    })

    if (!response.success) {
      throw new Error('Failed to load bundle status')
    }

    bundles.value = response.bundles
    legacyCurrentBundle.value = response.legacyCurrentBundle || null
    suggestedBundle.value = response.suggestedBundle
    recommendedAssetBundle.value = response.recommendedAssetBundle || 'media-assets-01'
    sizeLimitLabel.value = response.sizeLimitLabel

    if (!props.modelValue && response.currentBundle) {
      emit('update:modelValue', response.currentBundle)
    } else if (!props.modelValue && response.suggestedBundle) {
      emit('update:modelValue', response.suggestedBundle)
    } else if (
      props.modelValue
      && legacyCurrentBundle.value
      && props.modelValue === legacyCurrentBundle.value.id
      && !bundles.value.some(b => b.id === props.modelValue)
    ) {
      // Keep frozen current assignment in form state even though it's not in selectable list
      emit('update:modelValue', legacyCurrentBundle.value.id)
    }
  } catch (err: any) {
    console.error('[BundleSelector] Failed to load bundle status:', err)
    error.value = err.data?.statusMessage || err.message || 'Failed to load bundle status'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.repo, props.branch, props.templateName, props.category],
  () => {
    loadBundleStatus()
  },
  { immediate: true }
)
</script>
