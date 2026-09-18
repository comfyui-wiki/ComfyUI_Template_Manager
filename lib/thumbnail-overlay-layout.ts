/** Coordinates are normalized to the square output canvas. */
export function fitOverlaySize(width: number, ratio: number) {
  const w = Math.max(.001, Math.min(Math.max(.04, width), 1, ratio))
  return { w, h: w / ratio }
}

export function overlayPosition(w: number, h: number, horizontal: number, vertical: number) {
  const marginX = Math.min(.04, (1 - w) / 2)
  const marginY = Math.min(.04, (1 - h) / 2)
  return {
    x: marginX + (1 - w - 2 * marginX) * horizontal,
    y: marginY + (1 - h - 2 * marginY) * vertical,
  }
}

/** Crop, never stretch, with adjustable focus within the source image. */
export function overlaySourceCrop(width: number, height: number, ratio: number, focusX = .5, focusY = .5) {
  const cropWidth = Math.min(width, height * ratio)
  const cropHeight = Math.min(height, width / ratio)
  return {
    x: (width - cropWidth) * Math.max(0, Math.min(1, focusX)),
    y: (height - cropHeight) * Math.max(0, Math.min(1, focusY)),
    width: cropWidth,
    height: cropHeight,
  }
}
