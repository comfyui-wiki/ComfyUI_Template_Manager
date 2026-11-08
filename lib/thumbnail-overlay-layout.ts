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

export function clampOverlayGap(gap: number) {
  if (!Number.isFinite(gap)) return .03
  return Math.min(.12, Math.max(0, gap))
}

/**
 * Pack several overlays along an edge. Left/right cells stack vertically;
 * top/bottom/center cells stack horizontally. `horizontal`/`vertical` are the
 * 9-grid values (0, .5, 1) and control both the edge and the group's alignment.
 */
export function layoutOverlaysOnEdge(
  sizes: { w: number; h: number }[],
  horizontal: number,
  vertical: number,
  gap = .03
) {
  if (!sizes.length) return []
  if (sizes.length === 1) return [overlayPosition(sizes[0].w, sizes[0].h, horizontal, vertical)]

  const spacing = Math.min(clampOverlayGap(gap), .9 / (sizes.length - 1))
  const stackVertical = horizontal === 0 || horizontal === 1
  if (stackVertical) {
    const total = sizes.reduce((sum, item) => sum + item.h, 0) + spacing * (sizes.length - 1)
    let y = overlayPosition(.2, Math.min(1, total), .5, vertical).y
    if (y + total > 1) y = Math.max(0, 1 - total)
    return sizes.map((item) => {
      const pos = { x: overlayPosition(item.w, item.h, horizontal, .5).x, y }
      y += item.h + spacing
      return pos
    })
  }

  const total = sizes.reduce((sum, item) => sum + item.w, 0) + spacing * (sizes.length - 1)
  let x = overlayPosition(Math.min(1, total), .2, horizontal, .5).x
  if (x + total > 1) x = Math.max(0, 1 - total)
  return sizes.map((item) => {
    const pos = { x, y: overlayPosition(item.w, item.h, .5, vertical).y }
    x += item.w + spacing
    return pos
  })
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

/** Equal panels cover the entire square; source cropping preserves aspect ratio. */
export function collagePanels(count: number, direction: 'horizontal' | 'vertical') {
  return Array.from({ length: count }, (_, index) => direction === 'horizontal'
    ? { x: index / count, y: 0, w: 1 / count, h: 1 }
    : { x: 0, y: index / count, w: 1, h: 1 / count })
}

/** Shrink an oversized group uniformly so every overlay stays on the canvas. */
export function fitOverlayGroup(sizes: { w: number; h: number }[], vertical: boolean, gap: number) {
  const available = Math.max(.001, 1 - Math.min(clampOverlayGap(gap), .9 / Math.max(1, sizes.length - 1)) * Math.max(0, sizes.length - 1))
  const total = sizes.reduce((sum, size) => sum + (vertical ? size.h : size.w), 0)
  const scale = total > 0 ? Math.min(1, available / total) : 1
  return sizes.map(size => ({ w: size.w * scale, h: size.h * scale }))
}
