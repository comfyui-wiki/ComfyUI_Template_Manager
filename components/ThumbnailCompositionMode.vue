<template>
  <label class="block space-y-1.5 text-sm">
    <span class="font-medium">Composition mode</span>
    <select aria-label="Composition mode" :value="modelValue" :disabled="disabled" class="block h-10 w-full rounded-md border border-input bg-background px-3" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option value="horizontal" :disabled="count !== 2">Side by side</option>
      <option value="vertical" :disabled="count !== 2">Top and bottom</option>
      <option value="sequence" :disabled="!stills">Sequence / slideshow</option>
    </select>
    <span v-if="!stills" class="block text-xs text-muted-foreground">Video sequences are not supported yet.</span>
  </label>
</template>
<script setup lang="ts">
defineProps<{ modelValue: string; count: number; stills: boolean; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
