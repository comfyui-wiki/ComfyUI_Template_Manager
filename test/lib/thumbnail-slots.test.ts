import { describe, expect, it } from 'vitest'
import { swapThumbnailSlots, swapThumbnailSlotInfo } from '../../lib/thumbnail-slots'
describe('output thumbnail order', () => {
  const first = new File(['first'], 'first.webp'), second = new File(['second'], 'second.webp')
  it('marks both saved files for writing to the opposite output paths', () => {
    const swapped = swapThumbnailSlots([first, second], new Map())
    expect(swapped.files).toEqual([second, first])
    expect(swapped.pending.get(1)).toBe(second)
    expect(swapped.pending.get(2)).toBe(first)
    expect(swapThumbnailSlots(swapped.files, swapped.pending).files).toEqual([first, second])
  })
  it('moves a single pending file to the empty slot without duplicating it', () => {
    const swapped = swapThumbnailSlots([first], new Map([[1, first]]))
    expect(swapped.files[0]).toBeUndefined()
    expect(swapped.files[1]).toBe(first)
    expect(swapped.pending.has(1)).toBe(false)
    expect(swapped.pending.get(2)).toBe(first)
    expect(swapped.files.filter(Boolean)).toEqual([first])
  })
  it('swaps cached metadata without revoking still-used preview URLs', () => {
    expect(swapThumbnailSlotInfo(new Map([[1, 'url-a'], [2, 'url-b']]))).toEqual(new Map([[1, 'url-b'], [2, 'url-a']]))
    expect(swapThumbnailSlotInfo(new Map([[1, 'url-a']]))).toEqual(new Map([[2, 'url-a']]))
  })
})
