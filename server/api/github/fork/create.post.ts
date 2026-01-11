/**
 * Create a fork of the repository for the authenticated user
 * POST /api/github/fork/create
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const config = useRuntimeConfig()

  if (!session || !session.accessToken) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized: Please sign in'
    })
  }

  try {
    // Create fork using user's token
    const response = await fetch(
      `https://api.github.com/repos/${config.public.repoOwner}/${config.public.repoName}/forks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ComfyUI-Template-CMS'
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `GitHub API returned ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      fork: {
        name: data.name,
        fullName: data.full_name,
        owner: data.owner.login,
        defaultBranch: data.default_branch,
        url: data.html_url
      }
    }
  } catch (error: any) {
    console.error('Failed to create fork:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to create fork'
    })
  }
})
