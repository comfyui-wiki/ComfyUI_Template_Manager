/** Normalize stored ComfyUI base URL (no trailing slash). */
export function normalizeLocalComfyBaseUrl(raw: string): string {
  let url = raw.trim()
  while (url.endsWith('/')) {
    url = url.slice(0, -1)
  }
  return url
}

/**
 * Build a ComfyUI URL that auto-loads a workflow template.
 * ComfyUI expects `/?template=name` (slash before query), not `?template=name`.
 */
export function buildLocalComfyTemplateUrl(baseUrl: string, templateName: string): string {
  const base = normalizeLocalComfyBaseUrl(baseUrl)
  if (!base || !templateName) return ''
  return `${base}/?template=${encodeURIComponent(templateName)}`
}

export function getLocalComfyBaseUrl(): string {
  if (!import.meta.client) return 'http://127.0.0.1:8188'
  const saved = localStorage.getItem('comfyui_local_base_url')?.trim()
  return normalizeLocalComfyBaseUrl(saved || 'http://127.0.0.1:8188')
}
