export type ExportedModelLink = {
  model_name: string
  url: string
  directory: string
}

function filenameFromUrl(url: string): string {
  const path = url.split('?')[0].split('#')[0]
  try {
    return decodeURIComponent(path.split('/').pop() || '')
  } catch {
    return path.split('/').pop() || ''
  }
}

function workflowNodes(workflow: unknown): unknown[] {
  if (!workflow || typeof workflow !== 'object') return []
  const record = workflow as { nodes?: unknown; definitions?: { subgraphs?: unknown } }
  const nodes: unknown[] = []
  if (Array.isArray(record.nodes)) nodes.push(...record.nodes)
  const subgraphs = record.definitions?.subgraphs
  if (Array.isArray(subgraphs)) {
    for (const subgraph of subgraphs) {
      if (subgraph && typeof subgraph === 'object' && Array.isArray((subgraph as { nodes?: unknown }).nodes)) {
        nodes.push(...(subgraph as { nodes: unknown[] }).nodes)
      }
    }
  }
  return nodes
}

/** Unique download links from workflow `properties.models`, in first-seen order. */
export function exportModelLinks(workflow: unknown): ExportedModelLink[] {
  const seen = new Set<string>()
  const models: ExportedModelLink[] = []

  for (const node of workflowNodes(workflow)) {
    if (!node || typeof node !== 'object') continue
    const list = (node as { properties?: { models?: unknown } }).properties?.models
    if (!Array.isArray(list)) continue

    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const rawUrl = (item as { url?: unknown }).url
      const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue
      seen.add(url)

      const rawName = (item as { name?: unknown }).name
      const name = typeof rawName === 'string' ? rawName.trim() : ''
      const rawDirectory = (item as { directory?: unknown }).directory
      const directory = typeof rawDirectory === 'string' ? rawDirectory.trim() : ''
      models.push({
        model_name: name || filenameFromUrl(url),
        url,
        directory
      })
    }
  }

  return models
}

export function formatModelLinksJson(models: ExportedModelLink[]): string {
  return JSON.stringify({ models }, null, 2)
}
