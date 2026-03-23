import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import i18nConfig from '~/config/i18n-config.json'

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

    // Use directly imported config (works in both dev and production/Vercel)
    const i18nPath = i18nConfig.i18nDataPath?.default || 'scripts/i18n.json'

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
