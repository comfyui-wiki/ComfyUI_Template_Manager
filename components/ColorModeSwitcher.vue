<template>
  <ClientOnly>
    <Select
      :model-value="preference"
      @update:model-value="setPreference"
    >
      <SelectTrigger
        title="Appearance: follow system or choose light/dark"
        class="h-8 w-[120px] sm:w-[140px] border-border text-xs shrink-0"
      >
        <component
          :is="currentIcon"
          class="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system" class="text-xs">
          System
        </SelectItem>
        <SelectItem value="light" class="text-xs">
          Light
        </SelectItem>
        <SelectItem value="dark" class="text-xs">
          Dark
        </SelectItem>
      </SelectContent>
    </Select>
    <template #fallback>
      <div class="h-8 w-[120px] sm:w-[140px] shrink-0 rounded-md border border-border bg-muted/40 animate-pulse" />
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Moon, Sun } from 'lucide-vue-next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const colorMode = useColorMode()

const preference = computed(() => {
  const p = colorMode.preference
  if (p === 'system' || p === 'light' || p === 'dark') return p
  return 'system'
})

const currentIcon = computed(() => {
  switch (preference.value) {
    case 'dark':
      return Moon
    case 'light':
      return Sun
    default:
      return Monitor
  }
})

function setPreference(value: unknown) {
  const v = String(value ?? '')
  if (v === 'system' || v === 'light' || v === 'dark') {
    colorMode.preference = v
  }
}
</script>
