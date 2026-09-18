/** Square thumbnail slideshow → looping animated WebP (same cover format as static stills). */

export const SLIDESHOW_SIZE = 400
export const SLIDESHOW_MIN_FRAMES = 2
export const SLIDESHOW_MAX_FRAMES = 24
export const SLIDESHOW_MIN_DURATION = 0.15
export const SLIDESHOW_MAX_DURATION = 3

export function clampFrameDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return 0.5
  return Math.min(SLIDESHOW_MAX_DURATION, Math.max(SLIDESHOW_MIN_DURATION, seconds))
}

/** Input frame rate so each still holds for `seconds`. */
export function frameRateFromDuration(seconds: number) {
  return Math.round((1 / clampFrameDuration(seconds)) * 1000) / 1000
}

export function sequenceFrameName(index: number) {
  return `frame_${String(index + 1).padStart(3, '0')}.png`
}

/** Center-crop or letterbox a still into a square. */
export function stillDrawParams(
  width: number,
  height: number,
  size: number,
  fitMode: 'crop' | 'pad'
) {
  if (fitMode === 'crop') {
    const side = Math.min(width, height)
    return {
      sx: (width - side) / 2,
      sy: (height - side) / 2,
      sw: side,
      sh: side,
      dx: 0,
      dy: 0,
      dw: size,
      dh: size,
    }
  }

  let dw = size
  let dh = size
  let dx = 0
  let dy = 0
  if (width > height) {
    dh = (height * size) / width
    dy = (size - dh) / 2
  } else {
    dw = (width * size) / height
    dx = (size - dw) / 2
  }
  return { sx: 0, sy: 0, sw: width, sh: height, dx, dy, dw, dh }
}

/** Normalized crop for the overlay preview (square from the source width). */
export function stillOverlayCrop(width: number, height: number) {
  const side = Math.min(width, height)
  return {
    x: (width - side) / 2 / width,
    y: (height - side) / 2 / height,
    size: side / width,
  }
}

export function slideshowFfmpegArgs(options: {
  fps: number
  quality: number
  outputFileName: string
}) {
  const fps = Math.max(0.2, Math.min(12, options.fps))
  const quality = Math.max(0, Math.min(100, Math.round(options.quality)))
  return [
    '-framerate', String(fps),
    '-i', 'frame_%03d.png',
    '-vf', `scale=${SLIDESHOW_SIZE}:${SLIDESHOW_SIZE}:flags=lanczos`,
    '-vcodec', 'libwebp',
    '-lossless', '0',
    '-compression_level', '4',
    '-q:v', String(quality),
    '-loop', '0',
    '-preset', 'default',
    '-an',
    '-vsync', '0',
    options.outputFileName,
  ]
}
