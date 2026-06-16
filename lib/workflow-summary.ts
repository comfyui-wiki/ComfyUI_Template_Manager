/**
 * Extract unified workflow context from ComfyUI workflow JSON.
 *
 * Priority: MarkdownNote content first, then factual IO/parameters. No invented narrative.
 */

const INPUT_IMAGE_TYPES = new Set(['LoadImage', 'LoadImageOutput', 'LoadImageSetFromFolderNode'])
const INPUT_MASK_TYPES = new Set(['LoadImageMask'])
const INPUT_VIDEO_TYPES = new Set(['LoadVideo', 'VHS_LoadVideo'])
const INPUT_AUDIO_TYPES = new Set(['LoadAudio'])
const INPUT_3D_TYPES = new Set(['Load3D'])

const OUTPUT_IMAGE_TYPES = new Set(['SaveImage', 'PreviewImage', 'SaveSVGNode', 'SaveAnimatedWEBP', 'SaveAnimatedPNG'])
const OUTPUT_VIDEO_TYPES = new Set(['SaveVideo', 'VHS_VideoCombine'])
const OUTPUT_AUDIO_TYPES = new Set(['SaveAudio', 'SaveAudioMP3', 'PreviewAudio'])
const OUTPUT_3D_TYPES = new Set(['Save3DModel', 'Preview3D'])
const OUTPUT_COMPARE_TYPES = new Set(['ImageCompare'])

const MARKDOWN_NOTE_TYPE = 'MarkdownNote'
const NOTE_NODE_TYPES = new Set(['Note', 'MarkdownNote', 'StickyNote', 'NoteNode', 'TextNode'])
const TEXT_INPUT_NODE_TYPES = new Set(['CLIPTextEncode', 'CLIPTextEncodeSDXL', 'TextEncodeQwenImage', 'TextEncodeAceStepAudio'])

/** Utility nodes hidden from flow unless they have a custom title */
const UTILITY_NODE_TYPES = new Set([
  'GetImageSize', 'ResizeImageMaskNode', 'Reroute', 'PreviewAny', 'RegexExtract',
  'StringReplace', 'Int', 'ShowText|pysssss', 'ShowText', 'PrimitiveNode'
])

const PIPELINE_NODE_RE = /loader|sampler|encode|decode|inference|render|model|vae|clip|lora|controlnet|upscale|checkpoint|unet|bernini|da3|diffusion|combine|save|preview/i
const UUID_TYPE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isPipelineNode(node: WorkflowNode): boolean {
  const type = getNodeType(node)
  if (NOTE_NODE_TYPES.has(type)) return false
  if (UTILITY_NODE_TYPES.has(type)) return false
  if (PIPELINE_NODE_RE.test(type)) return true
  if (PIPELINE_NODE_RE.test(node.title || '')) return true
  if (isUuidType(type) && node.title?.trim()) return true
  return false
}

export interface WorkflowIoCounts {
  inputImages: number
  inputMasks: number
  inputVideos: number
  inputAudio: number
  input3d: number
  textPrompts: number
  outputImages: number
  outputVideos: number
  outputAudio: number
  output3d: number
  outputComparisons: number
}

export interface WorkflowParameter {
  node: string
  settings: Record<string, string | number | boolean>
}

export interface WorkflowNoteEntry {
  title: string
  content: string
  kind: 'markdown_note'
}

export interface WorkflowNodeSummary {
  label: string
  type: string
  role?: 'input' | 'output' | 'processing' | 'note'
  detail?: string
}

export interface WorkflowSummaryStructured {
  purpose: string
  io: WorkflowIoCounts
  ioSummary: string
  useCases: string[]
  parameters: WorkflowParameter[]
  subgraphs: string[]
  notes: WorkflowNoteEntry[]
  mainNodes: WorkflowNodeSummary[]
  pipelineSteps: WorkflowNodeSummary[]
  models: string[]
  techniques: string[]
}

export interface WorkflowSummary {
  text: string
  structured: WorkflowSummaryStructured
  estimatedTokens: number
  originalSizeBytes: number
  nodeCount: number
  nodeTypes: string[]
  models: string[]
  customNodes: string[]
}

interface WorkflowNode {
  id?: number | string
  type?: string
  class_type?: string
  order?: number
  widgets_values?: unknown
  properties?: Record<string, unknown>
  title?: string
}

interface SubgraphDef {
  id?: string
  name?: string
  nodes?: WorkflowNode[]
  groups?: { title?: string }[]
}

function isUuidType(type: string): boolean {
  return UUID_TYPE_RE.test(type)
}

function getNodeType(node: WorkflowNode): string {
  return node.type || node.class_type || 'Unknown'
}

function getNodeLabel(node: WorkflowNode): string {
  const type = getNodeType(node)
  const title = typeof node.title === 'string' ? node.title.trim() : ''
  if (title && title !== type) return title
  if (!isUuidType(type)) return humanizeType(type)
  return title || type
}

function humanizeType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function collectMainNodes(workflow: Record<string, unknown>): WorkflowNode[] {
  if (!Array.isArray(workflow.nodes)) return []
  return [...(workflow.nodes as WorkflowNode[])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  )
}

function collectSubgraphs(workflow: Record<string, unknown>): SubgraphDef[] {
  const defs = workflow.definitions as { subgraphs?: SubgraphDef[] } | undefined
  return defs?.subgraphs ?? []
}

function collectSubgraphNodes(subgraphs: SubgraphDef[]): WorkflowNode[] {
  const nodes: WorkflowNode[] = []
  for (const sg of subgraphs) {
    if (Array.isArray(sg.nodes)) {
      nodes.push(...[...sg.nodes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    }
  }
  return nodes
}

function readWidgetText(wv: unknown): string | null {
  if (typeof wv === 'string' && wv.trim()) return wv.trim()
  if (Array.isArray(wv)) {
    const parts = wv
      .filter(v => typeof v === 'string' && v.trim())
      .map(v => (v as string).trim())
    if (parts.length > 0) return parts.join('\n')
  }
  if (wv && typeof wv === 'object' && !Array.isArray(wv)) {
    const obj = wv as Record<string, unknown>
    for (const key of ['text', 'content', 'markdown', 'value']) {
      if (typeof obj[key] === 'string' && (obj[key] as string).trim()) {
        return (obj[key] as string).trim()
      }
    }
  }
  return null
}

function isModelLinksNote(title: string, content: string): boolean {
  const t = title.toLowerCase()
  if (t.includes('model link')) return true
  if (/^guide:\s*\[subgraph\]/i.test(content.trim())) return true
  if (content.includes('## Model Links')) return true
  return false
}

function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractLeadParagraph(content: string, maxLen = 400): string {
  const plain = stripMarkdown(content)

  const whatIs = plain.match(/what is this workflow\??\s*([\s\S]*?)(?=\n(?:#{1,3}\s|---|\Z))/i)
  if (whatIs) {
    const block = whatIs[1].trim().split(/\n\n+/)[0]
    if (block.length > 30) {
      return block.length <= maxLen ? block : block.slice(0, maxLen - 1).trim() + '…'
    }
  }

  const builtFor = plain.match(/built for\s+([^.!\n]+[.!]?)/i)
  if (builtFor) {
    const s = `Built for ${builtFor[1].trim()}`
    return s.length <= maxLen ? s : s.slice(0, maxLen - 1).trim() + '…'
  }

  const sections = plain.split(/\n\n+/).map(s => s.trim()).filter(Boolean)
  const meaningful = sections.find(s =>
    s.length > 40 &&
    !/^official repos/i.test(s) &&
    !s.toLowerCase().startsWith('guide:') &&
    !s.startsWith('• ')
  ) || sections[0] || plain

  return meaningful.length <= maxLen ? meaningful : meaningful.slice(0, maxLen - 1).trim() + '…'
}

function collectMarkdownNotes(mainNodes: WorkflowNode[], subgraphNodes: WorkflowNode[]): WorkflowNoteEntry[] {
  const notes: WorkflowNoteEntry[] = []
  const seen = new Set<string>()

  for (const node of [...mainNodes, ...subgraphNodes]) {
    if (getNodeType(node) !== MARKDOWN_NOTE_TYPE) continue
    const content = readWidgetText(node.widgets_values)
    if (!content) continue

    const entry: WorkflowNoteEntry = {
      title: node.title?.trim() || 'Note',
      content,
      kind: 'markdown_note'
    }
    const key = `${entry.title}:${entry.content.slice(0, 80)}`
    if (seen.has(key)) continue
    seen.add(key)
    notes.push(entry)
  }

  return notes
}

function pickGuideNotes(notes: WorkflowNoteEntry[]): WorkflowNoteEntry[] {
  return notes.filter(n => !isModelLinksNote(n.title, n.content))
}

function extractModelsFromNode(node: WorkflowNode): string[] {
  const found: string[] = []
  const props = node.properties
  if (props?.models && Array.isArray(props.models)) {
    for (const m of props.models) {
      if (m && typeof m === 'object' && typeof (m as { name?: string }).name === 'string') {
        found.push((m as { name: string }).name)
      }
    }
  }
  const type = getNodeType(node)
  if (/^Load.*Model$/i.test(type) || /Loader$/i.test(type)) {
    const wv = node.widgets_values
    if (Array.isArray(wv) && wv.length > 0 && typeof wv[0] === 'string' && wv[0]) {
      const name = wv[0].split(/[/\\]/).pop() || wv[0]
      if (!found.includes(name)) found.push(name)
    }
  }
  return found
}

function countIoOnMainCanvas(mainNodes: WorkflowNode[]): WorkflowIoCounts {
  const counts: WorkflowIoCounts = {
    inputImages: 0, inputMasks: 0, inputVideos: 0, inputAudio: 0, input3d: 0,
    textPrompts: 0, outputImages: 0, outputVideos: 0, outputAudio: 0, output3d: 0,
    outputComparisons: 0
  }
  for (const node of mainNodes) {
    const type = getNodeType(node)
    if (NOTE_NODE_TYPES.has(type)) continue
    if (INPUT_IMAGE_TYPES.has(type)) counts.inputImages++
    else if (INPUT_MASK_TYPES.has(type)) counts.inputMasks++
    else if (INPUT_VIDEO_TYPES.has(type)) counts.inputVideos++
    else if (INPUT_AUDIO_TYPES.has(type)) counts.inputAudio++
    else if (INPUT_3D_TYPES.has(type)) counts.input3d++
    else if (TEXT_INPUT_NODE_TYPES.has(type)) counts.textPrompts++
    else if (OUTPUT_IMAGE_TYPES.has(type)) counts.outputImages++
    else if (OUTPUT_VIDEO_TYPES.has(type)) counts.outputVideos++
    else if (OUTPUT_AUDIO_TYPES.has(type)) counts.outputAudio++
    else if (OUTPUT_3D_TYPES.has(type)) counts.output3d++
    else if (OUTPUT_COMPARE_TYPES.has(type)) counts.outputComparisons++
  }
  return counts
}

function formatIoSummary(io: WorkflowIoCounts): string {
  const inputs: string[] = []
  const outputs: string[] = []
  if (io.inputImages > 0) inputs.push(`${io.inputImages} image${io.inputImages > 1 ? 's' : ''}`)
  if (io.inputMasks > 0) inputs.push(`${io.inputMasks} mask${io.inputMasks > 1 ? 's' : ''}`)
  if (io.inputVideos > 0) inputs.push(`${io.inputVideos} video${io.inputVideos > 1 ? 's' : ''}`)
  if (io.inputAudio > 0) inputs.push(`${io.inputAudio} audio`)
  if (io.input3d > 0) inputs.push(`${io.input3d} 3D file${io.input3d > 1 ? 's' : ''}`)
  if (io.textPrompts > 0) inputs.push(`${io.textPrompts} text prompt${io.textPrompts > 1 ? 's' : ''}`)
  if (io.outputImages > 0) outputs.push(`${io.outputImages} image output${io.outputImages > 1 ? 's' : ''}`)
  if (io.outputVideos > 0) outputs.push(`${io.outputVideos} video output${io.outputVideos > 1 ? 's' : ''}`)
  if (io.outputComparisons > 0) outputs.push(`${io.outputComparisons} comparison view${io.outputComparisons > 1 ? 's' : ''}`)
  return `${inputs.length ? inputs.join(' + ') : 'no file inputs'} → ${outputs.length ? outputs.join(' + ') : 'no explicit outputs'}`
}

function extractKeyParameters(nodes: WorkflowNode[]): WorkflowParameter[] {
  const params: WorkflowParameter[] = []
  const EXTRACTORS: Record<string, (wv: unknown[], label: string) => WorkflowParameter | null> = {
    KSampler: (wv, label) => wv.length >= 7 ? {
      node: label, settings: { steps: wv[2] as number, cfg: wv[3] as number, sampler: String(wv[4]) }
    } : null,
    DA3Inference: (wv, label) => ({
      node: label, settings: { resolution: wv[0] as number, resize_method: String(wv[1]), mode: String(wv[2]) }
    }),
    DA3Render: (wv, label) => ({
      node: label, settings: { output: String(wv[0]), normalization: String(wv[1]) }
    }),
    LoadDA3Model: (wv, label) => ({ node: label, settings: { model: String(wv[0]) } }),
    CheckpointLoaderSimple: (wv, label) => ({ node: label, settings: { checkpoint: String(wv[0]) } }),
    UNETLoader: (wv, label) => ({ node: label, settings: { unet: String(wv[0]) } }),
    LoraLoader: (wv, label) => ({ node: label, settings: { lora: String(wv[0]), strength: wv[1] as number } }),
    EmptyLatentImage: (wv, label) => ({ node: label, settings: { width: wv[0] as number, height: wv[1] as number } })
  }
  for (const node of nodes) {
    const type = getNodeType(node)
    const fn = EXTRACTORS[type]
    if (!fn) continue
    const wv = node.widgets_values
    if (!Array.isArray(wv) || !wv.length) continue
    const entry = fn(wv, getNodeLabel(node))
    if (entry) params.push(entry)
  }
  return params
}

function inferPurpose(guideNotes: WorkflowNoteEntry[]): string {
  if (guideNotes.length === 0) return 'Workflow template'

  const primary = guideNotes.find(n => /guide|workflow|what is|about/i.test(n.title)) || guideNotes[0]
  if (primary.title && primary.title !== 'Note') return primary.title
  return extractLeadParagraph(primary.content, 120)
}

function inferTechniquesFromFacts(
  purpose: string,
  subgraphNames: string[],
  mainNodeTypes: string[],
  guideText: string
): string[] {
  const corpus = [purpose, ...subgraphNames, ...mainNodeTypes, guideText.slice(0, 500)].join(' ').toLowerCase()
  const rules: [RegExp, string][] = [
    [/depth|da3|depth anything/i, 'Depth estimation'],
    [/bernini|image edit/i, 'Image editing'],
    [/text.?to.?image|t2i/i, 'Text-to-Image'],
    [/image.?to.?video|i2v/i, 'Image-to-Video'],
    [/image.?to.?image|i2i/i, 'Image-to-Image'],
    [/controlnet/i, 'ControlNet'],
    [/upscale/i, 'Upscaling'],
    [/inpaint/i, 'Inpainting']
  ]
  const hints: string[] = []
  for (const [re, label] of rules) {
    if (re.test(corpus)) hints.push(label)
  }
  return hints
}

function inferUseCasesFromNotes(guideNotes: WorkflowNoteEntry[], purpose: string, techniques: string[]): string[] {
  const cases: string[] = []
  for (const note of guideNotes) {
    const plain = stripMarkdown(note.content)
    const useFor = plain.match(/(?:ideal for|use for|used for|suitable for|built for)\s+([^.!\n]+)/i)
    if (useFor) cases.push(useFor[1].trim())
    const whatIs = plain.match(/what is this workflow\?\s*\n+([^.\n]+)/i)
    if (whatIs) cases.push(whatIs[1].trim())
  }
  if (cases.length === 0 && /depth/i.test(purpose + techniques.join(' '))) {
    cases.push('3D scene reconstruction', 'VFX depth passes', 'AR asset preparation')
  }
  if (cases.length === 0 && /bernini|image edit/i.test(purpose)) {
    cases.push('AI image editing', 'prompt-guided image transformation')
  }
  return [...new Set(cases.map(c => c.replace(/^built for\s+/i, '').trim()))].slice(0, 4)
}

function inferNodeRole(node: WorkflowNode): WorkflowNodeSummary['role'] {
  const type = getNodeType(node)
  if (NOTE_NODE_TYPES.has(type)) return 'note'
  if (INPUT_IMAGE_TYPES.has(type) || INPUT_MASK_TYPES.has(type) ||
      INPUT_VIDEO_TYPES.has(type) || INPUT_AUDIO_TYPES.has(type) || INPUT_3D_TYPES.has(type)) return 'input'
  if (OUTPUT_IMAGE_TYPES.has(type) || OUTPUT_VIDEO_TYPES.has(type) ||
      OUTPUT_AUDIO_TYPES.has(type) || OUTPUT_3D_TYPES.has(type) || OUTPUT_COMPARE_TYPES.has(type)) return 'output'
  if (TEXT_INPUT_NODE_TYPES.has(type)) return 'input'
  return 'processing'
}

function isFlowVisibleNode(node: WorkflowNode): boolean {
  const type = getNodeType(node)
  if (NOTE_NODE_TYPES.has(type)) return false
  if (UTILITY_NODE_TYPES.has(type)) return false
  const title = node.title?.trim()
  if (title && title !== type) return true
  if (INPUT_IMAGE_TYPES.has(type) || OUTPUT_IMAGE_TYPES.has(type) ||
      OUTPUT_COMPARE_TYPES.has(type) || INPUT_VIDEO_TYPES.has(type) ||
      OUTPUT_VIDEO_TYPES.has(type) || TEXT_INPUT_NODE_TYPES.has(type)) return true
  if (isUuidType(type) && title) return true
  if (type.includes('Batch') || type.includes('Subgraph')) return true
  return false
}

function summarizeMainFlow(mainNodesRaw: WorkflowNode[]): WorkflowNodeSummary[] {
  return mainNodesRaw
    .filter(isFlowVisibleNode)
    .map(node => ({
      label: getNodeLabel(node),
      type: getNodeType(node),
      role: inferNodeRole(node)
    }))
}

function summarizePipeline(subgraphNodes: WorkflowNode[]): WorkflowNodeSummary[] {
  const seen = new Set<string>()
  const steps: WorkflowNodeSummary[] = []
  for (const node of subgraphNodes) {
    if (!isPipelineNode(node)) continue
    const label = getNodeLabel(node)
    if (seen.has(label)) continue
    seen.add(label)
    steps.push({ label, type: getNodeType(node), role: inferNodeRole(node) })
  }
  return steps
}

function formatParameterInline(p: WorkflowParameter): string {
  return `${p.node} (${Object.entries(p.settings).map(([k, v]) => `${k}=${v}`).join(', ')})`
}

function buildUnifiedText(
  purpose: string,
  guideNotes: WorkflowNoteEntry[],
  useCases: string[],
  techniques: string[],
  models: string[],
  io: WorkflowIoCounts,
  ioSummary: string,
  mainFlow: WorkflowNodeSummary[],
  pipelineSteps: WorkflowNodeSummary[],
  parameters: WorkflowParameter[]
): string {
  const parts: string[] = []

  // 1. Overview from MarkdownNote (front)
  parts.push(purpose)

  const primary = guideNotes[0]
  if (primary) {
    parts.push(extractLeadParagraph(primary.content, 500))
  }

  // 2. Other MarkdownNote content
  const otherGuide = guideNotes.slice(1)
  const noteBlocks: string[] = []
  const seenNoteText = new Set<string>()

  for (const n of otherGuide) {
    const block = `[${n.title}]\n${extractLeadParagraph(n.content, 350)}`
    if (!seenNoteText.has(block)) { seenNoteText.add(block); noteBlocks.push(block) }
  }

  if (noteBlocks.length > 0) {
    parts.push('Author notes:\n' + noteBlocks.join('\n\n'))
  }

  // 3. Use cases
  if (useCases.length > 0) {
    parts.push(`Use cases: ${useCases.join('; ')}.`)
  } else if (techniques.length > 0) {
    parts.push(`Techniques: ${techniques.join(', ')}.`)
  }

  // 4. Technical details (back)
  const tech: string[] = ['--- Technical Details ---']
  tech.push(`Inputs/Outputs: ${ioSummary}`)
  const counts: string[] = []
  if (io.inputImages) counts.push(`${io.inputImages} input image(s)`)
  if (io.inputMasks) counts.push(`${io.inputMasks} mask(s)`)
  if (io.inputVideos) counts.push(`${io.inputVideos} input video(s)`)
  if (io.textPrompts) counts.push(`${io.textPrompts} text prompt(s)`)
  if (io.outputImages) counts.push(`${io.outputImages} image output(s)`)
  if (io.outputVideos) counts.push(`${io.outputVideos} video output(s)`)
  if (io.outputComparisons) counts.push(`${io.outputComparisons} comparison view(s)`)
  if (counts.length) tech.push(`Counts: ${counts.join(', ')}`)

  if (mainFlow.length) {
    tech.push(`Main flow: ${mainFlow.map(n => n.label).join(' → ')}`)
  }
  if (pipelineSteps.length) {
    tech.push(`Pipeline: ${pipelineSteps.map(n => n.label).join(' → ')}`)
  }
  if (models.length) tech.push(`Models: ${models.slice(0, 6).join(', ')}`)
  if (parameters.length) tech.push(`Parameters: ${parameters.slice(0, 6).map(formatParameterInline).join('; ')}`)

  parts.push(tech.join('\n'))
  return parts.join('\n\n')
}

export function extractWorkflowSummary(workflowJson: string, maxChars = 6000): WorkflowSummary | null {
  if (!workflowJson?.trim()) return null

  const originalSizeBytes = new TextEncoder().encode(workflowJson).length
  let workflow: Record<string, unknown>
  try {
    workflow = JSON.parse(workflowJson)
  } catch {
    return null
  }

  const mainNodesRaw = collectMainNodes(workflow)
  const subgraphs = collectSubgraphs(workflow)
  const subgraphNodes = collectSubgraphNodes(subgraphs)
  const allNodes = [...mainNodesRaw, ...subgraphNodes]
  if (!allNodes.length) return null

  const markdownNotes = collectMarkdownNotes(mainNodesRaw, subgraphNodes)
  const guideNotes = pickGuideNotes(markdownNotes)

  const models = new Set<string>()
  const nodeTypeCounts = new Map<string, number>()
  const customNodes = new Set<string>()

  for (const node of allNodes) {
    const type = getNodeType(node)
    nodeTypeCounts.set(type, (nodeTypeCounts.get(type) || 0) + 1)
    for (const m of extractModelsFromNode(node)) models.add(m)
    const cnrId = node.properties?.cnr_id
    if (typeof cnrId === 'string' && cnrId && cnrId !== 'comfy-core') customNodes.add(cnrId)
  }

  const io = countIoOnMainCanvas(mainNodesRaw)
  const ioSummary = formatIoSummary(io)
  const parameters = extractKeyParameters(allNodes)
  const subgraphNames = subgraphs.map(sg => sg.name?.trim()).filter(Boolean) as string[]
  const mainFlow = summarizeMainFlow(mainNodesRaw)
  const pipelineSteps = summarizePipeline(subgraphNodes)
  const mainNodeTypes = mainFlow.map(n => n.type)

  const guideText = guideNotes.map(n => n.content).join('\n')
  const purpose = inferPurpose(guideNotes)
  const techniques = inferTechniquesFromFacts(purpose, subgraphNames, mainNodeTypes, guideText)
  const useCases = inferUseCasesFromNotes(guideNotes, purpose, techniques)
  const modelList = [...models]

  let text = buildUnifiedText(
    purpose, guideNotes, useCases, techniques, modelList,
    io, ioSummary, mainFlow, pipelineSteps, parameters
  )
  if (text.length > maxChars) text = text.slice(0, maxChars - 3) + '...'

  return {
    text,
    structured: {
      purpose,
      io,
      ioSummary,
      useCases,
      parameters,
      subgraphs: subgraphNames,
      notes: markdownNotes,
      mainNodes: mainFlow,
      pipelineSteps,
      models: modelList,
      techniques
    },
    estimatedTokens: Math.ceil(text.length / 4),
    originalSizeBytes,
    nodeCount: allNodes.length,
    nodeTypes: [...nodeTypeCounts.keys()].sort(),
    models: modelList,
    customNodes: [...customNodes]
  }
}

export function formatWorkflowSummaryForUI(summary: WorkflowSummary): string {
  const origKB = (summary.originalSizeBytes / 1024).toFixed(1)
  return [`[Workflow Context — ~${summary.estimatedTokens} tokens, from ${origKB} KB JSON]`, summary.text].join('\n')
}
