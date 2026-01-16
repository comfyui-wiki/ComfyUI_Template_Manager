import { readFile } from 'fs/promises'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Config name is required'
    })
  }

  // Only allow specific config files
  const allowedConfigs = ['template-naming-rules.json', 'workflow-model-config.json', 'bundle-mapping-rules.json']

  if (!allowedConfigs.includes(name)) {
    throw createError({
      statusCode: 404,
      message: 'Config not found'
    })
  }

  try {
    const configPath = join(process.cwd(), 'config', name)
    const content = await readFile(configPath, 'utf-8')

    // Set cache headers
    setHeader(event, 'Cache-Control', 'public, max-age=60')

    return JSON.parse(content)
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to read config: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
