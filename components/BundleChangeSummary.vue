<template>
  <Card v-if="showPanel">
    <CardHeader class="pb-2">
      <div class="flex items-center justify-between gap-2">
        <CardTitle class="text-base">Bundle Publish Impact</CardTitle>
        <span
          v-if="bundleDiff?.changedBundleCount"
          class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        >
          {{ bundleDiff.changedBundleCount }} to publish
        </span>
      </div>
      <p class="text-[11px] text-muted-foreground leading-snug">
        Compared to <span class="font-mono">{{ baseLabel }}</span>. Bundles with changes need a new PyPI wheel release.
      </p>
    </CardHeader>

    <CardContent class="p-0">
      <div v-if="loading" class="px-4 pb-4 text-xs text-muted-foreground">
        Loading bundle diff...
      </div>

      <div v-else-if="!bundleDiff?.changedBundleCount" class="px-4 pb-4 text-xs text-muted-foreground">
        ✓ No bundle changes vs {{ baseLabel }}
      </div>

      <div v-else class="divide-y">
        <div
          v-for="bundle in changedBundles"
          :key="bundle.id"
          class="px-4 py-3"
        >
          <button
            type="button"
            class="w-full flex items-start gap-2 text-left"
            @click="toggleExpanded(bundle.id)"
          >
            <span class="mt-0.5 text-muted-foreground">
              <svg
                class="w-3.5 h-3.5 transition-transform"
                :class="{ 'rotate-90': expanded.has(bundle.id) }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </span>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium">{{ bundle.label }}</span>
                <code class="text-[10px] px-1 py-0.5 rounded bg-muted font-mono">{{ bundle.id }}</code>
              </div>
              <p v-if="bundle.pypiPackage" class="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                {{ bundle.pypiPackage }}
              </p>
              <div class="flex flex-wrap gap-1 mt-1.5">
                <span
                  v-if="bundle.addedTemplates.length"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                >
                  +{{ bundle.addedTemplates.length }} added
                </span>
                <span
                  v-if="bundle.removedTemplates.length"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                >
                  -{{ bundle.removedTemplates.length }} removed
                </span>
                <span
                  v-if="bundle.contentChangedTemplates.length"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  ~{{ bundle.contentChangedTemplates.length }} content
                </span>
              </div>
            </div>
          </button>

          <div v-if="expanded.has(bundle.id)" class="mt-2 ml-5 space-y-2 text-[11px]">
            <div v-if="bundle.addedTemplates.length">
              <p class="font-medium text-green-700 dark:text-green-400">Added to bundle</p>
              <ul class="mt-1 space-y-0.5 text-muted-foreground font-mono">
                <li v-for="name in bundle.addedTemplates" :key="`add-${name}`">{{ name }}</li>
              </ul>
            </div>
            <div v-if="bundle.removedTemplates.length">
              <p class="font-medium text-red-700 dark:text-red-400">Removed from bundle</p>
              <ul class="mt-1 space-y-0.5 text-muted-foreground font-mono">
                <li v-for="name in bundle.removedTemplates" :key="`rm-${name}`">{{ name }}</li>
              </ul>
            </div>
            <div v-if="bundle.contentChangedTemplates.length">
              <p class="font-medium text-amber-700 dark:text-amber-400">Content changed</p>
              <ul class="mt-1 space-y-0.5 text-muted-foreground font-mono">
                <li v-for="item in bundle.contentChangedTemplates" :key="`chg-${item.name}`">
                  {{ item.name }}
                  <span class="text-[10px] uppercase opacity-70">({{ item.status }})</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import type { BundleDiffResult } from '~/lib/bundle-diff'

const props = defineProps<{
  bundleDiff: BundleDiffResult | null
  loading?: boolean
  isMainBranch?: boolean
  baseLabel?: string
}>()

const baseLabel = computed(() => props.baseLabel || 'Comfy-Org/workflow_templates @ main')

const expanded = ref<Set<string>>(new Set())

const showPanel = computed(() => !props.isMainBranch)

const changedBundles = computed(() =>
  props.bundleDiff?.bundles.filter(b => b.hasChanges) || []
)

const toggleExpanded = (bundleId: string) => {
  const next = new Set(expanded.value)
  if (next.has(bundleId)) {
    next.delete(bundleId)
  } else {
    next.add(bundleId)
  }
  expanded.value = next
}
</script>
