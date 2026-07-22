import {
  CONTROL_AFTER_GENERATE_VALUES,
  CORE_CNR_ID,
  DYNAMIC_INPUT_TYPE_PREFIXES,
  FRONTEND_ONLY_INPUT_TYPES,
  UPLOAD_GHOST_SUFFIX_VALUES,
  UUID_RE,
  type CompatIssue,
  type DynamicComboBranch,
  type NodeSpec,
  type TemplateCompatResult,
  type TemplateCompatStatus
} from './types'

type WorkflowNode = Record<string, unknown>

function appendSaveFormatNodes(
  nodes: Array<[WorkflowNode, string]>,
  nodeList: unknown,
  scope: string
): void {
  if (!Array.isArray(nodeList)) return
  for (const node of nodeList) {
    if (typeof node === 'object' && node !== null) {
      nodes.push([node as WorkflowNode, scope])
    }
  }
}

export function iterWorkflowNodes(data: unknown): Array<[WorkflowNode, string]> {
  if (typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>).nodes)) {
    const nodes: Array<[WorkflowNode, string]> = []
    const record = data as Record<string, unknown>
    appendSaveFormatNodes(nodes, record.nodes, '')

    const definitions = record.definitions as { subgraphs?: unknown[] } | undefined
    for (const subgraph of definitions?.subgraphs || []) {
      if (typeof subgraph !== 'object' || subgraph === null) continue
      const sgId = (subgraph as Record<string, unknown>).id ?? 'unknown'
      appendSaveFormatNodes(nodes, (subgraph as Record<string, unknown>).nodes, `subgraph ${sgId}`)
    }
    return nodes
  }

  if (typeof data === 'object' && data !== null) {
    const nodes: Array<[WorkflowNode, string]> = []
    for (const [nodeId, node] of Object.entries(data)) {
      if (typeof node !== 'object' || node === null) continue
      const nodeRecord = node as Record<string, unknown>
      if (!nodeRecord.class_type) continue
      nodes.push([
        {
          id: nodeId,
          type: nodeRecord.class_type,
          inputs: Object.entries(nodeRecord.inputs || {}).map(([name, value]) => ({
            name,
            link: Array.isArray(value) ? value : null
          })),
          widgets_values: Object.fromEntries(
            Object.entries(nodeRecord.inputs || {}).filter(([, value]) => !Array.isArray(value))
          )
        },
        ''
      ])
    }
    return nodes
  }

  return []
}

function nodeIsCore(node: WorkflowNode, specs: Map<string, NodeSpec>): boolean {
  const properties = node.properties
  if (typeof properties === 'object' && properties !== null) {
    if ((properties as Record<string, unknown>).cnr_id === CORE_CNR_ID) return true
  }
  return specs.has(String(node.type || ''))
}

function isSubgraphNodeType(nodeType: string): boolean {
  return UUID_RE.test(nodeType)
}

function linkedInputNames(node: WorkflowNode): Set<string> {
  const linked = new Set<string>()
  const inputs = node.inputs
  if (!Array.isArray(inputs)) return linked

  for (const inputItem of inputs) {
    if (typeof inputItem !== 'object' || inputItem === null) continue
    const item = inputItem as Record<string, unknown>
    if (item.link == null) continue
    const widget = item.widget
    if (typeof widget === 'object' && widget !== null && (widget as Record<string, unknown>).name) {
      continue
    }
    if (item.name) linked.add(String(item.name))
  }
  return linked
}

function socketInputNames(node: WorkflowNode): Set<string> {
  const sockets = new Set<string>()
  if (!Array.isArray(node.inputs)) return sockets

  for (const inputItem of node.inputs) {
    if (typeof inputItem !== 'object' || inputItem === null) continue
    const item = inputItem as Record<string, unknown>
    if (typeof item.widget === 'object' && item.widget !== null) continue
    const name = String(item.name || '')
    if (!name) continue
    sockets.add(name)
    const leaf = name.split('.').pop()
    if (leaf) sockets.add(leaf)
  }
  return sockets
}

function isSocketBackedBranchInput(
  parentName: string,
  nestedName: string,
  socketNames: Set<string>
): boolean {
  return socketNames.has(nestedName) || socketNames.has(`${parentName}.${nestedName}`)
}

const WIDGET_INPUT_TYPES = new Set(['STRING', 'INT', 'FLOAT', 'BOOLEAN', 'COMBO'])

function splitInputTypeNames(typeName: string): string[] {
  return typeName.split(',').map(part => part.trim()).filter(Boolean)
}

function isWidgetBackedInput(typeName: string | undefined): boolean {
  if (!typeName) return false
  if (DYNAMIC_INPUT_TYPE_PREFIXES.some(prefix => typeName.startsWith(prefix))) return true
  return splitInputTypeNames(typeName).some(part => WIDGET_INPUT_TYPES.has(part))
}

function isDynamicComboType(typeName: string | undefined): boolean {
  return Boolean(typeName?.startsWith('COMFY_DYNAMICCOMBO'))
}

function isAutogrowType(typeName: string | undefined): boolean {
  return Boolean(typeName?.startsWith('COMFY_AUTOGROW'))
}

function isSkippedHiddenInput(name: string, spec: NodeSpec): boolean {
  if (!spec.hiddenInputs.has(name)) return false
  return !isWidgetBackedInput(spec.inputTypes[name])
}

function inputIsLinked(name: string, linkedInputs: Set<string>, spec: NodeSpec): boolean {
  if (linkedInputs.has(name)) return true
  const typeName = spec.inputTypes[name]
  if (isAutogrowType(typeName) || typeName?.startsWith('COMFY_MATCHTYPE')) {
    const prefix = `${name}.`
    return [...linkedInputs].some(linkedName => linkedName.startsWith(prefix))
  }
  return false
}

function widgetSlotNames(spec: NodeSpec, linkedInputs: Set<string>): string[] {
  return spec.inputOrder.filter(name =>
    !isSkippedHiddenInput(name, spec)
    && !inputIsLinked(name, linkedInputs, spec)
    && isWidgetBackedInput(spec.inputTypes[name])
  )
}

function shouldConsumeControlAfterGenerate(
  name: string,
  values: unknown[],
  index: number,
  controlAfterGenerate: Set<string>
): boolean {
  if (index >= values.length) return false
  if (controlAfterGenerate.has(name)) return true
  return name === 'seed' && CONTROL_AFTER_GENERATE_VALUES.has(String(values[index]))
}

function consumeDynamicComboBranch(
  values: unknown[],
  index: number,
  branch: DynamicComboBranch,
  mapped: Record<string, unknown>,
  parentName: string,
  linked: Set<string>,
  socketNames: Set<string>
): number {
  for (const nestedName of branch.inputOrder) {
    if (branch.autogrowInputs.has(nestedName)) continue
    if (linked.has(`${parentName}.${nestedName}`)) continue
    if (isSocketBackedBranchInput(parentName, nestedName, socketNames)) continue
    if (index >= values.length) break
    mapped[nestedName] = values[index]
    index += 1
    if (shouldConsumeControlAfterGenerate(nestedName, values, index, branch.controlAfterGenerate)) {
      index += 1
    }
  }
  return index
}

function mapWidgetsFromList(
  values: unknown[],
  spec: NodeSpec,
  linked: Set<string>,
  socketNames: Set<string>
): [Record<string, unknown>, number] {
  const mapped: Record<string, unknown> = {}
  let index = 0

  for (const name of widgetSlotNames(spec, linked)) {
    if (index >= values.length) break
    const typeName = spec.inputTypes[name]
    if (isDynamicComboType(typeName)) {
      const selectedKey = values[index]
      index += 1
      mapped[name] = selectedKey
      const branch = spec.dynamicComboOptions[name]?.[String(selectedKey)]
      if (branch) {
        index = consumeDynamicComboBranch(values, index, branch, mapped, name, linked, socketNames)
      }
      continue
    }

    mapped[name] = values[index]
    index += 1
    if (shouldConsumeControlAfterGenerate(name, values, index, spec.controlAfterGenerate)) {
      index += 1
    }
  }

  return [mapped, index]
}

function defaultForInput(spec: NodeSpec, inputName: string): unknown {
  if (inputName in spec.inputDefaults) return spec.inputDefaults[inputName]
  for (const branches of Object.values(spec.dynamicComboOptions)) {
    for (const branch of Object.values(branches)) {
      if (inputName in branch.inputDefaults) return branch.inputDefaults[inputName]
    }
  }
  return undefined
}

function isOmittableDefault(inputName: string, spec: NodeSpec): boolean {
  if (spec.requiredInputs.has(inputName)) return false
  const defaultValue = defaultForInput(spec, inputName)
  if (defaultValue === undefined) return true
  return defaultValue === '' || defaultValue === false || defaultValue === 0 || defaultValue === 0.0
}

function iterUnmappedWidgetSlots(
  spec: NodeSpec,
  linked: Set<string>,
  mapped: Record<string, unknown>
): string[] {
  return widgetSlotNames(spec, linked).filter(name => !(name in mapped))
}

function isIgnorableTailValue(value: unknown): boolean {
  if (typeof value === 'string' && CONTROL_AFTER_GENERATE_VALUES.has(value)) return true
  if (typeof value === 'string' && UPLOAD_GHOST_SUFFIX_VALUES.has(value)) return true
  return false
}

function checkWidgetSlotAlignment(node: WorkflowNode, spec: NodeSpec): [boolean, string | null] {
  const values = node.widgets_values
  if (!Array.isArray(values) || spec.inputOrder.length === 0) return [true, null]

  const linked = linkedInputNames(node)
  const socketNames = socketInputNames(node)
  const [mapped, consumed] = mapWidgetsFromList(values, spec, linked, socketNames)
  const actual = values.length

  if (consumed === actual) {
    const missingRequired = iterUnmappedWidgetSlots(spec, linked, mapped).filter(name =>
      spec.requiredInputs.has(name)
    )
    if (missingRequired.length > 0) {
      return [
        false,
        `required widget(s) ${JSON.stringify(missingRequired)} missing from widgets_values (${actual} slot(s) present).`
      ]
    }
    return [true, null]
  }

  if (consumed < actual) {
    const tail = values.slice(consumed)
    if (tail.length > 0 && tail.every(isIgnorableTailValue)) return [true, null]
    return [
      false,
      `widgets_values has ${actual} slot(s) but schema walk consumed ${consumed} (extra tail: ${JSON.stringify(tail)}). Re-open and re-save the node in ComfyUI.`
    ]
  }

  const missingSlots = iterUnmappedWidgetSlots(spec, linked, mapped)
  const shortfall = consumed - actual
  const omittable = missingSlots.filter(name => isOmittableDefault(name, spec))
  const controlOnly = shortfall <= widgetSlotNames(spec, linked).filter(name =>
    spec.controlAfterGenerate.has(name)
  ).length

  if (omittable.length >= shortfall || controlOnly) {
    const stillRequired = missingSlots.filter(name => spec.requiredInputs.has(name))
    if (stillRequired.length > 0) {
      return [
        false,
        `required widget(s) ${JSON.stringify(stillRequired)} missing from widgets_values (${actual} slot(s) present).`
      ]
    }
    return [true, null]
  }

  return [
    false,
    `widgets_values has ${actual} slot(s) but schema walk expects ${consumed} (missing ${shortfall} slot(s)). Re-open and re-save the node in ComfyUI.`
  ]
}

function mapWidgetsByInputOrder(node: WorkflowNode, spec: NodeSpec): Record<string, unknown> {
  const values = node.widgets_values
  if (!Array.isArray(values) || spec.inputOrder.length === 0) return {}
  const linked = linkedInputNames(node)
  const socketNames = socketInputNames(node)
  const [mapped] = mapWidgetsFromList(values, spec, linked, socketNames)
  return mapped
}

function flattenWidgetValue(value: unknown, prefix: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { [prefix]: value }
  }
  const flattened: Record<string, unknown> = {}
  for (const [key, childValue] of Object.entries(value)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key
    Object.assign(flattened, flattenWidgetValue(childValue, childPrefix))
  }
  return flattened
}

function widgetValuesByInput(node: WorkflowNode, spec?: NodeSpec): Record<string, unknown> {
  const values = node.widgets_values
  if (typeof values === 'object' && values !== null && !Array.isArray(values)) {
    const flattened: Record<string, unknown> = {}
    for (const [inputName, value] of Object.entries(values)) {
      Object.assign(flattened, flattenWidgetValue(value, inputName))
    }
    return flattened
  }

  if (!Array.isArray(values)) return {}

  if (spec && spec.inputOrder.length > 0) {
    const mapped = mapWidgetsByInputOrder(node, spec)
    if (Object.keys(mapped).length > 0) return mapped
  }

  const widgetInputs: string[] = []
  if (Array.isArray(node.inputs)) {
    for (const inputItem of node.inputs) {
      if (typeof inputItem !== 'object' || inputItem === null) continue
      const widget = (inputItem as Record<string, unknown>).widget
      if (typeof widget === 'object' && widget !== null && (widget as Record<string, unknown>).name) {
        widgetInputs.push(String((widget as Record<string, unknown>).name))
      }
    }
  }

  const mappedValues: Record<string, unknown> = {}
  widgetInputs.forEach((inputName, index) => {
    if (index >= values.length) return
    Object.assign(mappedValues, flattenWidgetValue(values[index], inputName))
  })
  return mappedValues
}

function isModelInput(inputName: string): boolean {
  return inputName === 'model' || inputName.endsWith('.model') || inputName.endsWith('_model')
}

function valueMatchesInputType(value: unknown, typeName: string, required: boolean): boolean {
  if (isDynamicComboType(typeName)) return typeof value === 'string'
  if (value === '' && !required) return true
  if (value == null && !required) return true

  const typeNames = splitInputTypeNames(typeName)
  if (typeNames.includes('STRING') && typeof value === 'string') return true
  if (typeNames.includes('COMBO') && typeof value === 'string') return true
  if (typeNames.includes('INT') && typeof value === 'number' && Number.isInteger(value)) return true
  if (typeNames.includes('FLOAT') && typeof value === 'number' && !Number.isNaN(value)) return true
  if (typeNames.includes('BOOLEAN') && typeof value === 'boolean') return true
  return false
}

function validationMapsForValues(
  spec: NodeSpec,
  values: Record<string, unknown>
): [Record<string, string>, Set<string>, Record<string, string[]>] {
  const typeMap = { ...spec.inputTypes }
  const requiredInputs = new Set(spec.requiredInputs)
  const comboOptions = { ...spec.comboOptions }

  for (const [comboName, branches] of Object.entries(spec.dynamicComboOptions)) {
    const selectedKey = values[comboName]
    if (selectedKey === undefined) continue
    const branch = branches[String(selectedKey)]
    if (!branch) continue
    Object.assign(typeMap, branch.inputTypes)
    branch.requiredInputs.forEach(name => requiredInputs.add(name))
    Object.assign(comboOptions, branch.comboOptions)
  }

  return [typeMap, requiredInputs, comboOptions]
}

function formatNodeLocation(nodeId: string, scope: string): string {
  return scope ? `${nodeId} (${scope})` : nodeId
}

function inputMatchesSpec(inputName: string, spec: NodeSpec): boolean {
  if (spec.inputs.has(inputName)) return true
  if (!inputName.includes('.')) return false
  const prefix = inputName.split('.', 1)[0]
  return spec.dynamicInputs.has(prefix)
}

function isFrontendOnlyInput(inputItem: Record<string, unknown>): boolean {
  if (FRONTEND_ONLY_INPUT_TYPES.has(String(inputItem.type || ''))) return true
  return inputItem.name === 'upload' && typeof inputItem.widget === 'object' && inputItem.widget !== null
}

function isGhostRenameInput(
  inputItem: Record<string, unknown>,
  node: WorkflowNode,
  spec: NodeSpec
): boolean {
  if (inputItem.link != null) return false
  if (!inputItem.type) return false
  const inputName = String(inputItem.name || '')
  if (spec.inputs.has(inputName)) return false

  if (!Array.isArray(node.inputs)) return false
  for (const other of node.inputs) {
    if (typeof other !== 'object' || other === null) continue
    const otherRecord = other as Record<string, unknown>
    const otherName = String(otherRecord.name || '')
    if (!spec.inputs.has(otherName)) continue
    if (otherRecord.type !== inputItem.type) continue
    if (otherRecord.link != null) return true
  }
  return false
}

function checkWidgetValues(
  workflowName: string,
  node: WorkflowNode,
  spec: NodeSpec,
  nodeId: string,
  nodeType: string,
  values: Record<string, unknown>
): CompatIssue[] {
  const widgetsValues = node.widgets_values
  if (spec.apiNode && Array.isArray(widgetsValues) && spec.inputOrder.length > 0) {
    const [ok, message] = checkWidgetSlotAlignment(node, spec)
    if (!ok && message) {
      return [{
        severity: 'error',
        kind: 'widget_slot_mismatch',
        workflow: workflowName,
        nodeId,
        nodeType,
        message
      }]
    }
  }

  const [typeMap, , comboOptions] = validationMapsForValues(spec, values)

  for (const [inputName, value] of Object.entries(values)) {
    const typeName = typeMap[inputName]
    if (!typeName) continue
    if (isDynamicComboType(typeName)) {
      const branches = spec.dynamicComboOptions[inputName] || {}
      if (!(String(value) in branches)) {
        return [{
          severity: 'error',
          kind: spec.apiNode && isModelInput(inputName) ? 'invalid_api_model' : 'invalid_combo_value',
          workflow: workflowName,
          nodeId,
          nodeType,
          message: `Value \`${value}\` for dynamic combo \`${inputName}\` is not available in current INPUT_TYPES.`
        }]
      }
      continue
    }
    if (DYNAMIC_INPUT_TYPE_PREFIXES.some(prefix => String(typeName).startsWith(prefix))) continue
    const required = spec.requiredInputs.has(inputName)
    if (!valueMatchesInputType(value, typeName, required) && spec.apiNode) {
      return [{
        severity: 'error',
        kind: 'invalid_widget_value',
        workflow: workflowName,
        nodeId,
        nodeType,
        message: `Widget \`${inputName}\` has value \`${JSON.stringify(value)}\` but the node expects type \`${typeName}\` — values may be misaligned after a node update.`
      }]
    }
  }

  for (const [inputName, options] of Object.entries(comboOptions)) {
    if (spec.filesystemComboInputs.has(inputName)) continue
    if (!(inputName in values)) continue
    const value = values[inputName]
    if (value == null || value === '') continue
    if (typeof value === 'number' || typeof value === 'boolean') continue
    if (!options.includes(String(value))) {
      return [{
        severity: 'error',
        kind: spec.apiNode && isModelInput(inputName) ? 'invalid_api_model' : 'invalid_combo_value',
        workflow: workflowName,
        nodeId,
        nodeType,
        message: `Value \`${value}\` for combo input \`${inputName}\` is not available in current INPUT_TYPES.`
      }]
    }
  }

  return []
}

function checkNode(
  workflowName: string,
  node: WorkflowNode,
  specs: Map<string, NodeSpec>,
  scope = ''
): CompatIssue[] {
  const nodeType = String(node.type || '')
  if (isSubgraphNodeType(nodeType)) return []

  const spec = specs.get(nodeType)
  if (!spec?.deprecated) return []

  const nodeId = formatNodeLocation(String(node.id ?? ''), scope)
  const label = spec.displayName || nodeType
  return [{
    severity: 'warning',
    kind: 'deprecated_node',
    workflow: workflowName,
    nodeId,
    nodeType,
    message: `Node is marked deprecated in ComfyUI: ${label}`
  }]
}

export function scanWorkflowJson(
  workflowName: string,
  data: unknown,
  specs: Map<string, NodeSpec>
): CompatIssue[] {
  const issues: CompatIssue[] = []
  for (const [node, scope] of iterWorkflowNodes(data)) {
    issues.push(...checkNode(workflowName, node, specs, scope))
  }
  return issues
}

export function summarizeTemplateCompat(issues: CompatIssue[]): TemplateCompatResult {
  const errorCount = issues.filter(issue => issue.severity === 'error').length
  const warningCount = issues.filter(issue => issue.severity === 'warning').length
  let status: TemplateCompatStatus = 'ok'
  if (errorCount > 0) status = 'error'
  else if (warningCount > 0) status = 'warning'

  return { status, errorCount, warningCount, issues }
}
