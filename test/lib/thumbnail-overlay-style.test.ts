import { afterEach, describe, expect, it } from 'vitest'
import {
  OVERLAY_STYLE_STORAGE_KEY,
  loadOverlayStylePrefs,
  normalizeOverlayStylePrefs,
  saveOverlayStylePrefs,
} from '../../lib/thumbnail-overlay-style'

afterEach(() => {
  localStorage.removeItem(OVERLAY_STYLE_STORAGE_KEY)
})

describe('overlay style prefs', () => {
  it('clamps stored values and round-trips through localStorage', () => {
    expect(normalizeOverlayStylePrefs({ width: 9, border: -2, radius: 400, gap: .5, layoutScope: 'selected', layout: { x: 0, y: 1 } })).toEqual({
      width: 1,
      border: 0,
      radius: 100,
      gap: .12,
      layoutScope: 'selected',
      layout: { x: 0, y: 1 },
    })
    saveOverlayStylePrefs({ width: .2, border: 8, radius: 16, gap: .05, layoutScope: 'all', layout: { x: .5, y: 0 } })
    expect(loadOverlayStylePrefs()).toMatchObject({ width: .2, border: 8, radius: 16, gap: .05, layout: { x: .5, y: 0 } })
  })
})
