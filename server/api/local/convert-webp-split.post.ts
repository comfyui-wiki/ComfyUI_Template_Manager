import { promises as fs } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { createError, readMultipartFormData } from 'h3'
import { isLocalRepoMode } from '~/server/utils/local-repo'
import { splitCoverArgs } from '~/lib/thumbnail-split'
const run = promisify(execFile)
export default defineEventHandler(async event => {
  if (!isLocalRepoMode()) throw createError({ statusCode: 404 })
  const parts = await readMultipartFormData(event)
  const sources = (parts || []).filter(p => p.name === 'source' && p.data.length)
  let settings: any
  try { settings = JSON.parse(parts?.find(p => p.name === 'settings')?.data.toString() || '') } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid settings' }) }
  if (sources.length !== 2 || !sources.every(p => /^(image\/(jpeg|png|webp)|video\/(mp4|quicktime))$/.test(p.type || '')) ||
      ![350, 400].includes(settings.size) || !Number.isFinite(settings.duration) || settings.duration < .1 || settings.duration > 30 ||
      !Number.isFinite(settings.quality) || settings.quality < 1 || settings.quality > 100 || typeof settings.vertical !== 'boolean' ||
      !Array.isArray(settings.focus) || settings.focus.length !== 2 || !settings.focus.every((f: any) => f && [f.x, f.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid split cover inputs' })
  }
  if (!Number.isFinite(settings.start) || settings.start < 0 || settings.start + settings.duration > 30 ||
      !Number.isFinite(settings.speed) || settings.speed < 1 || settings.speed > 16 ||
      !Number.isFinite(settings.fps) || settings.fps < 5 || settings.fps > 30 || !['crop', 'pad'].includes(settings.fit)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid timeline or compression settings' })
  }
  const dir = await fs.mkdtemp('/tmp/comfyui-split-')
  try {
    const inputs = sources.map((p, i) => ({ name: `split-input-${i}`, video: p.type!.startsWith('video/'), ...settings.focus[i] }))
    for (const [i, source] of sources.entries()) await fs.writeFile(`${dir}/${inputs[i].name}`, source.data)
    const overlay = parts?.find(p => p.name === 'overlay' && p.type === 'image/png')
    if (overlay) await fs.writeFile(`${dir}/overlay.png`, overlay.data)
    await run('ffmpeg', splitCoverArgs({ ...settings, inputs, overlay: !!overlay }), { cwd: dir, timeout: 120000, maxBuffer: 2 * 1024 * 1024 })
    setHeader(event, 'Content-Type', 'image/webp')
    return await fs.readFile(`${dir}/split.webp`)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})
