import { describe, expect, it } from 'vitest'
import { fitOverlaySize, layoutOverlaysOnEdge, overlayPosition, overlaySourceCrop } from '../../lib/thumbnail-overlay-layout'

describe('overlay layout', () => {
  it('keeps all nine positions inside the canvas with a consistent inset', () => {
    for (const x of [0, .5, 1]) for (const y of [0, .5, 1]) {
      const p = overlayPosition(.35, .2, x, y)
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x + .35).toBeLessThanOrEqual(1)
      expect(p.y + .2).toBeLessThanOrEqual(1)
    }
    expect(overlayPosition(1, 1, 1, 1)).toEqual({ x: 0, y: 0 })
    expect(overlayPosition(.2, .2, .5, .5)).toEqual({ x: .4, y: .4 })
  })
  it('crops landscape and portrait images without distorting their contents', () => {
    expect(overlaySourceCrop(400, 200, 1)).toEqual({ x: 100, y: 0, width: 200, height: 200 })
    expect(overlaySourceCrop(200, 400, 1, .5, 1)).toEqual({ x: 0, y: 200, width: 200, height: 200 })
    expect(overlaySourceCrop(400, 200, 2)).toEqual({ x: 0, y: 0, width: 400, height: 200 })
    expect(fitOverlaySize(1, 9 / 16)).toEqual({ w: 9 / 16, h: 1 })
  })
  it('stacks several overlays along an edge with a shared gap', () => {
    const left = layoutOverlaysOnEdge([{ w: .2, h: .2 }, { w: .2, h: .15 }], 0, .5, .04)
    expect(left[0].x).toBe(left[1].x)
    expect(left[0].x).toBeCloseTo(.04)
    expect(left[1].y).toBeCloseTo(left[0].y + .2 + .04)
    const top = layoutOverlaysOnEdge([{ w: .2, h: .1 }, { w: .25, h: .1 }], .5, 0, .05)
    expect(top[0].y).toBe(top[1].y)
    expect(top[1].x).toBeCloseTo(top[0].x + .2 + .05)
  })
})
