<template>
  <div
    v-if="isLocalMode && modeInfo.loaded"
    class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm"
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
      <Button size="sm" variant="outline" :disabled="refreshing" @click="handleRefresh">
        Refresh status
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'

const { modeInfo, isLocalMode, refreshMode } = useRepoMode()
const refreshing = ref(false)

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
</script>
