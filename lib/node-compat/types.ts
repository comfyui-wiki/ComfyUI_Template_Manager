export const CORE_CNR_ID = 'comfy-core'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DYNAMIC_INPUT_TYPE_PREFIXES = [
  'COMFY_AUTOGROW',
  'COMFY_DYNAMICCOMBO',
  'COMFY_MATCHTYPE'
] as const

export const FRONTEND_ONLY_INPUT_TYPES = new Set(['IMAGEUPLOAD'])

export const FILESYSTEM_COMBO_INPUT_NAMES = new Set([
  'vae_name',
  'ckpt_name',
  'unet_name',
  'clip_name',
  'clip_name1',
  'clip_name2',
  'lora_name',
  'lora_1',
  'lora_2',
  'image',
  'file',
  'audio',
  'video',
  'model_name',
  'model_file',
  'weight_name'
])

export const CONTROL_AFTER_GENERATE_VALUES = new Set([
  'randomize',
  'fixed',
  'increment',
  'decrement'
])

export const UPLOAD_GHOST_SUFFIX_VALUES = new Set(['image', 'video'])

export type IssueSeverity = 'error' | 'warning'

export type IssueKind =
  | 'invalid_api_model'
  | 'missing_node'
  | 'invalid_combo_value'
  | 'invalid_widget_value'
  | 'widget_slot_mismatch'
  | 'missing_input'
  | 'invalid_json'
  | 'deprecated_node'

export interface CompatIssue {
  severity: IssueSeverity
  kind: IssueKind
  workflow: string
  nodeId: string
  nodeType: string
  message: string
}

export interface DynamicComboBranch {
  inputOrder: string[]
  inputTypes: Record<string, string>
  requiredInputs: Set<string>
  controlAfterGenerate: Set<string>
  comboOptions: Record<string, string[]>
  autogrowInputs: Set<string>
  inputDefaults: Record<string, unknown>
}

export interface NodeSpec {
  nodeType: string
  inputs: Set<string>
  requiredInputs: Set<string>
  dynamicInputs: Set<string>
  inputOrder: string[]
  hiddenInputs: Set<string>
  inputTypes: Record<string, string>
  controlAfterGenerate: Set<string>
  comboOptions: Record<string, string[]>
  filesystemComboInputs: Set<string>
  uploadGhostInputs: Set<string>
  inputDefaults: Record<string, unknown>
  dynamicComboOptions: Record<string, Record<string, DynamicComboBranch>>
  apiNode: boolean
  deprecated: boolean
  displayName: string | null
}

export type TemplateCompatStatus = 'ok' | 'warning' | 'error'

export interface TemplateCompatResult {
  status: TemplateCompatStatus
  errorCount: number
  warningCount: number
  issues: CompatIssue[]
}

export interface NodeCompatScanResult {
  available: boolean
  scanMode?: 'runtime'
  sourceUrl?: string
  nodeCount?: number
  checkedWorkflows?: number
  results?: Record<string, TemplateCompatResult>
  /** True when object_info came from project .cache (ComfyUI was offline). */
  fromCache?: boolean
  /** ISO timestamp of cached object_info baseline. */
  objectInfoCachedAt?: string
}
