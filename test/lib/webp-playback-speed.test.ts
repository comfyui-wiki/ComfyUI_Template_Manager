import { describe, expect, it } from 'vitest'
import {
  clampPlaybackSpeed,
  outputDurationSeconds,
  speedToFitDuration,
  withPlaybackSpeedFilter
} from '../../lib/webp-playback-speed'

describe('webp-playback-speed', () => {
  it('clamps invalid and extreme speeds to 1x..16x', () => {
    expect(clampPlaybackSpeed(1)).toBe(1)
    expect(clampPlaybackSpeed(0.5)).toBe(1)
    expect(clampPlaybackSpeed(Number.NaN)).toBe(1)
    expect(clampPlaybackSpeed(32)).toBe(16)
  })

  it('fits a long selection into 1s or 3s', () => {
    expect(speedToFitDuration(6, 3)).toBe(2)
    expect(speedToFitDuration(9, 1)).toBe(9)
    expect(speedToFitDuration(2, 3)).toBe(1)
  })

  it('computes output duration from source length and speed', () => {
    expect(outputDurationSeconds(6, 2)).toBe(3)
    expect(outputDurationSeconds(3, 1)).toBe(3)
  })

  it('prefixes setpts only when speeding up', () => {
    const base = 'fps=15,scale=350:350'
    expect(withPlaybackSpeedFilter(base, 1)).toBe(base)
    expect(withPlaybackSpeedFilter(base, 2)).toBe('setpts=PTS/2,fps=15,scale=350:350')
    expect(withPlaybackSpeedFilter(base, 2.5)).toBe('setpts=PTS/2.5,fps=15,scale=350:350')
  })
})
