<template>
  <section class="space-y-2" aria-label="Source assets">
    <div class="flex items-center justify-between gap-2">
      <h4 class="text-sm font-medium">Source assets ({{ files.length }})</h4>
      <label class="relative cursor-pointer rounded-md border px-2 py-1 text-xs" :class="disabled ? 'pointer-events-none opacity-50' : ''">
        Add sources
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" aria-label="Add source files" :disabled="disabled" class="absolute inset-0 w-full cursor-pointer opacity-0" @change="add">
      </label>
    </div>
    <ol class="space-y-2">
      <li v-for="(asset, i) in assets" :key="asset.url" class="flex gap-2 rounded-lg border bg-muted/20 p-2">
        <video v-if="asset.file.type.startsWith('video/')" :src="asset.url" muted playsinline preload="metadata" class="h-14 w-14 shrink-0 rounded bg-black object-cover" />
        <img v-else :src="asset.url" alt="" class="h-14 w-14 shrink-0 rounded bg-black object-cover">
        <div class="min-w-0 flex-1 space-y-1">
          <p class="truncate text-xs font-medium" :title="asset.file.name">{{ i + 1 }}. {{ asset.file.name }}</p>
          <p class="text-[11px] text-muted-foreground">{{ asset.file.type.startsWith('video/') ? 'Video' : 'Image' }} · {{ (asset.file.size / 1024).toFixed(1) }} KB</p>
          <div class="flex flex-wrap items-center gap-1">
            <button type="button" :disabled="disabled || i === 0" :aria-label="`Move source ${i + 1} earlier`" class="rounded border px-2 py-1 text-xs disabled:opacity-40" @click="$emit('move', i, -1)">↑</button>
            <button type="button" :disabled="disabled || i === files.length - 1" :aria-label="`Move source ${i + 1} later`" class="rounded border px-2 py-1 text-xs disabled:opacity-40" @click="$emit('move', i, 1)">↓</button>
            <label class="relative cursor-pointer rounded border px-2 py-1 text-xs" :class="disabled ? 'pointer-events-none opacity-50' : ''">
              Replace
              <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" :aria-label="`Replace source ${i + 1}`" :disabled="disabled" class="absolute inset-0 w-full cursor-pointer opacity-0" @change="replace($event, i)">
            </label>
            <button type="button" :disabled="disabled" :aria-label="`Remove source ${i + 1}`" class="rounded border px-2 py-1 text-xs text-destructive disabled:opacity-40" @click="$emit('remove', i)">Remove</button>
          </div>
        </div>
      </li>
    </ol>
    <p class="text-[11px] text-muted-foreground">Order sets the left/right or top/bottom position, or sequence playback order.</p>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps<{ files: File[]; disabled?: boolean }>()
const emit = defineEmits<{ add: [files: File[]]; replace: [index: number, file: File]; remove: [index: number]; move: [index: number, delta: number] }>()
const assets = ref<{ file: File; url: string }[]>([])
watch(() => props.files, files => {
  const remaining = [...assets.value]
  assets.value = files.map(file => {
    const index = remaining.findIndex(asset => asset.file === file)
    return index >= 0 ? remaining.splice(index, 1)[0] : { file, url: URL.createObjectURL(file) }
  })
  remaining.forEach(asset => URL.revokeObjectURL(asset.url))
}, { immediate: true })
function add(event: Event) {
  const input = event.target as HTMLInputElement, files = Array.from(input.files || [])
  input.value = ''
  if (!props.disabled && files.length) emit('add', files)
}
function replace(event: Event, index: number) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  input.value = ''
  if (!props.disabled && file) emit('replace', index, file)
}
onBeforeUnmount(() => assets.value.forEach(asset => URL.revokeObjectURL(asset.url)))
</script>
