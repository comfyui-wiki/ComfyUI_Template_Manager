/** Swap the two output slots, retaining an empty slot rather than compacting it. */
export function swapThumbnailSlots(files: File[], pending: Map<number, File>) {
  const first = pending.get(1) || files[0]
  const second = pending.get(2) || files[1]
  const swapped = new Array<File>(2)
  const uploads = new Map(pending)
  uploads.delete(1)
  uploads.delete(2)
  if (second) { swapped[0] = second; uploads.set(1, second) }
  if (first) { swapped[1] = first; uploads.set(2, first) }
  return { files: swapped, pending: uploads }
}

export function swapThumbnailSlotInfo<T>(values: Map<number, T>) {
  const swapped = new Map(values)
  swapped.delete(1)
  swapped.delete(2)
  if (values.has(2)) swapped.set(1, values.get(2)!)
  if (values.has(1)) swapped.set(2, values.get(1)!)
  return swapped
}
