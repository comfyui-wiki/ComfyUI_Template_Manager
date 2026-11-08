<template>
  <div class="grid min-h-0 gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_380px]">
    <div class="min-w-0 space-y-3 rounded-xl bg-muted/20 p-3 lg:overflow-y-auto lg:p-5">
      <h3 class="font-semibold">Split cover preview</h3>
      <ThumbnailOverlayEditor ref="overlayEditor" src="" :video="false" :size="size" :crop="null" :start="start" :end="end" :speed="speed" :disabled="busy" :render-base="drawBase" hide-split @change="invalidate" />
      <div class="hidden">
        <template v-for="(panel, i) in panels" :key="panel.url">
          <video v-if="panel.video" :ref="el => setVideo(el, i)" :src="panel.url" muted playsinline @loadedmetadata="metadata" @timeupdate="loopPreview" @ended="loopPreview" />
          <img v-else :ref="el => setImage(el, i)" :src="panel.url" alt="">
        </template>
      </div>
    </div>
    <div class="min-w-0 space-y-4 lg:overflow-y-auto lg:pr-2">
      <ThumbnailCompositionMode :model-value="mode || (vertical ? 'vertical' : 'horizontal')" :count="panels.length" :stills="!animated" :disabled="busy" @update:model-value="changeMode" />
      <ThumbnailSourceList :files="panels.map(panel => panel.file)" :disabled="busy" @add="files => updateSources([...panels.map(panel => panel.file), ...files])" @remove="removeSource" @replace="replaceSource" @move="moveSource" />
      <p class="text-xs text-muted-foreground">Images and videos can be mixed. Videos start together; export ends at the shortest video or the selected duration. Audio is removed.</p>
      <div class="flex flex-wrap gap-2">
        <Button :disabled="busy" variant="outline" @click="reverse">Reverse order</Button>
        <Button :disabled="busy" variant="outline" @click="$emit('clear')">Clear</Button>
      </div>
      <fieldset v-for="(panel, i) in panels" :key="panel.url" :disabled="busy" class="space-y-2 rounded border p-3">
        <legend class="text-sm">{{ i + 1 }}. {{ panel.file.name }}</legend>
        <label class="block text-xs">Horizontal crop focus<input v-model.number="focus[i].x" class="block w-full" type="range" min="0" max="1" step="0.01"></label>
        <label class="block text-xs">Vertical crop focus<input v-model.number="focus[i].y" class="block w-full" type="range" min="0" max="1" step="0.01"></label>
      </fieldset>
      <label class="block text-sm">Output size
        <select v-model.number="size" :disabled="busy" class="block rounded border bg-background p-2"><option :value="400">400 × 400</option><option :value="350">350 × 350</option></select>
      </label>

      <fieldset v-if="animated" :disabled="busy" class="space-y-3 rounded-lg border p-3">
        <legend class="text-sm font-medium">Timeline and playback</legend>
        <label class="block text-sm">Start time (seconds)<input v-model.number="start" type="number" min="0" :max="end - 0.1" step="0.1" class="block w-full rounded border bg-background p-2"></label>
        <label class="block text-sm">End time (seconds)<input v-model.number="end" type="number" :min="start + 0.1" :max="maxDuration" step="0.1" class="block w-full rounded border bg-background p-2"></label>
        <label class="block text-sm">Playback speed ({{ speed }}×)<input v-model.number="speed" type="range" min="1" max="16" step="0.1" class="block w-full"></label>
        <div class="flex flex-wrap gap-2"><Button v-for="seconds in [1, 2, 3]" :key="seconds" size="sm" variant="outline" @click="speed = speedToFitDuration(duration, seconds)">Fit to {{ seconds }}s</Button></div>
        <label class="block text-sm">Frame rate ({{ fps }} fps)<input v-model.number="fps" type="range" min="5" max="30" step="1" class="block w-full"></label>
        <p class="text-xs text-muted-foreground">Output duration: {{ (duration / speed).toFixed(2) }}s · Audio removed</p>
      </fieldset>
      <label class="block text-sm">Fit mode<select v-model="fit" :disabled="busy" class="block w-full rounded border bg-background p-2"><option value="crop">Crop (fill each panel)</option><option value="pad">Fit (keep full source)</option></select></label>
      <label class="block text-sm">Quality ({{ quality }}%)<input v-model.number="quality" :disabled="busy" type="range" min="1" max="100" class="block w-full"></label>
      <Button :disabled="busy || (!native && !ready)" @click="convert">{{ busy ? 'Exporting…' : 'Export split cover as WebP' }}</Button>
      <p v-if="error || sourceError" role="alert" class="text-sm text-red-500">{{ error || sourceError }}</p>
      <div v-if="resultUrl" class="space-y-2">
        <p class="text-xs">{{ resultInfo }}</p>
        <img :src="resultUrl" alt="Exported split cover" class="w-48 rounded">
        <a :href="resultUrl" download="split.webp" class="block underline">Download WebP</a>
        <Button @click="useResult">Use this thumbnail</Button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, nextTick, ref, watch } from 'vue'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { Button } from '@/components/ui/button'
import { speedToFitDuration } from '~/lib/webp-playback-speed'
import ThumbnailOverlayEditor from './ThumbnailOverlayEditor.vue'
import { overlaySourceCrop } from '~/lib/thumbnail-overlay-layout'
import ThumbnailSourceList from './ThumbnailSourceList.vue'
import ThumbnailCompositionMode from './ThumbnailCompositionMode.vue'
import { splitCoverArgs } from '~/lib/thumbnail-split'
const props = defineProps<{ files: File[]; mode?: string; sourceError?: string; initialVertical?: boolean; native: boolean; ready: boolean; ffmpeg: Pick<FFmpeg, 'writeFile' | 'exec' | 'readFile' | 'deleteFile'> | null }>()
const emit = defineEmits<{ sources: [files: File[]]; mode: [value: string]; reorder: [files: File[]]; clear: []; replace: [files: File[]]; converted: [file: File] }>()
const panels = ref(props.files.map(file => ({ file, url: URL.createObjectURL(file), video: file.type.startsWith('video/') })))
const overlayEditor = ref<InstanceType<typeof ThumbnailOverlayEditor>>()
const images: (HTMLImageElement | null)[] = []
function setImage(el: any, i: number) { images[i] = el }
const videos: (HTMLVideoElement | null)[] = []
const focus = ref([{ x: .5, y: .5 }, { x: .5, y: .5 }])
const quality = defineModel<number>('quality', { default: 95 })
const speed = defineModel<number>('speed', { default: 1 })
const fps = defineModel<number>('fps', { default: 15 })
const start = defineModel<number>('start', { default: 0 })
const end = defineModel<number>('end', { default: 3 })
const fit = defineModel<string>('fit', { default: 'crop' })
const duration = computed(() => end.value - start.value)
const resultInfo = ref('')
const vertical = ref(props.initialVertical ?? false), size = ref(400), maxDuration = ref(30), busy = ref(false), error = ref(''), resultUrl = ref('')
let result: File | null = null
const animated = computed(() => panels.value.some(panel => panel.video))
function drawBase(ctx: CanvasRenderingContext2D, outputSize: number) {
  panels.value.forEach((panel, i) => {
    const source = panel.video ? videos[i] : images[i]
    const width = panel.video ? videos[i]?.videoWidth : images[i]?.naturalWidth
    const height = panel.video ? videos[i]?.videoHeight : images[i]?.naturalHeight
    if (!source || !width || !height || (panel.video && videos[i]!.readyState < 2)) return
    const w = vertical.value ? outputSize : outputSize / 2
    const h = vertical.value ? outputSize / 2 : outputSize
    const x = vertical.value ? 0 : i * w, y = vertical.value ? i * h : 0
    if (fit.value === 'pad') {
      const scale = Math.min(w / width, h / height)
      ctx.drawImage(source, x + (w - width * scale) / 2, y + (h - height * scale) / 2, width * scale, height * scale)
    } else {
      const crop = overlaySourceCrop(width, height, w / h, focus.value[i].x, focus.value[i].y)
      ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, x, y, w, h)
    }
  })
}
const focusStyle = (i: number) => ({ objectPosition: `${focus.value[i].x * 100}% ${focus.value[i].y * 100}%` })
function setVideo(el: any, i: number) { videos[i] = el }
function metadata() {
  const lengths = videos.filter(v => v && Number.isFinite(v.duration)).map(v => v!.duration)
  maxDuration.value = Math.min(30, ...lengths)
  if (start.value >= maxDuration.value) start.value = 0
  end.value = Math.min(end.value, maxDuration.value)
  if (videos.filter(Boolean).length === panels.value.filter(p => p.video).length && videos.filter(Boolean).every(v => Number.isFinite(v!.duration))) {
    videos.forEach(v => { if (v) { v.currentTime = start.value; v.playbackRate = speed.value; v.play().catch(() => {}) } })
  }
}
function loopPreview() {
  if (videos.some(v => v && (v.ended || v.currentTime >= end.value || v.currentTime < start.value))) videos.forEach(v => { if (v) { v.currentTime = start.value; v.playbackRate = speed.value; v.play().catch(() => {}) } })
}
function reverse() { panels.value.reverse(); focus.value.reverse(); emit('reorder', panels.value.map(p => p.file)) }
function changeMode(value: string) { if (value !== 'sequence') vertical.value = value === 'vertical'; emit('mode', value) }
watch(() => props.mode, value => { if (value && value !== 'sequence') vertical.value = value === 'vertical' })
function updateSources(files: File[]) { if (!busy.value) emit('sources', files) }
function removeSource(index: number) { updateSources(panels.value.filter((_, i) => i !== index).map(panel => panel.file)) }
function replaceSource(index: number, file: File) { updateSources(panels.value.map((panel, i) => i === index ? file : panel.file)) }
function moveSource(index: number, delta: number) {
  const next = index + delta
  if (busy.value || next < 0 || next >= panels.value.length) return
  reverse()
}
watch(() => props.files, async files => {
  const remaining = panels.value.map((panel, i) => ({ panel, focus: focus.value[i] }))
  const nextFocus: { x: number; y: number }[] = []
  panels.value = files.map(file => {
    const index = remaining.findIndex(item => item.panel.file === file)
    const previous = index >= 0 ? remaining.splice(index, 1)[0] : null
    nextFocus.push(previous?.focus || { x: .5, y: .5 })
    return previous?.panel || { file, url: URL.createObjectURL(file), video: file.type.startsWith('video/') }
  })
  focus.value = nextFocus
  remaining.forEach(item => URL.revokeObjectURL(item.panel.url))
  await nextTick()
  metadata()
})
function invalidate() { if (resultUrl.value) URL.revokeObjectURL(resultUrl.value); resultUrl.value = ''; result = null }
watch([vertical, size, quality, duration, focus, panels, speed, start, end, fps, fit], invalidate, { deep: true })
watch([speed, start, end], () => { videos.forEach(v => { if (v) { v.currentTime = start.value; v.playbackRate = speed.value } }) })
function useResult() { if (result) emit('converted', result) }
async function convert() {
  if (!Number.isFinite(duration.value) || duration.value < .1 || end.value > maxDuration.value || start.value < 0) { error.value = 'Choose a duration within the displayed range.'; return }
  busy.value = true; error.value = ''; invalidate()
  const inputs = panels.value.map((p, i) => ({ name: `split-input-${i}`, video: p.video, ...focus.value[i] }))
  let overlay: Blob | null = null
  try {
  overlay = await overlayEditor.value?.exportPng() || null
  const args = splitCoverArgs({ inputs, size: size.value, duration: duration.value, quality: quality.value, vertical: vertical.value, start: start.value, speed: speed.value, fps: fps.value, fit: fit.value, overlay: !!overlay })
    let blob: Blob
    if (props.native) {
      const body = new FormData()
      panels.value.forEach(p => body.append('source', p.file))
      if (overlay) body.append('overlay', overlay, 'overlay.png')
      body.append('settings', JSON.stringify({ size: size.value, duration: duration.value, quality: quality.value, vertical: vertical.value, start: start.value, speed: speed.value, fps: fps.value, fit: fit.value, focus: focus.value }))
      const response = await fetch('/api/local/convert-webp-split', { method: 'POST', body })
      if (!response.ok) throw new Error(await response.text())
      blob = await response.blob()
    } else {
      const ffmpeg = props.ffmpeg
      if (!ffmpeg) throw new Error('Video converter is not ready.')
      for (const [i, p] of panels.value.entries()) await ffmpeg.writeFile(inputs[i].name, new Uint8Array(await p.file.arrayBuffer()))
      if (overlay) await ffmpeg.writeFile('overlay.png', new Uint8Array(await overlay.arrayBuffer()))
      if (await ffmpeg.exec(args) !== 0) throw new Error('Split cover encoding failed.')
      const data = await ffmpeg.readFile('split.webp')
      if (typeof data === 'string') throw new Error('Unexpected encoder output.')
      blob = new Blob([new Uint8Array(data)], { type: 'image/webp' })
    }
    const originalBytes = panels.value.reduce((sum, p) => sum + p.file.size, 0)
    resultInfo.value = `${(blob.size / 1024).toFixed(1)} KB · ${(100 * (1 - blob.size / originalBytes)).toFixed(1)}% smaller than sources`
    result = new File([blob], 'split.webp', { type: 'image/webp' }); resultUrl.value = URL.createObjectURL(result)
  } catch (e: any) { error.value = e.message || 'Export failed.' }
  finally {
    if (!props.native && props.ffmpeg) for (const name of [...inputs.map(i => i.name), 'split.webp', 'overlay.png']) await props.ffmpeg.deleteFile(name).catch(() => {})
    busy.value = false
  }
}
onBeforeUnmount(() => { videos.forEach(v => v?.pause()); panels.value.forEach(p => URL.revokeObjectURL(p.url)); invalidate() })
</script>
