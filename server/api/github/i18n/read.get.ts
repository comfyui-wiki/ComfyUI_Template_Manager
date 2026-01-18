import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { readFileSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)

    if (!session?.accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Please sign in'
      })
    }

    const query = getQuery(event)
    const { repo, branch } = query

    if (!repo || !branch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: repo, branch'
      })
    }

    const [owner, repoName] = (repo as string).split('/')
    const octokit = new Octokit({ auth: session.accessToken })

    // Read i18n config to get the correct path
    let config: any

    try {
      // Try to read from server assets (production)
      const storage = useStorage('assets:server')
      const configContent = await storage.getItem('i18n-config.json')

      if (configContent) {
        config = typeof configContent === 'string'
          ? JSON.parse(configContent)
          : configContent
        console.log('[i18n read API] Loaded config from server assets')
      }
    } catch (error) {
      console.log('[i18n read API] Server assets not available, trying file system fallback:', error)
    }

    // Fallback to file system (development)
    if (!config) {
      try {
        const configPath = join(process.cwd(), 'config', 'i18n-config.json')
        const configContent = readFileSync(configPath, 'utf-8')
        config = JSON.parse(configContent)
        console.log('[i18n read API] Loaded config from file system')
      } catch (error) {
        console.error('[i18n read API] Failed to load config from file system:', error)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to load i18n configuration'
        })
      }
    }

    const i18nPath = config.i18nDataPath?.default || 'scripts/i18n.json'

    console.log(`[i18n read API] Reading i18n.json from: ${i18nPath}`)

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo: repoName,
        path: i18nPath,
        ref: branch as string
      })

      if ('content' in data && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        const i18nData = JSON.parse(content)

        console.log(`[i18n read API] Successfully loaded i18n.json`)
        return i18nData
      }

      throw new Error('Invalid file structure')
    } catch (error: any) {
      if (error.status === 404) {
        console.error(`[i18n read API] File not found: ${i18nPath} in ${owner}/${repoName}@${branch}`)
        throw createError({
          statusCode: 404,
          statusMessage: `i18n.json not found at path: ${i18nPath}`
        })
      }
      throw error
    }
  } catch (error: any) {
    console.error('[i18n read API] Error reading i18n.json:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to read i18n.json'
    })
  }
})
