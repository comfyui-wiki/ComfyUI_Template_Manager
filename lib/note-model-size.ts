const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
const SIZE_AFTER = /^\s+\(\s*\d+(?:\.\d+)?\s*(?:GB|MB|KB|B)\s*\)/i
const MODEL_FILE = /\.(?:safetensors|sft|ckpt|pt|pth|bin|gguf)(?:$|[?#])/i
const NOTE_TYPES = new Set(['MarkdownNote', 'Note'])

export type MissingModelLink = {
  label: string
  url: string
}

export type NoteSizeGap = {
  nodeId: string
  missing: MissingModelLink[]
}

function fileTarget(value: string): string {
  return value.split(/[?#]/)[0]
}

export function isModelDownloadLink(label: string, url: string): boolean {
  return MODEL_FILE.test(fileTarget(label)) || MODEL_FILE.test(fileTarget(url))
}

export function findMissingModelSizes(markdown: string): MissingModelLink[] {
  const missing: MissingModelLink[] = []
  const seen = new Set<string>()
  for (const match of markdown.matchAll(LINK_RE)) {
    const label = match[1]
    const url = match[2]
    const offset = match.index ?? 0
    if (!isModelDownloadLink(label, url) || seen.has(url)) continue
    const after = markdown.slice(offset + match[0].length)
    if (SIZE_AFTER.test(after)) continue
    seen.add(url)
    missing.push({ label, url })
  }
  return missing
}

/** Append a size after model download links that do not already have one. */
export function applyModelSizeLabels(markdown: string, labels: Record<string, string>): { text: string, applied: number } {
  let applied = 0
  const text = markdown.replace(LINK_RE, (full, label: string, url: string, offset: number) => {
    if (!isModelDownloadLink(label, url)) return full
    const size = labels[url]
    if (!size) return full
    const after = markdown.slice(offset + full.length)
    if (SIZE_AFTER.test(after)) return full
    applied += 1
    return `${full} (${size})`
  })
  return { text, applied }
}

function workflowNodes(workflow: unknown): unknown[] {
  if (!workflow || typeof workflow !== 'object') return []
  const record = workflow as { nodes?: unknown, definitions?: { subgraphs?: unknown } }
  const nodes: unknown[] = []
  if (Array.isArray(record.nodes)) nodes.push(...record.nodes)
  if (Array.isArray(record.definitions?.subgraphs)) {
    for (const subgraph of record.definitions.subgraphs) {
      if (subgraph && typeof subgraph === 'object' && Array.isArray((subgraph as { nodes?: unknown }).nodes)) {
        nodes.push(...(subgraph as { nodes: unknown[] }).nodes)
      }
    }
  }
  return nodes
}

function noteBodies(node: { widgets_values?: unknown, widgets_values_named?: { text?: unknown } }): string[] {
  const found: string[] = []
  const push = (value: unknown) => {
    if (typeof value !== 'string' || !value.includes('](http') || found.includes(value)) return
    found.push(value)
  }
  if (Array.isArray(node.widgets_values)) {
    for (const value of node.widgets_values) push(value)
  }
  push(node.widgets_values_named?.text)
  return found
}

export function findNoteSizeGaps(workflow: unknown): NoteSizeGap[] {
  const gaps: NoteSizeGap[] = []
  for (const node of workflowNodes(workflow)) {
    if (!node || typeof node !== 'object') continue
    const record = node as { id?: unknown, type?: unknown, widgets_values?: unknown, widgets_values_named?: { text?: unknown } }
    if (!NOTE_TYPES.has(String(record.type || ''))) continue
    const missing: MissingModelLink[] = []
    const seen = new Set<string>()
    for (const body of noteBodies(record)) {
      for (const link of findMissingModelSizes(body)) {
        if (seen.has(link.url)) continue
        seen.add(link.url)
        missing.push(link)
      }
    }
    if (!missing.length) continue
    gaps.push({
      nodeId: record.id == null ? 'unknown' : String(record.id),
      missing
    })
  }
  return gaps
}

/** Unique note strings that still need a size, so a raw file replace can update every copy. */
export function noteTextsNeedingSizes(workflow: unknown): string[] {
  const texts: string[] = []
  for (const node of workflowNodes(workflow)) {
    if (!node || typeof node !== 'object') continue
    const record = node as { type?: unknown, widgets_values?: unknown, widgets_values_named?: { text?: unknown } }
    if (!NOTE_TYPES.has(String(record.type || ''))) continue
    for (const body of noteBodies(record)) {
      if (findMissingModelSizes(body).length && !texts.includes(body)) texts.push(body)
    }
  }
  return texts
}

export function fileSizeFromHeaderDump(raw: string): number | null {
  const linked = raw.match(/^x-linked-size:\s*(\d+)\s*$/im)
  if (linked) {
    const bytes = Number(linked[1])
    if (bytes > 0) return bytes
  }

  const blocks = raw.split(/(?=^HTTP\/\d)/im).filter(block => /HTTP\/\d/i.test(block))
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index]
    const type = (block.match(/^content-type:\s*(.+)$/im)?.[1] || '').toLowerCase()
    if (type.includes('text/html') || type.includes('text/plain')) continue
    const length = Number(block.match(/^content-length:\s*(\d+)/im)?.[1])
    if (Number.isFinite(length) && length > 0) return length
  }
  return null
}
