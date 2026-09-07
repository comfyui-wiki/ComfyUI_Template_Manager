/** Canonical template field is minComfyUIVersion. Older admin writes used comfyuiVersion. */

export function readMinComfyUIVersion(template: Record<string, unknown> | null | undefined): string {
  if (!template) return ''
  const current = typeof template.minComfyUIVersion === 'string' ? template.minComfyUIVersion.trim() : ''
  if (current) return current
  const legacy = typeof template.comfyuiVersion === 'string' ? template.comfyuiVersion.trim() : ''
  return legacy
}

export function applyMinComfyUIVersion<T extends Record<string, unknown>>(
  template: T,
  version: string | undefined | null
): T {
  const trimmed = version?.trim() || ''
  if (trimmed) {
    ;(template as Record<string, unknown>).minComfyUIVersion = trimmed
  } else {
    delete (template as Record<string, unknown>).minComfyUIVersion
  }
  delete (template as Record<string, unknown>).comfyuiVersion
  return template
}
