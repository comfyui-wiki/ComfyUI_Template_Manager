<template>
  <div
    v-if="isLocalMode && modeInfo.loaded"
    class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm space-y-3"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="font-medium text-emerald-800 dark:text-emerald-300">
          Local repo mode
        </p>
        <p class="text-muted-foreground font-mono text-xs break-all">
          {{ modeInfo.repoPath }}
        </p>
        <p class="text-xs text-muted-foreground">
          Branch <span class="font-mono font-medium text-foreground">{{ modeInfo.branch }}</span>
          · Compare vs <span class="font-mono font-medium text-foreground">{{ modeInfo.compareRef }}</span>
          <span v-if="modeInfo.dirty" class="ml-2 text-amber-600 dark:text-amber-400">(uncommitted changes)</span>
        </p>
      </div>
      <div class="flex gap-2">
        <Button size="sm" variant="outline" :disabled="fetchingUpstream" @click="handleFetchUpstream">
          Fetch upstream
        </Button>
        <Button size="sm" variant="outline" :disabled="refreshing" @click="handleRefresh">
          Refresh
        </Button>
      </div>
    </div>

    <!-- Upstream sync status -->
    <div v-if="upstreamCompare?.available" class="rounded-md border px-3 py-2 text-xs"
      :class="upstreamStatusClass"
    >
      <p class="font-medium flex items-center gap-1.5">
        <svg v-if="upstreamCompare.isBehind || upstreamCompare.isDiverged" class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ upstreamStatusLabel }}
      </p>
      <p v-if="upstreamCompare.isBehind || upstreamCompare.isDiverged" class="mt-1 opacity-90">
        Click <strong>Fetch upstream</strong> to update remote refs, then merge or rebase in your terminal:
        <code class="block mt-1 font-mono text-[11px] bg-black/5 dark:bg-white/5 px-2 py-1 rounded">git merge {{ modeInfo.compareRef }}</code>
      </p>
    </div>
    <div v-else-if="upstreamCompare && !upstreamCompare.available" class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
      <p class="font-medium">Upstream ref unavailable</p>
      <p class="mt-0.5 opacity-90">{{ upstreamCompare.error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'

const { modeInfo, isLocalMode, refreshMode, fetchUpstream } = useRepoMode()
const refreshing = ref(false)
const fetchingUpstream = ref(false)

const upstreamCompare = computed(() => modeInfo.value.upstreamCompare)

const upstreamStatusLabel = computed(() => {
  const c = upstreamCompare.value
  if (!c?.available) return ''
  if (c.isDiverged) {
    return `${c.aheadBy} commit${c.aheadBy !== 1 ? 's' : ''} ahead, ${c.behindBy} behind ${c.compareRef}`
  }
  if (c.isBehind) {
    return `${c.behindBy} commit${c.behindBy !== 1 ? 's' : ''} behind ${c.compareRef}`
  }
  if (c.isAhead) {
    return `${c.aheadBy} commit${c.aheadBy !== 1 ? 's' : ''} ahead of ${c.compareRef}`
  }
  return `Up to date with ${c.compareRef}`
})

const upstreamStatusClass = computed(() => {
  const c = upstreamCompare.value
  if (!c?.available) return ''
  if (c.isDiverged) {
    return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300'
  }
  if (c.isBehind) {
    return 'border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-300'
  }
  if (c.isAhead) {
    return 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300'
  }
  return 'border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300'
})

onMounted(() => {
  void refreshMode()
})

const handleRefresh = async () => {
  refreshing.value = true
  try {
    await refreshMode()
  } finally {
    refreshing.value = false
  }
}

const handleFetchUpstream = async () => {
  fetchingUpstream.value = true
  try {
    await fetchUpstream()
    if (process.client) {
      window.dispatchEvent(new CustomEvent('local-upstream-refreshed'))
    }
  } finally {
    fetchingUpstream.value = false
  }
}
</script>
