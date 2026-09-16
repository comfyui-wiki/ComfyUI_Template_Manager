import { UUID_RE, type ModelLinkIssue, type ModelLinkWhitelist, type TemplateModelLinkResult } from './types'

const NON_WIDGET_SLOT_TYPES = new Set([
  'IMAGE',
  'IMAGE_PATH',
  'MASK',
  'LATENT',
  'MODEL',
  'CLIP',
  'VAE',
  'CONDITIONING',
  'AUDIO',
  'VIDEO',
  'NOISE',
  'GUIDER',
  'SAMPLER',
  'SIGMAS',
  'CONTROL_NET',
  'UPSCALE_MODEL',
  'STYLE_MODEL',
  'CLIP_VISION',
  'CLIP_VISION_OUTPUT',
  'GLIGEN',
  'PHOTOMAKER',
  'MESH',
  'VOXEL',
  'HOOKS',
  'TIMESTEPS_RANGE'
])

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as JsonRecord
}

export function isSubgraphNode(nodeType: string): boolean {
  return UUID_RE.test(nodeType)
}

export function isNodeIgnored(nodeType: string, whitelist: ModelLinkWhitelist): boolean {
  const ignore = new Set(whitelist.ignoreNodeTypes.map(type => type.toLowerCase()))
  return ignore.has(nodeType.toLowerCase())
}

export function safetensorsFromWidgets(widgetsValues: unknown): string[] {
  const files: string[] = []
  let values: unknown[] = []
  if (Array.isArray(widgetsValues)) {
    values = widgetsValues
  } else if (typeof widgetsValues === 'object' && widgetsValues !== null) {
    values = Object.values(widgetsValues)
  } else {
    return files
  }
  for (const value of values) {
    if (typeof value === 'string' && value.includes('.safetensors') && value.trim()) {
      files.push(value)
    }
  }
  return files
}

export function modelEntries(properties: unknown): JsonRecord[] {
  const props = asRecord(properties)
  if (!props) return []
  const models = props.models
  if (!Array.isArray(models)) return []
  return models.filter((model): model is JsonRecord => {
    const record = asRecord(model)
    return Boolean(record && record.name)
  })
}

function modelNamesWithUrl(models: JsonRecord[]): Set<string> {
  const names = new Set<string>()
  for (const model of models) {
    const name = model.name
    const url = model.url
    if (typeof name === 'string' && name && typeof url === 'string' && url.trim()) {
      names.add(name)
    }
  }
  return names
}

export function collectSubgraphDefs(obj: unknown, out: Record<string, JsonRecord> = {}): Record<string, JsonRecord> {
  const record = asRecord(obj)
  if (!record) return out

  const definitions = asRecord(record.definitions)
  const subgraphs = definitions?.subgraphs
  if (Array.isArray(subgraphs)) {
    for (const subgraph of subgraphs) {
      const sg = asRecord(subgraph)
      if (sg && sg.id != null) {
        const id = String(sg.id)
        out[id] = sg
        collectSubgraphDefs(sg, out)
      }
    }
  }

  const nodes = record.nodes
  if (Array.isArray(nodes)) {
    for (const node of nodes) {
      collectSubgraphDefs(node, out)
    }
  }
  return out
}

function* iterScopedNodes(data: JsonRecord): Generator<{ scope: string, node: JsonRecord }> {
  const topNodes = data.nodes
  if (Array.isArray(topNodes)) {
    for (const node of topNodes) {
      const record = asRecord(node)
      if (record) yield { scope: 'top-level', node: record }
    }
  }
  for (const [sgId, sg] of Object.entries(collectSubgraphDefs(data))) {
    const nodes = sg.nodes
    if (!Array.isArray(nodes)) continue
    for (const node of nodes) {
      const record = asRecord(node)
      if (record) yield { scope: `subgraph ${sgId}`, node: record }
    }
  }
}

function widgetSlotInputs(subgraph: JsonRecord): JsonRecord[] {
  const slots: JsonRecord[] = []
  const inputs = subgraph.inputs
  if (!Array.isArray(inputs)) return slots
  for (const input of inputs) {
    const record = asRecord(input)
    if (!record) continue
    const slotType = String(record.type || '')
    if (NON_WIDGET_SLOT_TYPES.has(slotType)) continue
    slots.push(record)
  }
  return slots
}

function instanceWidgetPairs(instance: JsonRecord, subgraph: JsonRecord): Array<{ slot: JsonRecord | null, value: unknown }> {
  const widgets = instance.widgets_values
  const slots = widgetSlotInputs(subgraph)
  if (typeof widgets === 'object' && widgets !== null && !Array.isArray(widgets)) {
    const dict = widgets as Record<string, unknown>
    const pairs: Array<{ slot: JsonRecord | null, value: unknown }> = []
    const used = new Set<string>()
    for (const slot of slots) {
      const name = slot.name
      if (typeof name === 'string' && name in dict) {
        pairs.push({ slot, value: dict[name] })
        used.add(name)
      }
    }
    for (const [name, value] of Object.entries(dict)) {
      if (!used.has(name)) pairs.push({ slot: null, value })
    }
    return pairs
  }
  if (Array.isArray(widgets) && widgets.length === slots.length) {
    return slots.map((slot, index) => ({ slot, value: widgets[index] }))
  }
  if (Array.isArray(widgets)) {
    return widgets.map(value => ({ slot: null, value }))
  }
  return []
}

function findInnerNodeForInput(subgraph: JsonRecord, inputDef: JsonRecord | null): JsonRecord | null {
  if (!inputDef) return null
  const linkIds = inputDef.linkIds
  if (!Array.isArray(linkIds) || linkIds.length === 0) return null
  const linkSet = new Set(linkIds)
  const nodes = subgraph.nodes
  if (!Array.isArray(nodes)) return null
  for (const node of nodes) {
    const record = asRecord(node)
    if (!record) continue
    const inputs = record.inputs
    if (!Array.isArray(inputs)) continue
    for (const input of inputs) {
      const inp = asRecord(input)
      if (inp && linkSet.has(inp.link as never)) return record
    }
  }
  return null
}

function collectDefinitionModelEntries(
  sgId: string,
  defs: Record<string, JsonRecord>,
  seen = new Set<string>()
): JsonRecord[] {
  if (seen.has(sgId)) return []
  seen.add(sgId)
  const sg = defs[sgId]
  if (!sg) return []
  const entries: JsonRecord[] = []
  const nodes = sg.nodes
  if (!Array.isArray(nodes)) return entries
  for (const node of nodes) {
    const record = asRecord(node)
    if (!record) continue
    entries.push(...modelEntries(record.properties))
    const nodeType = String(record.type || '')
    if (isSubgraphNode(nodeType)) {
      entries.push(...collectDefinitionModelEntries(nodeType, defs, seen))
    }
  }
  return entries
}

function nodeId(node: JsonRecord): string {
  return node.id == null ? 'unknown' : String(node.id)
}

function analyzeMatching(
  data: JsonRecord,
  issues: ModelLinkIssue[],
  whitelist: ModelLinkWhitelist
) {
  for (const { scope, node } of iterScopedNodes(data)) {
    const nodeType = String(node.type || '')
    const files = safetensorsFromWidgets(node.widgets_values)
    if (files.length === 0) continue
    if (nodeType.toLowerCase() === 'markdownnote' || nodeType.toLowerCase() === 'note') continue
    if (isNodeIgnored(nodeType, whitelist)) continue
    if (isSubgraphNode(nodeType)) continue

    const properties = asRecord(node.properties)
    const propertiesModels = Array.isArray(properties?.models) ? properties.models : []
    const inSubgraphDef = scope.startsWith('subgraph ')

    if (propertiesModels.length > 0) {
      const widgetNames = new Set(files)
      const propertyNames = new Set(
        propertiesModels
          .map(model => asRecord(model)?.name)
          .filter((name): name is string => typeof name === 'string' && name !== '')
      )
      const missingInProperties = [...widgetNames].filter(name => !propertyNames.has(name))
      const extraInProperties = [...propertyNames].filter(name => !widgetNames.has(name))
      if (missingInProperties.length > 0 || extraInProperties.length > 0) {
        const parts: string[] = []
        if (missingInProperties.length > 0) {
          parts.push(`in widgets_values but missing in properties.models: ${missingInProperties.join(', ')}`)
        }
        if (extraInProperties.length > 0) {
          parts.push(`in properties.models but missing in widgets_values: ${extraInProperties.join(', ')}`)
        }
        issues.push({
          kind: 'widget_property_mismatch',
          nodeId: nodeId(node),
          nodeType,
          scope,
          models: [...missingInProperties, ...extraInProperties],
          message: `Node ${nodeId(node)} (${nodeType}) [${scope}] ${parts.join('; ')}`
        })
      }
    } else if (!inSubgraphDef) {
      issues.push({
        kind: 'missing_properties',
        nodeId: nodeId(node),
        nodeType,
        scope,
        models: files,
        message: `Node ${nodeId(node)} (${nodeType}) [${scope}] missing properties.models for: ${files.join(', ')}`
      })
    }
  }
}

function analyzeSubgraphInstances(
  data: JsonRecord,
  issues: ModelLinkIssue[],
  whitelist: ModelLinkWhitelist
) {
  const defs = collectSubgraphDefs(data)
  if (Object.keys(defs).length === 0) return

  for (const { scope, node: instance } of iterScopedNodes(data)) {
    const nodeType = String(instance.type || '')
    if (!isSubgraphNode(nodeType)) continue
    if (isNodeIgnored(nodeType, whitelist)) continue

    const instanceModels = safetensorsFromWidgets(instance.widgets_values)
    if (instanceModels.length === 0) continue

    const instanceEntries = modelEntries(instance.properties)
    const instanceNamed = modelNamesWithUrl(instanceEntries)
    const definitionEntries = collectDefinitionModelEntries(nodeType, defs)
    const catalog = new Set([...instanceNamed, ...modelNamesWithUrl(definitionEntries)])
    const subgraph = defs[nodeType]

    const ignoredInstanceModels = new Set<string>()
    if (subgraph) {
      for (const { slot, value } of instanceWidgetPairs(instance, subgraph)) {
        if (typeof value !== 'string' || !value.includes('.safetensors') || !value.trim()) continue
        const inner = findInnerNodeForInput(subgraph, slot)
        if (!inner) continue
        const innerType = String(inner.type || '')
        if (isNodeIgnored(innerType, whitelist)) {
          ignoredInstanceModels.add(value)
          continue
        }
        const innerNames = new Set(
          modelEntries(inner.properties)
            .map(model => model.name)
            .filter((name): name is string => typeof name === 'string')
        )
        if (innerNames.has(value) || instanceNamed.has(value)) continue
        const definitionModels = [...innerNames].filter(Boolean).sort()
        issues.push({
          kind: 'subgraph_stale_definition',
          nodeId: nodeId(instance),
          nodeType,
          scope,
          models: [value],
          innerNodeId: nodeId(inner),
          innerNodeType: innerType,
          message: `Subgraph instance ${nodeId(instance)} (${nodeType}) [${scope}] uses '${value}' but inner node ${nodeId(inner)} (${innerType}) documents: ${definitionModels.length ? definitionModels.join(', ') : '[]'}`
        })
      }
    }

    const missing = instanceModels.filter(name => !catalog.has(name) && !ignoredInstanceModels.has(name))
    if (missing.length > 0) {
      issues.push({
        kind: 'subgraph_missing_urls',
        nodeId: nodeId(instance),
        nodeType,
        scope,
        models: missing,
        message: `Subgraph instance ${nodeId(instance)} (${nodeType}) [${scope}] has no download URL for: ${missing.join(', ')}`
      })
    }
  }
}

export function analyzeWorkflowModelLinks(
  workflowName: string,
  data: unknown,
  whitelist: ModelLinkWhitelist
): TemplateModelLinkResult {
  const record = asRecord(data)
  if (!record) {
    return {
      status: 'error',
      issueCount: 1,
      issues: [{
        kind: 'invalid_json',
        nodeId: '-',
        nodeType: '-',
        scope: 'top-level',
        message: `${workflowName} is not a workflow object`
      }]
    }
  }

  const issues: ModelLinkIssue[] = []
  analyzeMatching(record, issues, whitelist)
  analyzeSubgraphInstances(record, issues, whitelist)
  return {
    status: issues.length > 0 ? 'error' : 'ok',
    issueCount: issues.length,
    issues
  }
}

export function analyzeWorkflowJson(
  workflowName: string,
  content: string,
  whitelist: ModelLinkWhitelist
): TemplateModelLinkResult {
  try {
    return analyzeWorkflowModelLinks(workflowName, JSON.parse(content), whitelist)
  } catch (error) {
    return {
      status: 'error',
      issueCount: 1,
      issues: [{
        kind: 'invalid_json',
        nodeId: '-',
        nodeType: '-',
        scope: 'top-level',
        message: error instanceof Error ? error.message : String(error)
      }]
    }
  }
}

export const DEFAULT_MODEL_CHECK_IGNORE_NODE_TYPES = [
  'MarkdownNote',
  'Note',
  'DownloadAndLoadSAM2Model',
  'DownloadAndLoadDepthAnythingV2Model',
  'WanVideoLoraSelectMulti',
  'WanVideoModelLoader',
  'WanVideoVAELoader',
  'LoadWanVideoT5TextEncoder',
  'MelBandRoFormerModelLoader',
  'SeedVR2LoadDiTModel',
  'SeedVR2LoadVAEModel'
]

export function normalizeWhitelist(input?: { ignoreNodeTypes?: string[] } | string[]): ModelLinkWhitelist {
  const types = Array.isArray(input)
    ? input
    : input?.ignoreNodeTypes ?? DEFAULT_MODEL_CHECK_IGNORE_NODE_TYPES
  return { ignoreNodeTypes: [...new Set(types)] }
}
