import { promises as fs } from 'fs'
import { extname } from 'path'
import { createReadStream } from 'fs'
import { sendStream, getQuery, createError } from 'h3'
import { getCompareRef, isLocalRepoMode, readFileBufferAtRef, resolveRepoPath } from '~/server/utils/local-repo'

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary'
}

export default defineEventHandler(async (event) => {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Local repo mode is not enabled' })
  }

  const { path, ref } = getQuery(event)
  if (!path || typeof path !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing path query parameter' })
  }

  const ext = extname(path).toLowerCase()
  setHeader(event, 'Content-Type', MIME[ext] || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'no-cache')

  if (ref === 'compare') {
    const buffer = await readFileBufferAtRef(getCompareRef(), path.replace(/^\//, ''))
    if (!buffer) {
      throw createError({ statusCode: 404, statusMessage: `File not found at ${getCompareRef()}:${path}` })
    }
    return buffer
  }

  const fullPath = resolveRepoPath(path)

  try {
    await fs.access(fullPath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: `File not found: ${path}` })
  }

  return sendStream(event, createReadStream(fullPath))
})
