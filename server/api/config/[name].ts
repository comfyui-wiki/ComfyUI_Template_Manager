// Import all config files directly for Vercel compatibility
import templateNamingRules from '~/config/template-naming-rules.json'
import workflowModelConfig from '~/config/workflow-model-config.json'
import bundleMappingRules from '~/config/bundle-mapping-rules.json'
import i18nConfig from '~/config/i18n-config.json'
import aiAssistantPrompts from '~/config/ai-assistant-prompts.json'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const staticConfigs: Record<string, any> = {
  'template-naming-rules.json': templateNamingRules,
  'workflow-model-config.json': workflowModelConfig,
  'bundle-mapping-rules.json': bundleMappingRules,
  'i18n-config.json': i18nConfig,
  'ai-assistant-prompts.json': aiAssistantPrompts,
}

// Local-only config files (not committed, loaded at runtime)
const localConfigFiles = new Set(['supported_models.json'])

export default defineEventHandler((event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Config name is required'
    })
  }

  // Check static configs first
  if (staticConfigs[name] !== undefined) {
    setHeader(event, 'Cache-Control', 'public, max-age=60')
    return staticConfigs[name]
  }

  // Load local-only config files at runtime
  if (localConfigFiles.has(name)) {
    try {
      const filePath = resolve(process.cwd(), 'config', name)
      const content = readFileSync(filePath, 'utf-8')
      setHeader(event, 'Cache-Control', 'public, max-age=60')
      return JSON.parse(content)
    } catch {
      throw createError({
        statusCode: 404,
        message: `Config not found: ${name}`
      })
    }
  }

  throw createError({
    statusCode: 404,
    message: 'Config not found'
  })
})
