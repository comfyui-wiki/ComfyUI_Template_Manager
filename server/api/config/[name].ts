// Import all config files directly for Vercel compatibility
import templateNamingRules from '~/config/template-naming-rules.json'
import workflowModelConfig from '~/config/workflow-model-config.json'
import bundleMappingRules from '~/config/bundle-mapping-rules.json'
import i18nConfig from '~/config/i18n-config.json'
import aiAssistantPrompts from '~/config/ai-assistant-prompts.json'

const configs: Record<string, any> = {
  'template-naming-rules.json': templateNamingRules,
  'workflow-model-config.json': workflowModelConfig,
  'bundle-mapping-rules.json': bundleMappingRules,
  'i18n-config.json': i18nConfig,
  'ai-assistant-prompts.json': aiAssistantPrompts
}

export default defineEventHandler((event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Config name is required'
    })
  }

  // Check if config exists
  if (!configs[name]) {
    throw createError({
      statusCode: 404,
      message: 'Config not found'
    })
  }

  // Set cache headers
  setHeader(event, 'Cache-Control', 'public, max-age=60')

  return configs[name]
})
