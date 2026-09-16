import { promises as fs } from 'fs'
import { join } from 'path'
import {
  analyzeWorkflowJson,
  DEFAULT_MODEL_CHECK_IGNORE_NODE_TYPES,
  normalizeWhitelist
} from '~/lib/model-link-scan/analyze'
import type { ModelLinkScanResult, TemplateModelLinkResult } from '~/lib/model-link-scan/types'
import workflowModelConfig from '~/config/workflow-model-config.json'
import { isLocalRepoMode, readRepoJson, repoFileExists, resolveRepoPath } from '~/server/utils/local-repo'

function templateNameFromFilename(filename: string): string {
  return filename.replace(/\.json$/i, '')
}

async function loadIgnoreNodeTypes(): Promise<string[]> {
  const types = new Set(DEFAULT_MODEL_CHECK_IGNORE_NODE_TYPES)
  const fromConfig = workflowModelConfig.modelCheckIgnoreNodeTypes
  if (Array.isArray(fromConfig)) {
    for (const type of fromConfig) {
      if (typeof type === 'string' && type.trim()) types.add(type)
    }
  }

  if (await repoFileExists('scripts/data/whitelist.json')) {
    try {
      const whitelist = await readRepoJson<{
        whitelist?: { model_check_ignore_node_types?: unknown }
      }>('scripts/data/whitelist.json')
      const fromRepo = whitelist.whitelist?.model_check_ignore_node_types
      if (Array.isArray(fromRepo)) {
        for (const type of fromRepo) {
          if (typeof type === 'string' && type.trim()) types.add(type)
        }
      }
    } catch (error) {
      console.warn('[model-links-scan] failed to read repo whitelist:', error)
    }
  }

  return [...types]
}

async function collectWorkflowSources(): Promise<Array<{ name: string, content: string }>> {
  const templatesDir = resolveRepoPath('templates')
  const entries = await fs.readdir(templatesDir)
  const workflows: Array<{ name: string, content: string }> = []

  for (const filename of entries.sort()) {
    if (!filename.endsWith('.json') || filename.startsWith('index')) continue
    const content = await fs.readFile(join(templatesDir, filename), 'utf-8')
    workflows.push({
      name: templateNameFromFilename(filename),
      content
    })
  }

  return workflows
}

export default defineEventHandler(async (): Promise<ModelLinkScanResult> => {
  if (!isLocalRepoMode()) {
    return { available: false }
  }

  try {
    const whitelist = normalizeWhitelist(await loadIgnoreNodeTypes())
    const workflows = await collectWorkflowSources()
    const results: Record<string, TemplateModelLinkResult> = {}

    for (const workflow of workflows) {
      results[workflow.name] = analyzeWorkflowJson(workflow.name, workflow.content, whitelist)
    }

    const issueTemplates = Object.values(results).filter(result => result.status === 'error').length
    return {
      available: true,
      checkedWorkflows: workflows.length,
      issueTemplates,
      results
    }
  } catch (error) {
    console.warn('[model-links-scan] scan failed:', error)
    return { available: false }
  }
})
