<template>
  <div class="space-y-3">
    <label class="block text-sm font-medium">Overlay images
      <input type="file" accept="image/*" multiple :disabled="disabled" class="block mt-2 text-sm" @change="addImages">
    </label>
    <p class="text-xs text-muted-foreground">Add images, drag to position, and use the corner handle to resize. Border and radius use output pixels.</p>
    <div ref="stage" class="relative w-full max-w-[500px] aspect-square bg-black overflow-hidden touch-none" @pointermove="move" @pointerup="end" @pointercancel="end">
      <canvas ref="preview" class="absolute inset-0 w-full h-full" />
      <div v-for="item in items" :key="item.id" class="absolute cursor-move" :style="{ left: item.x * 100 + '%', top: item.y * 100 + '%', width: item.w * 100 + '%', height: item.h * 100 + '%', outline: selected === item.id ? '2px solid #38bdf8' : undefined }" @pointerdown="start($event, item, false)">
        <button v-if="selected === item.id" type="button" aria-label="Resize overlay" class="absolute bottom-0 right-0 w-4 h-4 bg-white border border-blue-500 cursor-nwse-resize" @pointerdown.stop="start($event, item, true)" />
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      <button v-for="(item, index) in items" :key="item.id" type="button" class="border rounded px-2 py-1 text-xs" :aria-pressed="selected === item.id" @click="selected = item.id">{{ index + 1 }}. {{ item.name }}</button>
    </div>
    <div v-if="active" class="flex flex-wrap items-center gap-4 text-sm">
      <label>White border: {{ active.border }} px <input v-model.number="active.border" :disabled="disabled" aria-label="White border width" type="range" min="0" max="24" @input="changed" /></label>
      <label>Corner radius: {{ active.radius }} px <input v-model.number="active.radius" :disabled="disabled" aria-label="Corner radius" type="range" min="0" max="100" @input="changed" /></label>
      <button type="button" :disabled="disabled" class="border rounded px-2 py-1" @click="remove">Remove image</button>
    </div>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <video v-if="video" ref="media" :src="src" muted playsinline class="hidden" @loadeddata="play" @timeupdate="loop" />
    <img v-else ref="still" :src="src" class="hidden" alt="" />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
const props = defineProps<{ src: string; video: boolean; size: number; crop: { x: number; y: number; size: number } | null; start: number; end: number; speed: number; disabled: boolean }>()
const emit = defineEmits<{ change: [] }>()
type Overlay = { id: number; name: string; image: HTMLImageElement; url: string; x: number; y: number; w: number; h: number; border: number; radius: number }
const items = ref<Overlay[]>([])
const selected = ref(0)
const active = computed(() => items.value.find(i => i.id === selected.value))
const stage = ref<HTMLElement>()
const preview = ref<HTMLCanvasElement>()
const media = ref<HTMLVideoElement>()
const still = ref<HTMLImageElement>()
const error = ref('')
let nextId = 0, frame = 0, disposed = false, generation = 0
let drag: { id: number; px: number; py: number; x: number; y: number; w: number; h: number; resize: boolean } | null = null
const changed = () => emit('change')
async function addImages(event: Event) {
  const input = event.target as HTMLInputElement
  error.value = ''
  const files = Array.from(input.files || [])
  input.value = ''
  const version = generation
  for (const file of files) {
    const url = URL.createObjectURL(file), image = new Image()
    try {
      image.src = url
      await image.decode()
      if (disposed || version !== generation) { URL.revokeObjectURL(url); continue }
      const ratio = image.naturalWidth / image.naturalHeight
      const w = Math.min(.35, .35 * ratio), h = w / ratio
      items.value.push({ id: ++nextId, name: file.name, image, url, x: .1, y: .1, w, h, border: 4, radius: 12 })
      selected.value = nextId
      changed()
    } catch { URL.revokeObjectURL(url); error.value = `Could not load ${file.name}` }
  }
}
function remove() {
  if (!active.value) return
  URL.revokeObjectURL(active.value.url)
  items.value = items.value.filter(i => i.id !== selected.value)
  selected.value = items.value.at(-1)?.id || 0
  changed()
}
function start(e: PointerEvent, item: Overlay, resize: boolean) {
  if (props.disabled) return
  e.preventDefault()
  selected.value = item.id
  stage.value?.setPointerCapture(e.pointerId)
  drag = { id: item.id, px: e.clientX, py: e.clientY, x: item.x, y: item.y, w: item.w, h: item.h, resize }
}
function move(e: PointerEvent) {
  if (!drag || !stage.value) return
  const item = items.value.find(i => i.id === drag!.id)!
  const width = stage.value.getBoundingClientRect().width
  const dx = (e.clientX - drag.px) / width, dy = (e.clientY - drag.py) / width
  if (drag.resize) {
    const ratio = drag.h / drag.w
    item.w = Math.max(Math.min(.04, 1 - item.x, (1 - item.y) / ratio), Math.min(drag.w + (Math.abs(dx) >= Math.abs(dy) ? dx : dy / ratio), 1 - item.x, (1 - item.y) / ratio))
    item.h = item.w * ratio
  } else {
    item.x = Math.max(0, Math.min(1 - item.w, drag.x + dx))
    item.y = Math.max(0, Math.min(1 - item.h, drag.y + dy))
  }
  changed()
}
function end() { drag = null }
function drawOverlays(ctx: CanvasRenderingContext2D, size: number) {
  for (const item of items.value) {
    const x = item.x * size, y = item.y * size, w = item.w * size, h = item.h * size
    const radius = Math.min(item.radius * size / props.size, w / 2, h / 2)
    const border = Math.min(item.border * size / props.size, w / 2, h / 2)
    ctx.save()
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.clip()
    ctx.drawImage(item.image, x, y, w, h)
    if (border) {
      ctx.strokeStyle = 'white'; ctx.lineWidth = border * 2
      ctx.stroke()
    }
    ctx.restore()
  }
}
function render() {
  const canvas = preview.value
  if (canvas) {
    if (canvas.width !== props.size) canvas.width = canvas.height = props.size
    const ctx = canvas.getContext('2d')!
    const source = props.video ? media.value : still.value
    const w = props.video ? media.value?.videoWidth : still.value?.naturalWidth
    const h = props.video ? media.value?.videoHeight : still.value?.naturalHeight
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, props.size, props.size)
    if (source && w && h && (!props.video || (media.value?.readyState || 0) >= 2)) {
      if (props.crop) ctx.drawImage(source, props.crop.x * w, props.crop.y * h, props.crop.size * w, props.crop.size * w, 0, 0, props.size, props.size)
      else {
        const scale = props.size / Math.max(w, h)
        ctx.drawImage(source, (props.size - w * scale) / 2, (props.size - h * scale) / 2, w * scale, h * scale)
      }
    }
    drawOverlays(ctx, props.size)
  }
  frame = requestAnimationFrame(render)
}
function play() { if (media.value) { media.value.currentTime = props.start; media.value.playbackRate = props.speed; media.value.play().catch(() => {}) } }
function loop() { if (media.value && media.value.currentTime >= props.end) media.value.currentTime = props.start }
function reset() { generation++; items.value.forEach(i => URL.revokeObjectURL(i.url)); items.value = []; selected.value = 0; drag = null }
watch(() => props.src, reset)
watch(() => [props.start, props.end, props.speed], play)
onMounted(() => { frame = requestAnimationFrame(render) })
onBeforeUnmount(() => { disposed = true; cancelAnimationFrame(frame); reset() })
async function exportPng(): Promise<Blob | null> {
  if (!items.value.length) return null
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = props.size
  drawOverlays(canvas.getContext('2d')!, props.size)
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not render overlay images')), 'image/png'))
}
defineExpose({ drawOverlays, exportPng })
</script>
