export function normalizeTemplateSearchQuery(raw: string): string {
  let q = raw.toLowerCase().trim()
  if (!q) return ''
  const slash = q.lastIndexOf('/')
  if (slash >= 0) q = q.slice(slash + 1)
  if (q.endsWith('.json')) q = q.slice(0, -5)
  return q
}

export function templateMatchesSearch(
  template: { name?: string; title?: string; description?: string },
  rawQuery: string
): boolean {
  const q = normalizeTemplateSearchQuery(rawQuery)
  if (!q) return true
  const name = String(template.name || '').toLowerCase()
  const title = String(template.title || '').toLowerCase()
  const description = String(template.description || '').toLowerCase()
  return name.includes(q) || title.includes(q) || description.includes(q)
}
