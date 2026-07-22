import {
  DYNAMIC_INPUT_TYPE_PREFIXES,
  FILESYSTEM_COMBO_INPUT_NAMES,
  type DynamicComboBranch,
  type NodeSpec
} from './types'

function inputTypeName(inputSpec: unknown): string | null {
  if (typeof inputSpec === 'string') return inputSpec
  if (Array.isArray(inputSpec) && inputSpec.length > 0) {
    const first = inputSpec[0]
    if (typeof first === 'string') return first
    if (Array.isArray(first)) return 'COMBO'
  }
  return null
}

function isDynamicInputType(typeName: string | null): boolean {
  if (!typeName) return false
  return DYNAMIC_INPUT_TYPE_PREFIXES.some(prefix => typeName.startsWith(prefix))
}

function inputSpecMeta(inputSpec: unknown): Record<string, unknown> {
  if (
    Array.isArray(inputSpec)
    && inputSpec.length > 1
    && typeof inputSpec[1] === 'object'
    && inputSpec[1] !== null
  ) {
    return inputSpec[1] as Record<string, unknown>
  }
  return {}
}

function normalizeOptions(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return []
  const first = value[0]
  if (Array.isArray(first)) {
    return first.map(item => String(item))
  }
  if (first === 'COMBO' && value.length > 1 && typeof value[1] === 'object' && value[1] !== null) {
    const options = (value[1] as Record<string, unknown>).options
    if (Array.isArray(options)) {
      return options.map(item => String(item))
    }
  }
  return []
}

function parseDynamicComboBranches(inputSpec: unknown): Record<string, DynamicComboBranch> {
  const meta = inputSpecMeta(inputSpec)
  const branches: Record<string, DynamicComboBranch> = {}
  const options = meta.options
  if (!Array.isArray(options)) return branches

  for (const opt of options) {
    if (typeof opt !== 'object' || opt === null) continue
    const key = String((opt as Record<string, unknown>).key || '')
    if (!key) continue

    const branch: DynamicComboBranch = {
      inputOrder: [],
      inputTypes: {},
      requiredInputs: new Set(),
      controlAfterGenerate: new Set(),
      comboOptions: {},
      autogrowInputs: new Set(),
      inputDefaults: {}
    }

    const inputsDef = (opt as Record<string, unknown>).inputs
    if (typeof inputsDef !== 'object' || inputsDef === null) continue

    for (const [groupName, isRequired] of [['required', true], ['optional', false]] as const) {
      const group = (inputsDef as Record<string, unknown>)[groupName]
      if (typeof group !== 'object' || group === null) continue

      for (const [nestedName, nestedSpec] of Object.entries(group)) {
        branch.inputOrder.push(nestedName)
        if (isRequired) branch.requiredInputs.add(nestedName)

        const nestedType = inputTypeName(nestedSpec)
        if (nestedType) {
          branch.inputTypes[nestedName] = nestedType
          if (nestedType.startsWith('COMFY_AUTOGROW')) {
            branch.autogrowInputs.add(nestedName)
          }
        }

        if (inputSpecMeta(nestedSpec).control_after_generate) {
          branch.controlAfterGenerate.add(nestedName)
        }

        const nestedOptions = normalizeOptions(nestedSpec)
        if (nestedOptions.length > 0) {
          branch.comboOptions[nestedName] = nestedOptions
        }

        const nestedMeta = inputSpecMeta(nestedSpec)
        if ('default' in nestedMeta) {
          branch.inputDefaults[nestedName] = nestedMeta.default
        }
      }
    }

    branches[key] = branch
  }

  return branches
}

function isFilesystemCombo(inputName: string, inputSpec: unknown, meta: Record<string, unknown>): boolean {
  if (FILESYSTEM_COMBO_INPUT_NAMES.has(inputName)) return true
  if (meta.image_upload || meta.video_upload || meta.audio_upload) return true
  if (!Array.isArray(inputSpec) || inputSpec.length === 0) return false

  const first = inputSpec[0]
  if (Array.isArray(first) && first.length > 0 && typeof first[0] === 'string') {
    const mediaExt = [
      '.safetensors', '.ckpt', '.pt', '.pth', '.sft',
      '.mp4', '.webm', '.png', '.jpg', '.jpeg', '.webp',
      '.glb', '.gltf', '.fbx', '.obj', '.stl', '.ply', '.usdz'
    ]
    if (first.some(item => mediaExt.some(ext => String(item).endsWith(ext)))) {
      return true
    }
  }
  return false
}

function addInputSpec(spec: NodeSpec, inputName: string, inputSpec: unknown, required: boolean): void {
  spec.inputs.add(inputName)
  if (required) spec.requiredInputs.add(inputName)

  const typeName = inputTypeName(inputSpec)
  if (typeName) {
    spec.inputTypes[inputName] = typeName
  }
  if (isDynamicInputType(typeName)) {
    spec.dynamicInputs.add(inputName)
  }

  const meta = inputSpecMeta(inputSpec)
  if (meta.control_after_generate) {
    spec.controlAfterGenerate.add(inputName)
  }
  if ('default' in meta) {
    spec.inputDefaults[inputName] = meta.default
  }
  if (isFilesystemCombo(inputName, inputSpec, meta)) {
    spec.filesystemComboInputs.add(inputName)
  }
  if (meta.image_upload || meta.video_upload || meta.audio_upload) {
    spec.uploadGhostInputs.add(inputName)
  }

  if (typeName?.startsWith('COMFY_DYNAMICCOMBO')) {
    const branches = parseDynamicComboBranches(inputSpec)
    if (Object.keys(branches).length > 0) {
      spec.dynamicComboOptions[inputName] = branches
    }
  }

  const options = normalizeOptions(inputSpec)
  if (options.length > 0) {
    spec.comboOptions[inputName] = options
  }

  if (typeof inputSpec === 'object' && inputSpec !== null && !Array.isArray(inputSpec)) {
    for (const [childName, childSpec] of Object.entries(inputSpec)) {
      if (['tooltip', 'default', 'display', 'forceInput', 'lazy'].includes(childName)) continue
      addInputSpec(spec, `${inputName}.${childName}`, childSpec, required)
    }
  }
}

function addInputGroup(spec: NodeSpec, group: unknown, required: boolean): void {
  if (typeof group !== 'object' || group === null) return
  for (const [inputName, inputSpec] of Object.entries(group)) {
    addInputSpec(spec, inputName, inputSpec, required)
  }
}

export function buildSpecsFromObjectInfo(objectInfo: Record<string, unknown>): Map<string, NodeSpec> {
  const specs = new Map<string, NodeSpec>()

  for (const [nodeType, info] of Object.entries(objectInfo)) {
    if (typeof info !== 'object' || info === null) continue

    const displayName = (info as Record<string, unknown>).display_name
    const spec: NodeSpec = {
      nodeType,
      inputs: new Set(),
      requiredInputs: new Set(),
      dynamicInputs: new Set(),
      inputOrder: [],
      hiddenInputs: new Set(),
      inputTypes: {},
      controlAfterGenerate: new Set(),
      comboOptions: {},
      filesystemComboInputs: new Set(),
      uploadGhostInputs: new Set(),
      inputDefaults: {},
      dynamicComboOptions: {},
      apiNode: Boolean((info as Record<string, unknown>).api_node),
      deprecated:
        Boolean((info as Record<string, unknown>).deprecated)
        || Boolean(displayName && String(displayName).toUpperCase().includes('DEPRECATED')),
      displayName: displayName != null ? String(displayName) : null
    }

    const inputTypes = (info as Record<string, unknown>).input
    const inputOrder = (info as Record<string, unknown>).input_order
    if (typeof inputOrder === 'object' && inputOrder !== null) {
      const order = inputOrder as Record<string, unknown>
      spec.hiddenInputs = new Set(
        Array.isArray(order.hidden) ? order.hidden.map(name => String(name)) : []
      )
      spec.inputOrder = [
        ...(Array.isArray(order.required) ? order.required.map(name => String(name)) : []),
        ...(Array.isArray(order.optional) ? order.optional.map(name => String(name)) : [])
      ]
    }

    if (typeof inputTypes === 'object' && inputTypes !== null) {
      const groups = inputTypes as Record<string, unknown>
      addInputGroup(spec, groups.required, true)
      addInputGroup(spec, groups.optional, false)
    }

    specs.set(nodeType, spec)
  }

  return specs
}
