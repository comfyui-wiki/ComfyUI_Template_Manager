export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Config name is required'
    })
  }

  // Only allow specific config files
  const allowedConfigs = ['template-naming-rules.json', 'workflow-model-config.json', 'bundle-mapping-rules.json', 'i18n-config.json', 'ai-assistant-prompts.json']

  if (!allowedConfigs.includes(name)) {
    throw createError({
      statusCode: 404,
      message: 'Config not found'
    })
  }

  try {
    // Use Nitro's storage API for serverless compatibility
    const storage = useStorage('assets:config')
    const content = await storage.getItem(name)

    if (!content) {
      throw new Error(`Config file not found: ${name}`)
    }

    // Set cache headers
    setHeader(event, 'Cache-Control', 'public, max-age=60')

    // Parse if string, otherwise return as-is (already parsed)
    return typeof content === 'string' ? JSON.parse(content) : content
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to read config: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
