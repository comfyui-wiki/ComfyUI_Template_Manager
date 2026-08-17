import { promises as fs } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { createError, readMultipartFormData } from 'h3'
import { isLocalRepoMode } from '~/server/utils/local-repo'

const execFileAsync = promisify(execFile)

export default defineEventHandler(async (event) => {
  if (!isLocalRepoMode()) throw createError({ statusCode: 404, statusMessage: 'Native conversion requires local repo mode' })
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.data)
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'Missing video file' })
  const value = (name: string, fallback: string) => parts?.find(p => p.name === name)?.data?.toString() || fallback
  const start = Math.max(0, Number(value('start', '0')) || 0)
  const end = Math.max(start + 0.05, Number(value('end', '3')) || 3)
  const size = Math.max(1, Math.round(Number(value('size', '512')) || 512))
  const fps = Math.max(1, Math.min(60, Math.round(Number(value('fps', '15')) || 15)))
  const quality = Math.max(0, Math.min(100, Math.round(Number(value('quality', '95')) || 95)))
  const fitMode = value('fitMode', 'crop')
  const cropSize = Math.max(1, Math.round(Number(value('cropSize', '0')) || 0))
  const cropX = Math.max(0, Math.round(Number(value('cropX', '0')) || 0))
  const cropY = Math.max(0, Math.round(Number(value('cropY', '0')) || 0))
  const tempDir = await fs.mkdtemp('/tmp/comfyui-webp-')
  const inputPath = `${tempDir}/input`
  const outputPath = `${tempDir}/output.webp`
  try {
    await fs.writeFile(inputPath, file.data)
    const filter = fitMode === 'crop' && cropSize > 0
      ? `fps=${fps},crop=${cropSize}:${cropSize}:${cropX}:${cropY},scale=${size}:${size}:flags=lanczos`
      : `fps=${fps},scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black`
    await execFileAsync('ffmpeg', ['-y', '-ss', String(start), '-i', inputPath, '-t', String(end - start), '-vf', filter, '-vcodec', 'libwebp', '-lossless', '0', '-compression_level', '4', '-q:v', String(quality), '-loop', '0', '-preset', 'default', '-an', '-vsync', '0', outputPath], { maxBuffer: 10 * 1024 * 1024 })
    setHeader(event, 'Content-Type', 'image/webp')
    return await fs.readFile(outputPath)
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: `Native FFmpeg conversion failed: ${error?.stderr || error?.message || 'unknown error'}` })
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
})
