import { promises as fs } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { createError, readMultipartFormData } from 'h3'
import { isLocalRepoMode } from '~/server/utils/local-repo'
import {
  SLIDESHOW_MAX_FRAMES,
  SLIDESHOW_MIN_FRAMES,
  clampFrameDuration,
  frameRateFromDuration,
  sequenceFrameName,
  slideshowFfmpegArgs,
} from '~/lib/thumbnail-slideshow'

const execFileAsync = promisify(execFile)

export default defineEventHandler(async (event) => {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Native conversion requires local repo mode' })
  }

  const parts = await readMultipartFormData(event)
  const frames = (parts || []).filter(part => part.name === 'frame' && part.data?.length)
  if (frames.length < SLIDESHOW_MIN_FRAMES) {
    throw createError({ statusCode: 400, statusMessage: `Need at least ${SLIDESHOW_MIN_FRAMES} stills` })
  }
  if (frames.length > SLIDESHOW_MAX_FRAMES) {
    throw createError({ statusCode: 400, statusMessage: `At most ${SLIDESHOW_MAX_FRAMES} stills` })
  }

  const value = (name: string, fallback: string) => parts?.find(p => p.name === name)?.data?.toString() || fallback
  const duration = clampFrameDuration(Number(value('duration', '0.5')) || 0.5)
  const quality = Math.max(0, Math.min(100, Math.round(Number(value('quality', '95')) || 95)))
  const fps = frameRateFromDuration(duration)
  const tempDir = await fs.mkdtemp('/tmp/comfyui-webp-slides-')
  const outputPath = `${tempDir}/output.webp`

  try {
    for (const [index, frame] of frames.entries()) {
      await fs.writeFile(`${tempDir}/${sequenceFrameName(index)}`, frame.data)
    }
    await execFileAsync(
      'ffmpeg',
      ['-y', ...slideshowFfmpegArgs({ fps, quality, outputFileName: 'output.webp' })],
      { cwd: tempDir, maxBuffer: 20 * 1024 * 1024 }
    )
    setHeader(event, 'Content-Type', 'image/webp')
    return await fs.readFile(outputPath)
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Native FFmpeg slideshow failed: ${error?.stderr || error?.message || 'unknown error'}`,
    })
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
})
