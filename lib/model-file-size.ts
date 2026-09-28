const ALLOWED_HOST_SUFFIXES = [
  'huggingface.co',
  'hf.co',
  'modelscope.cn',
  'github.com',
  'githubusercontent.com',
  'civitai.com',
  'civitai.red',
]

const REQUEST_TIMEOUT_MS = 20000
const MAX_URLS = 40

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (!host || host.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  return ALLOWED_HOST_SUFFIXES.some(suffix => host === suffix || host.endsWith(`.${suffix}`))
}

function parseHttps(url: string): { origin: string; href: string } | null {
  const match = url.trim().match(/^https:\/\/([^/?#]+)([^?#]*)/i)
  if (!match) return null
  const authority = match[1]
  if (authority.includes('@') || authority.startsWith('[')) return null
  const colon = authority.indexOf(':')
  const host = colon === -1 ? authority : authority.slice(0, colon)
  if (colon !== -1 && !/^\d+$/.test(authority.slice(colon + 1))) return null
  if (!hostAllowed(host)) return null
  const path = match[2] || '/'
  return { origin: `https://${authority}`, href: `https://${authority}${path}` }
}

/** Public model hosts we are willing to ask for a file size. */
export function isAllowedModelDownloadUrl(url: string): boolean {
  return parseHttps(url) !== null
}


function trimNumber(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

/** Human-readable file size for a generated model note. */
export function formatModelFileSize(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${trimNumber(gb, 2)} GB`
  const mb = bytes / (1024 ** 2)
  if (mb >= 1) return `${trimNumber(mb, 1)} MB`
  const kb = bytes / 1024
  if (kb >= 1) return `${Math.round(kb)} KB`
  return `${Math.round(bytes)} B`
}

export function modelDownloadMarkdown(name: string, url: string, sizeBytes: number | null): string {
  const line = `- [${name}](${url})`
  const size = sizeBytes == null ? null : formatModelFileSize(sizeBytes)
  return size ? `${line} (${size})` : line
}

function positiveHeader(headers: Headers, name: string): number | null {
  const value = Number(headers.get(name))
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function headerBytes(headers: Headers, status: number): number | null {
  const linked = positiveHeader(headers, 'x-linked-size')
  if (linked) return linked
  if (status >= 300 && status < 400) return null
  const type = (headers.get('content-type') || '').toLowerCase()
  if (type.includes('text/html') || type.includes('text/plain')) return null
  return positiveHeader(headers, 'content-length')
}

function contentRangeTotal(headers: Headers): number | null {
  const match = (headers.get('content-range') || '').match(/\/(\d+)\s*$/)
  if (!match) return null
  const bytes = Number(match[1])
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  return bytes
}

async function requestSize(url: string, init: RequestInit, fetchImpl: typeof fetch): Promise<number | null> {
  const response = await fetchImpl(url, {
    ...init,
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const fromHeaders = headerBytes(response.headers, response.status)
  const fromRange = response.status === 206 ? contentRangeTotal(response.headers) : null
  await response.body?.cancel()
  return fromHeaders || fromRange
}

/** Read one download URL's size. Returns null when the host or headers do not provide it. */
export async function readModelFileSize(url: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  if (!isAllowedModelDownloadUrl(url)) return null
  try {
    const fromHead = await requestSize(url, { method: 'HEAD' }, fetchImpl)
    if (fromHead) return fromHead
    return await requestSize(url, { method: 'GET', headers: { Range: 'bytes=0-0' } }, fetchImpl)
  } catch {
    return null
  }
}

export async function readModelFileSizes(
  urls: string[],
  fetchImpl: typeof fetch = fetch
): Promise<Record<string, number | null>> {
  const unique = [...new Set(urls.filter(url => typeof url === 'string' && url.trim()))].slice(0, MAX_URLS)
  const sizes: Record<string, number | null> = {}
  const queue = [...unique]
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift()
      if (!url) return
      sizes[url] = await readModelFileSize(url, fetchImpl)
    }
  })
  await Promise.all(workers)
  return sizes
}
