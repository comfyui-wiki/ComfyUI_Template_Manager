/**
 * Fetch templates index.json from a specific repository and branch
 * GET /api/github/templates
 * Query: { owner, repo, branch }
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const { owner, repo, branch = 'main' } = getQuery(event)

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: 'Owner and repo are required'
    })
  }

  // Try to get user session for authenticated requests
  const session = await getServerSession(event)

  const headers: Record<string, string> = {
    'User-Agent': 'ComfyUI-Template-CMS'
  }

  // Add authorization if user is authenticated
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
  }

  try {
    // Fetch index.json from the specified branch
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/templates/index.json`

    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      categories: data,
      source: {
        owner,
        repo,
        branch
      }
    }
  } catch (error: any) {
    console.error('Failed to fetch templates:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch templates'
    })
  }
})
