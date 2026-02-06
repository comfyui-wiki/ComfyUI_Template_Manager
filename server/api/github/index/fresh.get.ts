import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

/**
 * Get fresh index.json from GitHub (bypass cache)
 * This endpoint fetches the latest index.json directly from GitHub API
 * to ensure we get the most up-to-date template order
 */
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

    console.log(`[Fresh Index] Fetching index.json from ${owner}/${repoName}/${branch}`)

    // Get content from GitHub API (this bypasses CDN cache)
    const { data: file } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: 'templates/index.json',
      ref: branch as string,
      // Add cache-busting header
      headers: {
        'If-None-Match': '' // Force bypass GitHub's ETag cache
      }
    })

    if (!('content' in file)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'index.json not found or is a directory'
      })
    }

    // Decode base64 content
    const content = Buffer.from(file.content, 'base64').toString('utf-8')
    const indexData = JSON.parse(content)

    console.log(`[Fresh Index] ✓ Successfully fetched index.json with ${indexData.length} categories`)

    return {
      success: true,
      data: indexData,
      sha: file.sha // Include SHA for cache validation
    }

  } catch (error: any) {
    console.error('[Fresh Index] Error fetching index.json:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch index.json'
    })
  }
})
