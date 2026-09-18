/** Turn a model download URL into the hosting repository page when possible. */

function parseHttpUrl(url: string): { host: string; path: string; origin: string } | null {
  const match = url.trim().match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?/i)
  if (!match) return null
  const protocol = match[1].toLowerCase()
  const host = match[2].toLowerCase()
  const path = (match[3] || '/').replace(/\/+$/, '') || '/'
  return { host, path, origin: `${protocol}://${match[2]}` }
}

export function repoUrlFromDownloadUrl(url: string): string {
  const parsed = parseHttpUrl(url)
  if (!parsed) return ''
  const host = parsed.host.replace(/^www\./, '')
  const path = parsed.path

  if (host === 'huggingface.co') {
    const cut = path.split(/\/(?:resolve|blob|tree)\//)[0]
    const parts = cut.split('/').filter(Boolean)
    if (parts.length >= 2) return `https://huggingface.co/${parts.slice(0, 2).join('/')}`
    return ''
  }

  if (host === 'modelscope.cn') {
    const match = path.match(/^\/models\/([^/]+\/[^/]+)/)
    if (match) return `https://www.modelscope.cn/models/${match[1]}`
  }

  if (host === 'github.com') {
    const parts = path.split('/').filter(Boolean)
    if (parts.length >= 2) return `https://github.com/${parts[0]}/${parts[1]}`
  }

  if (host === 'civitai.com' || host === 'civitai.red') {
    const model = path.match(/^\/models\/(\d+)/)
    if (model) return `${parsed.origin}/models/${model[1]}`
  }

  return ''
}

export function repoLinkLabel(url: string): string {
  const parsed = parseHttpUrl(url)
  if (!parsed) return 'Repository'
  const host = parsed.host.replace(/^www\./, '')
  const parts = parsed.path.split('/').filter(Boolean)
  if (host === 'huggingface.co' && parts.length >= 2) return `Hugging Face:${parts[0]}/${parts[1]}`
  if (host === 'modelscope.cn' && parts[0] === 'models' && parts.length >= 3) {
    return `ModelScope:${parts[1]}/${parts[2]}`
  }
  if (host === 'github.com' && parts.length >= 2) return `GitHub:${parts[0]}/${parts[1]}`
  return parsed.host
}

export function isHttpUrl(url: string): boolean {
  return parseHttpUrl(url) !== null
}
