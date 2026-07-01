import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import i18nConfig from '~/config/i18n-config.json'
import { isLocalRepoMode, readRepoJson, repoFileExists } from '~/server/utils/local-repo'

function getI18nPaths(): string[] {
  return [
    i18nConfig.i18nDataPath?.default || 'scripts/data/i18n.json',
    i18nConfig.i18nDataPath?.fallback
  ].filter((path, index, paths): path is string => Boolean(path) && paths.indexOf(path) === index)
}

export default defineEventHandler(async (event) => {
  try {
    const localMode = isLocalRepoMode()
    const session = await getServerSession(event)

    if (!localMode && !session?.accessToken) {
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

    const i18nPaths = getI18nPaths()

    if (localMode) {
      for (const i18nPath of i18nPaths) {
        console.log(`[i18n read API] Reading i18n.json locally from: ${i18nPath}`)
        if (await repoFileExists(i18nPath)) {
          const i18nData = await readRepoJson(i18nPath)
          console.log('[i18n read API] Successfully loaded i18n.json from local clone')
          return i18nData
        }
        console.warn(`[i18n read API] File not found locally: ${i18nPath}`)
      }

      throw createError({
        statusCode: 404,
        statusMessage: `i18n.json not found at paths: ${i18nPaths.join(', ')}`
      })
    }

    const [owner, repoName] = (repo as string).split('/')
    const octokit = new Octokit({ auth: session!.accessToken })

    for (const i18nPath of i18nPaths) {
      console.log(`[i18n read API] Reading i18n.json from: ${i18nPath}`)

      try {
        // Step 1: Get file metadata via getContent to retrieve the blob SHA
        // (getContent fails for files >1MB base64-encoded, so we only use it for the SHA)
        const { data: fileInfo } = await octokit.repos.getContent({
          owner,
          repo: repoName,
          path: i18nPath,
          ref: branch as string,
          headers: {
            'If-None-Match': '' // Disable GitHub API caching
          }
        })

        if (!('sha' in fileInfo) || !fileInfo.sha) {
          throw new Error('Invalid file structure: missing SHA')
        }

        // Step 2: If content is present and not truncated, use it directly
        if ('content' in fileInfo && fileInfo.content && !('truncated' in fileInfo && fileInfo.truncated)) {
          const content = Buffer.from(fileInfo.content, 'base64').toString('utf-8')
          const i18nData = JSON.parse(content)
          console.log(`[i18n read API] Successfully loaded i18n.json via getContent`)
          return i18nData
        }

        // Step 3: File is too large for getContent — use Git Blobs API which handles files up to 100MB
        console.log(`[i18n read API] File too large for getContent, falling back to Git Blobs API`)
        const { data: blob } = await octokit.git.getBlob({
          owner,
          repo: repoName,
          file_sha: fileInfo.sha
        })

        let content: string
        if (blob.encoding === 'base64') {
          content = Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf-8')
        } else {
          content = blob.content
        }

        const i18nData = JSON.parse(content)
        console.log(`[i18n read API] Successfully loaded i18n.json via Git Blobs API`)
        return i18nData
      } catch (error: any) {
        if (error.status === 404) {
          console.warn(`[i18n read API] File not found: ${i18nPath} in ${owner}/${repoName}@${branch}`)
          continue
        }
        throw error
      }
    }

    console.error(`[i18n read API] i18n.json not found at any configured path in ${owner}/${repoName}@${branch}`)
    throw createError({
      statusCode: 404,
      statusMessage: `i18n.json not found at paths: ${i18nPaths.join(', ')}`
    })
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
