import { promises as fs } from 'fs'
import { extname } from 'path'
import { createReadStream } from 'fs'
import type { H3Event } from 'h3'
import { sendStream, getQuery, createError, setHeader } from 'h3'
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

/** Serve a file from the local workflow_templates clone (GET or HEAD). */
export async function serveLocalRepoFile(event: H3Event, options?: { headOnly?: boolean }) {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Local repo mode is not enabled' })
  }

  const { path, ref } = getQuery(event)
  if (!path || typeof path !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing path query parameter' })
  }

  const headOnly = options?.headOnly ?? event.method === 'HEAD'
  const ext = extname(path).toLowerCase()
  setHeader(event, 'Content-Type', MIME[ext] || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'no-cache')

  if (ref === 'compare') {
    const buffer = await readFileBufferAtRef(getCompareRef(), path.replace(/^\//, ''))
    if (!buffer) {
      throw createError({ statusCode: 404, statusMessage: `File not found at ${getCompareRef()}:${path}` })
    }
    setHeader(event, 'Content-Length', String(buffer.length))
    if (headOnly) {
      setResponseStatus(event, 200)
      return ''
    }
    return buffer
  }

  const fullPath = resolveRepoPath(path)

  try {
    const stat = await fs.stat(fullPath)
    setHeader(event, 'Content-Length', String(stat.size))

    if (headOnly) {
      setResponseStatus(event, 200)
      return ''
    }

    return sendStream(event, createReadStream(fullPath))
  } catch {
    throw createError({ statusCode: 404, statusMessage: `File not found: ${path}` })
  }
}
