export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ModelLinkIssueKind =
  | 'subgraph_missing_urls'
  | 'subgraph_stale_definition'
  | 'widget_property_mismatch'
  | 'missing_properties'
  | 'invalid_json'

export interface ModelLinkIssue {
  kind: ModelLinkIssueKind
  nodeId: string
  nodeType: string
  scope: string
  message: string
  models?: string[]
  innerNodeId?: string
  innerNodeType?: string
}

export type TemplateModelLinkStatus = 'ok' | 'error'

export interface TemplateModelLinkResult {
  status: TemplateModelLinkStatus
  issueCount: number
  issues: ModelLinkIssue[]
}

export interface ModelLinkScanResult {
  available: boolean
  checkedWorkflows?: number
  issueTemplates?: number
  results?: Record<string, TemplateModelLinkResult>
}

export interface ModelLinkWhitelist {
  ignoreNodeTypes: string[]
}
