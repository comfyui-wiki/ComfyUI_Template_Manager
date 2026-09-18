import { describe, expect, it } from 'vitest'
import {
  clampFrameDuration,
  frameRateFromDuration,
  sequenceFrameName,
  slideshowFfmpegArgs,
  stillDrawParams,
  stillOverlayCrop,
} from '../../lib/thumbnail-slideshow'

describe('thumbnail slideshow', () => {
  it('names frames for an ffmpeg image2 sequence', () => {
    expect(sequenceFrameName(0)).toBe('frame_001.png')
    expect(sequenceFrameName(11)).toBe('frame_012.png')
  })

  it('maps hold duration to a stable frame rate', () => {
    expect(clampFrameDuration(0)).toBe(0.15)
    expect(frameRateFromDuration(0.5)).toBe(2)
    expect(frameRateFromDuration(1)).toBe(1)
  })

  it('center-crops landscape stills and letterboxes in pad mode', () => {
    expect(stillDrawParams(800, 400, 400, 'crop')).toEqual({
      sx: 200, sy: 0, sw: 400, sh: 400, dx: 0, dy: 0, dw: 400, dh: 400,
    })
    const pad = stillDrawParams(800, 400, 400, 'pad')
    expect(pad.dw).toBe(400)
    expect(pad.dh).toBe(200)
    expect(pad.dy).toBe(100)
  })

  it('keeps overlay preview crop square relative to source width', () => {
    expect(stillOverlayCrop(800, 400)).toEqual({ x: 0.25, y: 0, size: 0.5 })
  })

  it('builds a looping animated WebP encode', () => {
    const args = slideshowFfmpegArgs({ fps: 2, quality: 95, outputFileName: 'output.webp' })
    expect(args).toContain('-loop')
    expect(args).toContain('0')
    expect(args).toContain('libwebp')
    expect(args[1]).toBe('2')
  })
})
