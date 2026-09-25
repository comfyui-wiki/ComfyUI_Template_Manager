import { clampOverlayGap } from '~/lib/thumbnail-overlay-layout'

export const OVERLAY_STYLE_STORAGE_KEY = 'comfyui_overlay_style'

export type OverlayStylePrefs = {
  width: number
  border: number
  radius: number
  gap: number
  layoutScope: 'selected' | 'all'
  layout: { x: number; y: number } | null
}

export function defaultOverlayStylePrefs(): OverlayStylePrefs {
  return { width: .35, border: 4, radius: 12, gap: .03, layoutScope: 'all', layout: null }
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function parseLayout(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const x = Number((value as { x?: unknown }).x)
  const y = Number((value as { y?: unknown }).y)
  if (![0, .5, 1].includes(x) || ![0, .5, 1].includes(y)) return null
  return { x, y }
}

export function normalizeOverlayStylePrefs(raw: Partial<OverlayStylePrefs> | null | undefined): OverlayStylePrefs {
  const fallback = defaultOverlayStylePrefs()
  if (!raw || typeof raw !== 'object') return fallback
  return {
    width: clamp(Number(raw.width), .04, 1, fallback.width),
    border: clamp(Number(raw.border), 0, 24, fallback.border),
    radius: clamp(Number(raw.radius), 0, 100, fallback.radius),
    gap: clampOverlayGap(Number(raw.gap)),
    layoutScope: raw.layoutScope === 'selected' ? 'selected' : 'all',
    layout: parseLayout(raw.layout),
  }
}

export function loadOverlayStylePrefs(): OverlayStylePrefs {
  if (typeof localStorage === 'undefined') return defaultOverlayStylePrefs()
  try {
    const raw = localStorage.getItem(OVERLAY_STYLE_STORAGE_KEY)
    return normalizeOverlayStylePrefs(raw ? JSON.parse(raw) : null)
  } catch {
    return defaultOverlayStylePrefs()
  }
}

export function saveOverlayStylePrefs(prefs: OverlayStylePrefs) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(OVERLAY_STYLE_STORAGE_KEY, JSON.stringify(normalizeOverlayStylePrefs(prefs)))
  } catch {}
}
