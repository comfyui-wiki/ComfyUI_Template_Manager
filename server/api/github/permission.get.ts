/**
 * Check if a user has write access to the main repository
 * GET /api/github/permission?username=xxx
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const { username } = getQuery(event)
  const config = useRuntimeConfig()

  if (!username) {
    return {
      hasAccess: false,
      error: 'Username is required'
    }
  }

  // Get user session to use their access token
  const session = await getServerSession(event)

  if (!session?.accessToken) {
    console.log('[permission API] No access token found')
    return {
      hasAccess: false,
      error: 'Not authenticated'
    }
  }

  console.log(`[permission API] Checking permission for user ${username}`)

  try {
    // Check if user is a collaborator with write access
    const response = await fetch(
      `https://api.github.com/repos/${config.public.repoOwner}/${config.public.repoName}/collaborators/${username}/permission`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ComfyUI-Template-CMS'
        }
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        // User is not a collaborator
        console.log(`[permission API] User ${username} is not a collaborator (404)`)
        return { hasAccess: false }
      }
      const errorText = await response.text()
      console.error(`[permission API] GitHub API error ${response.status}:`, errorText)
      throw new Error(`GitHub API returned ${response.status}`)
    }

    const data = await response.json()

    // Check if user has write or admin permission
    const hasAccess = data.permission === 'write' || data.permission === 'admin'

    console.log(`[permission API] User ${username} permission: ${data.permission}, hasAccess: ${hasAccess}`)

    return {
      hasAccess,
      permission: data.permission
    }
  } catch (error: any) {
    console.error('Failed to check repository permission:', error)
    return {
      hasAccess: false,
      error: error.message
    }
  }
})
