/**
 * Extract unified workflow context from ComfyUI workflow JSON.
 *
 * One format serves both humans (review in UI) and AI (prompt context):
 * IO counts, purpose, key parameters, node titles, notes, and pipeline.
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

const NOTE_NODE_TYPES = new Set(['Note', 'MarkdownNote', 'StickyNote', 'NoteNode', 'TextNode'])
const TEXT_INPUT_NODE_TYPES = new Set(['CLIPTextEncode', 'CLIPTextEncodeSDXL', 'TextEncodeQwenImage', 'TextEncodeAceStepAudio'])

const UUID_TYPE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  /** Practical application scenarios inferred from workflow capabilities */
  useCases: string[]
  parameters: WorkflowParameter[]
  subgraphs: string[]
  groups: string[]
  notes: string[]
  mainNodes: WorkflowNodeSummary[]
  pipelineSteps: WorkflowNodeSummary[]
  models: string[]
  techniques: string[]
}

export interface WorkflowSummary {
  /** Unified context — same text for UI display and AI prompts */
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
  widgets_values?: unknown
  properties?: Record<string, unknown>
  title?: string
  inputs?: { name?: string; widget?: { name?: string } }[]
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
  if (!isUuidType(type)) return type
  return title || type
}

function collectMainNodes(workflow: Record<string, unknown>): WorkflowNode[] {
  if (Array.isArray(workflow.nodes)) return workflow.nodes as WorkflowNode[]
  return []
}

function collectSubgraphs(workflow: Record<string, unknown>): SubgraphDef[] {
  const defs = workflow.definitions as { subgraphs?: SubgraphDef[] } | undefined
  return defs?.subgraphs ?? []
}

function collectGroupTitles(workflow: Record<string, unknown>, subgraphs: SubgraphDef[]): string[] {
  const titles = new Set<string>()
  const groups = workflow.groups as { title?: string }[] | undefined
  if (Array.isArray(groups)) {
    for (const g of groups) {
      if (g.title?.trim()) titles.add(g.title.trim())
    }
  }
  for (const sg of subgraphs) {
    if (Array.isArray(sg.groups)) {
      for (const g of sg.groups) {
        if (g.title?.trim()) titles.add(g.title.trim())
      }
    }
  }
  return [...titles]
}

function extractNoteText(node: WorkflowNode): string | null {
  const type = getNodeType(node)
  if (!NOTE_NODE_TYPES.has(type)) return null
  const wv = node.widgets_values
  if (typeof wv === 'string' && wv.trim()) return wv.trim()
  if (Array.isArray(wv)) {
    const parts = wv.filter(v => typeof v === 'string' && v.trim()).map(v => (v as string).trim())
    if (parts.length > 0) return parts.join('\n')
  }
  if (node.title?.trim()) return node.title.trim()
  return null
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
  if (/^Load.*Model$/i.test(type) || type.endsWith('Loader')) {
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
    inputImages: 0,
    inputMasks: 0,
    inputVideos: 0,
    inputAudio: 0,
    input3d: 0,
    textPrompts: 0,
    outputImages: 0,
    outputVideos: 0,
    outputAudio: 0,
    output3d: 0,
    outputComparisons: 0
  }

  for (const node of mainNodes) {
    const type = getNodeType(node)
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
  if (io.inputAudio > 0) inputs.push(`${io.inputAudio} audio file${io.inputAudio > 1 ? 's' : ''}`)
  if (io.input3d > 0) inputs.push(`${io.input3d} 3D file${io.input3d > 1 ? 's' : ''}`)
  if (io.textPrompts > 0) inputs.push(`${io.textPrompts} text prompt${io.textPrompts > 1 ? 's' : ''}`)

  if (io.outputImages > 0) outputs.push(`${io.outputImages} image output${io.outputImages > 1 ? 's' : ''}`)
  if (io.outputVideos > 0) outputs.push(`${io.outputVideos} video output${io.outputVideos > 1 ? 's' : ''}`)
  if (io.outputAudio > 0) outputs.push(`${io.outputAudio} audio output${io.outputAudio > 1 ? 's' : ''}`)
  if (io.output3d > 0) outputs.push(`${io.output3d} 3D output${io.output3d > 1 ? 's' : ''}`)
  if (io.outputComparisons > 0) outputs.push(`${io.outputComparisons} comparison view${io.outputComparisons > 1 ? 's' : ''}`)

  const inStr = inputs.length > 0 ? inputs.join(' + ') : 'no file inputs'
  const outStr = outputs.length > 0 ? outputs.join(' + ') : 'no explicit outputs'
  return `${inStr} → ${outStr}`
}

/** Extract user-meaningful parameter settings from node widgets */
function extractKeyParameters(nodes: WorkflowNode[]): WorkflowParameter[] {
  const params: WorkflowParameter[] = []

  const PARAM_EXTRACTORS: Record<string, (wv: unknown[], label: string) => WorkflowParameter | null> = {
    KSampler: (wv, label) => {
      if (wv.length < 7) return null
      return {
        node: label,
        settings: {
          steps: wv[2] as number,
          cfg: wv[3] as number,
          sampler: String(wv[4]),
          scheduler: String(wv[5])
        }
      }
    },
    KSamplerAdvanced: (wv, label) => PARAM_EXTRACTORS.KSampler(wv, label),
    EmptyLatentImage: (wv, label) => ({
      node: label,
      settings: { width: wv[0] as number, height: wv[1] as number }
    }),
    DA3Inference: (wv, label) => ({
      node: label,
      settings: {
        resolution: wv[0] as number,
        resize_method: String(wv[1]),
        mode: String(wv[2])
      }
    }),
    DA3Render: (wv, label) => ({
      node: label,
      settings: {
        output: String(wv[0]),
        normalization: String(wv[1]),
        apply_sky_clip: Boolean(wv[2])
      }
    }),
    LoadDA3Model: (wv, label) => ({
      node: label,
      settings: { model: String(wv[0]) }
    }),
    CheckpointLoaderSimple: (wv, label) => ({
      node: label,
      settings: { checkpoint: String(wv[0]) }
    }),
    UNETLoader: (wv, label) => ({
      node: label,
      settings: { unet: String(wv[0]) }
    }),
    LoraLoader: (wv, label) => ({
      node: label,
      settings: { lora: String(wv[0]), strength: wv[1] as number }
    }),
    ControlNetLoader: (wv, label) => ({
      node: label,
      settings: { controlnet: String(wv[0]) }
    }),
    UpscaleModelLoader: (wv, label) => ({
      node: label,
      settings: { upscale_model: String(wv[0]) }
    })
  }

  for (const node of nodes) {
    const type = getNodeType(node)
    const extractor = PARAM_EXTRACTORS[type]
    if (!extractor) continue
    const wv = node.widgets_values
    if (!Array.isArray(wv) || wv.length === 0) continue
    const label = getNodeLabel(node)
    const entry = extractor(wv, label)
    if (entry) params.push(entry)
  }

  return params
}

function formatParameterLine(p: WorkflowParameter): string {
  const parts = Object.entries(p.settings).map(([k, v]) => `${k}=${v}`)
  return `- ${p.node}: ${parts.join(', ')}`
}

function inferPurpose(
  techniques: string[],
  subgraphNames: string[],
  groups: string[],
  ioSummary: string,
  mainNodes: WorkflowNodeSummary[]
): string {
  if (subgraphNames.length === 1) return subgraphNames[0]
  if (techniques.length > 0) return techniques.join(', ')

  const labels = mainNodes.map(n => n.label).join(' ')
  if (/depth/i.test(labels)) return 'Depth estimation'
  if (/video/i.test(labels)) return 'Video generation or editing'
  if (/portrait|face/i.test(labels)) return 'Portrait processing'

  const groupHint = groups.find(g => !g.startsWith('Subgraph:'))
  if (groupHint) return groupHint

  return ioSummary
}

function inferTechniques(nodeTypes: Set<string>, groups: string[], notes: string[], subgraphNames: string[]): string[] {
  const hints = new Set<string>()
  const corpus = [...nodeTypes, ...groups, ...notes, ...subgraphNames].join(' ').toLowerCase()

  const rules: [RegExp, string][] = [
    [/depth|da3|depthanything/i, 'Depth estimation'],
    [/controlnet|control net/i, 'ControlNet'],
    [/\blora\b/i, 'LoRA'],
    [/upscale/i, 'Upscaling'],
    [/inpaint|mask/i, 'Inpainting'],
    [/image.?to.?video|i2v|flf2v/i, 'Image-to-Video'],
    [/text.?to.?image|t2i|cliptextencode/i, 'Text-to-Image'],
    [/image.?to.?image|i2i/i, 'Image-to-Image'],
    [/compare/i, 'Before/after comparison'],
    [/relight|lighting/i, 'Relighting'],
    [/api|openai|gemini|kling|runway|ideogram/i, 'API / partner model']
  ]

  for (const [pattern, label] of rules) {
    if (pattern.test(corpus)) hints.add(label)
  }
  return [...hints]
}

/** Infer practical use-case scenarios for humans and AI Agents */
function inferUseCases(
  techniques: string[],
  purpose: string,
  io: WorkflowIoCounts,
  groups: string[],
  notes: string[]
): string[] {
  const cases = new Set<string>()
  const corpus = [purpose, ...techniques, ...groups, ...notes].join(' ').toLowerCase()

  const rules: [RegExp, string[]][] = [
    [/depth|da3|depthanything/i, [
      '3D scene reconstruction and spatial layout',
      'AR/VR and game asset preparation',
      'Visual effects and compositing depth passes',
      'Robotics and autonomous navigation research'
    ]],
    [/relight|lighting|light migration/i, [
      'Portrait and product relighting',
      'Consistent lighting across photo sets',
      'E-commerce and catalog photography'
    ]],
    [/portrait|face|headshot/i, [
      'Profile pictures and avatar creation',
      'Social media and personal branding',
      'Character design reference'
    ]],
    [/fashion|editorial|clothing/i, [
      'Fashion lookbooks and editorial shoots',
      'Virtual try-on and outfit visualization',
      'E-commerce apparel presentation'
    ]],
    [/product|mockup|ugc/i, [
      'Product marketing and ad creatives',
      'E-commerce listing images',
      'User-generated content style ads'
    ]],
    [/text.?to.?image|t2i/i, [
      'Concept art and creative exploration',
      'Marketing visuals and social media graphics',
      'Storyboarding and ideation'
    ]],
    [/image.?to.?image|i2i|style transfer|style reference/i, [
      'Style transfer and artistic reinterpretation',
      'Photo editing and visual variation',
      'Brand-consistent image adaptation'
    ]],
    [/image.?to.?video|i2v|flf2v|video/i, [
      'Short-form social video content',
      'Product demo and motion ads',
      'Animation and motion design'
    ]],
    [/controlnet|control net/i, [
      'Precise composition and pose control',
      'Sketch-to-image and layout-guided generation',
      'Architecture and design visualization'
    ]],
    [/inpaint|mask|replacement/i, [
      'Object removal and photo cleanup',
      'Selective editing and content replacement',
      'Background swap and scene editing'
    ]],
    [/upscale/i, [
      'Print-ready high-resolution output',
      'Legacy photo restoration and enhancement',
      'Detail recovery for downstream editing'
    ]],
    [/3d|glb|mesh|save3d/i, [
      '3D asset generation for games and AR',
      'Product visualization and prototyping',
      'Digital twin and spatial design'
    ]],
    [/audio|voice|speech/i, [
      'Voiceover and audio content production',
      'Podcast and video post-production',
      'Multimedia creative workflows'
    ]],
    [/icon|logo|brand/i, [
      'Brand identity and icon design',
      'App and UI asset creation',
      'Marketing collateral'
    ]],
    [/layout|mockup|design/i, [
      'Graphic design and layout mockups',
      'Presentation and pitch materials',
      'Print and digital publishing'
    ]],
    [/compare|before.?after/i, [
      'Quality review and result comparison',
      'A/B visual evaluation',
      'Tutorial and demo presentations'
    ]],
    [/api|openai|gemini|kling|runway|ideogram|flux/i, [
      'Cloud-based generation without local GPU',
      'Rapid prototyping with partner models',
      'Production pipelines using API models'
    ]]
  ]

  for (const [pattern, scenarioList] of rules) {
    if (pattern.test(corpus)) {
      for (const s of scenarioList) cases.add(s)
    }
  }

  // IO-based fallbacks when no technique matched
  if (cases.size === 0) {
    if (io.textPrompts > 0 && io.inputImages === 0) {
      cases.add('Creative generation from text prompts')
    }
    if (io.inputImages > 0 && io.outputImages > 0) {
      cases.add('Image editing and visual transformation')
    }
    if (io.inputImages > 0 && io.outputVideos > 0) {
      cases.add('Motion content from still images')
    }
  }

  return [...cases].slice(0, 6)
}

function inferNodeRole(node: WorkflowNode): WorkflowNodeSummary['role'] {
  const type = getNodeType(node)
  if (NOTE_NODE_TYPES.has(type)) return 'note'
  if (
    INPUT_IMAGE_TYPES.has(type) || INPUT_MASK_TYPES.has(type) ||
    INPUT_VIDEO_TYPES.has(type) || INPUT_AUDIO_TYPES.has(type) || INPUT_3D_TYPES.has(type)
  ) return 'input'
  if (
    OUTPUT_IMAGE_TYPES.has(type) || OUTPUT_VIDEO_TYPES.has(type) ||
    OUTPUT_AUDIO_TYPES.has(type) || OUTPUT_3D_TYPES.has(type) || OUTPUT_COMPARE_TYPES.has(type)
  ) return 'output'
  if (TEXT_INPUT_NODE_TYPES.has(type)) return 'input'
  return 'processing'
}

function extractWidgetDetail(node: WorkflowNode): string | undefined {
  const type = getNodeType(node)
  const wv = node.widgets_values
  if (!Array.isArray(wv) || wv.length === 0) return undefined

  if (INPUT_IMAGE_TYPES.has(type) && typeof wv[0] === 'string' && wv[0]) {
    return `sample: ${wv[0]}`
  }
  if (TEXT_INPUT_NODE_TYPES.has(type) && typeof wv[0] === 'string') {
    const prompt = wv[0].trim()
    if (prompt) return `prompt: "${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}"`
  }
  return undefined
}

function formatNodeLine(entry: WorkflowNodeSummary): string {
  const roleTag = entry.role ? ` [${entry.role}]` : ''
  const detail = entry.detail ? ` — ${entry.detail}` : ''
  if (entry.label !== entry.type && !isUuidType(entry.type)) {
    return `- ${entry.label} (${entry.type})${roleTag}${detail}`
  }
  if (isUuidType(entry.type) && entry.label !== entry.type) {
    return `- ${entry.label}${roleTag}${detail}`
  }
  return `- ${entry.label}${roleTag}${detail}`
}

function buildUnifiedText(
  purpose: string,
  ioSummary: string,
  io: WorkflowIoCounts,
  useCases: string[],
  parameters: WorkflowParameter[],
  subgraphNames: string[],
  groups: string[],
  notes: string[],
  mainNodes: WorkflowNodeSummary[],
  pipelineSteps: WorkflowNodeSummary[],
  models: string[],
  techniques: string[]
): string {
  const lines: string[] = []

  lines.push('--- Workflow Overview ---')
  lines.push(`Purpose: ${purpose}`)
  lines.push(`IO: ${ioSummary}`)
  if (io.inputImages > 0 || io.outputImages > 0) {
    lines.push(`Counts: ${io.inputImages} input image(s), ${io.outputImages} output image(s)${io.outputComparisons > 0 ? `, ${io.outputComparisons} comparison view(s)` : ''}${io.inputMasks > 0 ? `, ${io.inputMasks} mask(s)` : ''}${io.textPrompts > 0 ? `, ${io.textPrompts} text prompt(s)` : ''}`)
  }
  if (techniques.length > 0) lines.push(`Techniques: ${techniques.join(', ')}`)
  if (models.length > 0) lines.push(`Models: ${models.slice(0, 8).join(', ')}`)

  if (useCases.length > 0) {
    lines.push('')
    lines.push('--- Use Cases ---')
    lines.push('Suitable for:')
    for (const uc of useCases) {
      lines.push(`- ${uc}`)
    }
  }

  if (parameters.length > 0) {
    lines.push('')
    lines.push('--- Key Parameters ---')
    for (const p of parameters.slice(0, 10)) {
      lines.push(formatParameterLine(p))
    }
  }

  if (groups.length > 0 || notes.length > 0) {
    lines.push('')
    lines.push('--- Author Annotations ---')
    for (const g of groups.slice(0, 6)) lines.push(`- ${g}`)
    for (const n of notes.slice(0, 4)) {
      const clipped = n.length > 180 ? n.slice(0, 177) + '…' : n
      lines.push(`- Note: ${clipped.replace(/\n/g, ' ')}`)
    }
  }

  if (mainNodes.length > 0) {
    lines.push('')
    lines.push('--- Main Flow (user-visible) ---')
    for (const entry of mainNodes) lines.push(formatNodeLine(entry))
  }

  if (pipelineSteps.length > 0) {
    lines.push('')
    lines.push('--- Internal Pipeline ---')
    for (const entry of pipelineSteps.slice(0, 10)) lines.push(formatNodeLine(entry))
    if (pipelineSteps.length > 10) lines.push(`- … +${pipelineSteps.length - 10} more steps`)
  }

  if (subgraphNames.length > 0) {
    lines.push('')
    lines.push(`Subgraphs: ${subgraphNames.join('; ')}`)
  }

  return lines.join('\n')
}

/**
 * Build unified workflow context from JSON string.
 * Same output is shown in the UI and sent to AI prompts.
 */
export function extractWorkflowSummary(workflowJson: string, maxChars = 5000): WorkflowSummary | null {
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
  const subgraphNodeLists = subgraphs.flatMap(sg => sg.nodes ?? [])
  const allNodes = [...mainNodesRaw, ...subgraphNodeLists]

  if (allNodes.length === 0) return null

  const groups = collectGroupTitles(workflow, subgraphs)
  const notes: string[] = []
  const models = new Set<string>()
  const customNodes = new Set<string>()
  const nodeTypeCounts = new Map<string, number>()

  for (const node of allNodes) {
    const type = getNodeType(node)
    nodeTypeCounts.set(type, (nodeTypeCounts.get(type) || 0) + 1)
    const noteText = extractNoteText(node)
    if (noteText) notes.push(noteText)
    for (const m of extractModelsFromNode(node)) models.add(m)
    const cnrId = node.properties?.cnr_id
    if (typeof cnrId === 'string' && cnrId && cnrId !== 'comfy-core') customNodes.add(cnrId)
    if (/api|openai|gemini|kling|runway|ideogram/i.test(type)) customNodes.add(type)
  }

  const io = countIoOnMainCanvas(mainNodesRaw)
  const ioSummary = formatIoSummary(io)
  const parameters = extractKeyParameters(allNodes)
  const subgraphNames = subgraphs.map(sg => sg.name?.trim()).filter(Boolean) as string[]
  const techniques = inferTechniques(new Set([...nodeTypeCounts.keys()]), groups, notes, subgraphNames)

  const mainNodes: WorkflowNodeSummary[] = mainNodesRaw.map(node => ({
    label: getNodeLabel(node),
    type: getNodeType(node),
    role: inferNodeRole(node),
    detail: extractWidgetDetail(node)
  }))

  const pipelineSteps: WorkflowNodeSummary[] = subgraphNodeLists.map(node => ({
    label: getNodeLabel(node),
    type: getNodeType(node),
    role: inferNodeRole(node),
    detail: extractWidgetDetail(node)
  }))

  const purpose = inferPurpose(techniques, subgraphNames, groups, ioSummary, mainNodes)
  const useCases = inferUseCases(techniques, purpose, io, groups, notes)
  const modelList = [...models]

  let text = buildUnifiedText(
    purpose, ioSummary, io, useCases, parameters,
    subgraphNames, groups, notes,
    mainNodes, pipelineSteps, modelList, techniques
  )

  if (text.length > maxChars) text = text.slice(0, maxChars - 3) + '...'

  const structured: WorkflowSummaryStructured = {
    purpose,
    io,
    ioSummary,
    useCases,
    parameters,
    subgraphs: subgraphNames,
    groups,
    notes,
    mainNodes,
    pipelineSteps,
    models: modelList,
    techniques
  }

  return {
    text,
    structured,
    estimatedTokens: Math.ceil(text.length / 4),
    originalSizeBytes,
    nodeCount: allNodes.length,
    nodeTypes: [...nodeTypeCounts.keys()].sort(),
    models: modelList,
    customNodes: [...customNodes]
  }
}

/** Format for UI — same content AI receives */
export function formatWorkflowSummaryForUI(summary: WorkflowSummary): string {
  const origKB = (summary.originalSizeBytes / 1024).toFixed(1)
  return [
    `Workflow Context (~${summary.estimatedTokens} tokens, extracted from ${origKB} KB JSON):`,
    'This is the same context sent to AI. Review or edit before generating.',
    '',
    summary.text
  ].join('\n')
}
