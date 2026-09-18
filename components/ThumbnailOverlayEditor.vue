<template>
  <div class="space-y-4">
    <label
      class="relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 text-center transition-colors hover:border-primary/40 hover:bg-muted/50"
      :class="disabled ? 'pointer-events-none opacity-50' : ''"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <ImagePlus class="pointer-events-none h-5 w-5 text-muted-foreground" />
      <div class="pointer-events-none space-y-0.5">
        <p class="text-sm font-medium">Add overlay images</p>
        <p class="text-xs text-muted-foreground">Drop files here or click to upload. Drag on the canvas to place them; pull the corner to resize.</p>
      </div>
      <input
        ref="overlayInput"
        type="file"
        accept="image/*"
        multiple
        :disabled="disabled"
        class="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Upload overlay images"
        @change="addImages"
      >
    </label>

    <div ref="stage" class="relative mx-auto aspect-square w-full max-w-[min(100%,56vh)] overflow-hidden rounded-xl bg-zinc-950 shadow-inner ring-1 ring-border touch-none" @pointermove="move" @pointerup="end" @pointercancel="end">
      <canvas ref="preview" class="absolute inset-0 h-full w-full" />
      <div
        v-for="item in items"
        :key="item.id"
        class="absolute cursor-move"
        :style="{ left: item.x * 100 + '%', top: item.y * 100 + '%', width: item.w * 100 + '%', height: item.h * 100 + '%' }"
        :class="selected === item.id ? 'z-10' : 'z-0'"
        @pointerdown="start($event, item, false)"
      >
        <span
          class="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-offset-0"
          :class="selected === item.id ? 'ring-sky-400' : 'ring-transparent'"
        />
        <button
          v-if="selected === item.id"
          type="button"
          aria-label="Resize overlay"
          class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-sm border border-sky-500 bg-white text-sky-700 shadow cursor-nwse-resize"
          @pointerdown.stop="start($event, item, true)"
        >
          <svg viewBox="0 0 12 12" class="h-3 w-3" aria-hidden="true">
            <path d="M11 5v6H5" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M7 11 11 7" fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="items.length" class="flex flex-wrap gap-2">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        class="inline-flex max-w-[12rem] items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs transition-colors"
        :class="selected === item.id
          ? 'border-sky-500 bg-sky-500/10 text-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted/60'"
        :aria-pressed="selected === item.id"
        @click="selected = item.id"
      >
        <img :src="item.url" alt="" class="h-7 w-7 shrink-0 rounded object-cover bg-zinc-900">
        <span class="min-w-0 truncate">{{ index + 1 }}. {{ item.name }}</span>
      </button>
    </div>

    <div v-if="active" class="space-y-4 rounded-xl border bg-background p-4 shadow-sm">
      <div class="grid gap-4 sm:grid-cols-2">
        <fieldset :disabled="disabled" class="space-y-2">
          <legend class="text-sm font-medium">Position</legend>
          <div class="grid w-[132px] grid-cols-3 gap-1">
            <button
              v-for="position in positions"
              :key="position.label"
              type="button"
              :aria-label="position.label"
              :title="position.label"
              class="flex h-9 items-center justify-center rounded-md border transition-colors disabled:opacity-50"
              :class="isAt(position.x, position.y)
                ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'"
              @click="place(position.x, position.y)"
            >
              <component :is="position.icon" class="h-3.5 w-3.5" />
            </button>
          </div>
        </fieldset>

        <div class="space-y-3 text-sm">
          <label class="block space-y-1.5">
            <span class="font-medium">Crop ratio</span>
            <select
              aria-label="Overlay crop ratio"
              :value="active.ratio"
              :disabled="disabled"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              @change="setRatio(($event.target as HTMLSelectElement).value)"
            >
              <option value="original">Original</option>
              <option value="1">1:1 Square</option>
              <option :value="4 / 3">4:3 Landscape</option>
              <option :value="3 / 4">3:4 Portrait</option>
              <option :value="16 / 9">16:9 Widescreen</option>
              <option :value="9 / 16">9:16 Vertical</option>
            </select>
          </label>
          <label class="block space-y-1.5">
            <span class="flex justify-between"><span>Width</span><span class="tabular-nums text-muted-foreground">{{ Math.round(active.w * 100) }}%</span></span>
            <input aria-label="Overlay width" type="range" min="4" max="100" :value="active.w * 100" :disabled="disabled" class="w-full accent-sky-600" @input="setWidth(Number(($event.target as HTMLInputElement).value) / 100)">
          </label>
        </div>
      </div>

      <div v-if="active.ratio !== 'original'" class="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
        <p class="font-medium">Crop focus</p>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Horizontal</span>
          <input v-model.number="active.focusX" aria-label="Crop horizontal focus" type="range" min="0" max="1" step="0.01" :disabled="disabled" class="w-full accent-sky-600" @input="changed">
        </label>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Vertical</span>
          <input v-model.number="active.focusY" aria-label="Crop vertical focus" type="range" min="0" max="1" step="0.01" :disabled="disabled" class="w-full accent-sky-600" @input="changed">
        </label>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block space-y-1 text-sm">
          <span class="flex justify-between"><span>White border</span><span class="tabular-nums text-muted-foreground">{{ active.border }} px</span></span>
          <input v-model.number="active.border" :disabled="disabled" aria-label="White border width" type="range" min="0" max="24" class="w-full accent-sky-600" @input="changed">
        </label>
        <label class="block space-y-1 text-sm">
          <span class="flex justify-between"><span>Corner radius</span><span class="tabular-nums text-muted-foreground">{{ active.radius }} px</span></span>
          <input v-model.number="active.radius" :disabled="disabled" aria-label="Corner radius" type="range" min="0" max="100" class="w-full accent-sky-600" @input="changed">
        </label>
      </div>

      <Button type="button" variant="outline" size="sm" :disabled="disabled" class="text-destructive hover:text-destructive" @click="remove">
        <Trash2 class="h-3.5 w-3.5" />
        Remove image
      </Button>
    </div>

    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <video v-if="video" ref="media" :src="src" muted playsinline class="hidden" @loadeddata="play" @timeupdate="loop" />
    <img v-else ref="still" :src="src" class="hidden" alt="" />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, type Component } from 'vue'
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Circle,
  ImagePlus,
  Trash2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { overlaySourceCrop, fitOverlaySize, overlayPosition } from '~/lib/thumbnail-overlay-layout'

const props = defineProps<{ src: string; video: boolean; size: number; crop: { x: number; y: number; size: number } | null; start: number; end: number; speed: number; disabled: boolean; resetKey?: number }>()
const emit = defineEmits<{ change: [] }>()
type Overlay = { id: number; name: string; image: HTMLImageElement; url: string; x: number; y: number; w: number; h: number; border: number; radius: number; ratio: string; focusX: number; focusY: number }
const items = ref<Overlay[]>([])
const selected = ref(0)
const active = computed(() => items.value.find(i => i.id === selected.value))
const stage = ref<HTMLElement>()
const preview = ref<HTMLCanvasElement>()
const overlayInput = ref<HTMLInputElement>()
const media = ref<HTMLVideoElement>()
const still = ref<HTMLImageElement>()
const error = ref('')
let nextId = 0, frame = 0, disposed = false, generation = 0
let drag: { id: number; px: number; py: number; x: number; y: number; w: number; h: number; resize: boolean } | null = null
const changed = () => emit('change')
const positions: { label: string; icon: Component; x: number; y: number }[] = [
  { label: 'Top left', icon: ArrowUpLeft, x: 0, y: 0 },
  { label: 'Top center', icon: ArrowUp, x: .5, y: 0 },
  { label: 'Top right', icon: ArrowUpRight, x: 1, y: 0 },
  { label: 'Center left', icon: ArrowLeft, x: 0, y: .5 },
  { label: 'Center', icon: Circle, x: .5, y: .5 },
  { label: 'Center right', icon: ArrowRight, x: 1, y: .5 },
  { label: 'Bottom left', icon: ArrowDownLeft, x: 0, y: 1 },
  { label: 'Bottom center', icon: ArrowDown, x: .5, y: 1 },
  { label: 'Bottom right', icon: ArrowDownRight, x: 1, y: 1 },
]
function isAt(x: number, y: number) {
  if (!active.value) return false
  const placed = overlayPosition(active.value.w, active.value.h, x, y)
  return Math.abs(placed.x - active.value.x) < 0.02 && Math.abs(placed.y - active.value.y) < 0.02
}
function place(x: number, y: number) {
  if (!active.value || props.disabled) return
  Object.assign(active.value, overlayPosition(active.value.w, active.value.h, x, y))
  changed()
}
function resizeTo(width: number, ratio: number) {
  const item = active.value!
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2
  Object.assign(item, fitOverlaySize(width, ratio))
  item.x = Math.max(0, Math.min(1 - item.w, cx - item.w / 2))
  item.y = Math.max(0, Math.min(1 - item.h, cy - item.h / 2))
}
function setRatio(value: string) {
  if (!active.value || props.disabled) return
  active.value.ratio = value
  active.value.focusX = active.value.focusY = .5
  resizeTo(active.value.w, value === 'original' ? active.value.image.naturalWidth / active.value.image.naturalHeight : Number(value))
  changed()
}
function setWidth(width: number) {
  if (!active.value || props.disabled) return
  resizeTo(width, active.value.w / active.value.h)
  changed()
}
async function addFiles(files: File[]) {
  error.value = ''
  const version = generation
  for (const file of files) {
    const url = URL.createObjectURL(file), image = new Image()
    try {
      image.src = url
      await image.decode()
      if (disposed || version !== generation) { URL.revokeObjectURL(url); continue }
      const ratio = image.naturalWidth / image.naturalHeight
      const w = Math.min(.35, .35 * ratio), h = w / ratio
      items.value.push({ id: ++nextId, name: file.name, image, url, x: .1, y: .1, w, h, border: 4, radius: 12, ratio: 'original', focusX: .5, focusY: .5 })
      selected.value = nextId
      changed()
    } catch { URL.revokeObjectURL(url); error.value = `Could not load ${file.name}` }
  }
}
async function addImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  await addFiles(files)
}
async function onDrop(event: DragEvent) {
  if (props.disabled) return
  const files = Array.from(event.dataTransfer?.files || []).filter(file => file.type.startsWith('image/'))
  if (files.length) await addFiles(files)
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
    const snap = (n: number) => Math.round(n * 1e6) / 1e6
    const x = snap(item.x * size), y = snap(item.y * size), w = snap(item.w * size), h = snap(item.h * size)
    const radius = Math.min(item.radius * size / props.size, w / 2, h / 2)
    const border = Math.min(item.border * size / props.size, w / 2, h / 2)
    ctx.save()
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.clip()
    const crop = overlaySourceCrop(item.image.naturalWidth, item.image.naturalHeight, item.w / item.h, item.focusX, item.focusY)
    ctx.drawImage(item.image, crop.x, crop.y, crop.width, crop.height, x, y, w, h)
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
watch(() => props.resetKey ?? props.src, reset)
watch(() => props.src, () => {
  still.value?.decode?.().catch(() => {})
})
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
