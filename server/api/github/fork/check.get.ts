/**
 * Check if a user has forked the repository
 * GET /api/github/fork/check?username=xxx
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const { username } = getQuery(event)
  const config = useRuntimeConfig()

  if (!username) {
    return {
      exists: false,
      error: 'Username is required'
    }
  }

  // Get user session to use their access token
  const session = await getServerSession(event)

  console.log('[fork check API] Session:', {
    exists: !!session,
    hasAccessToken: !!session?.accessToken,
    hasUser: !!session?.user,
    userLogin: session?.user?.login
  })

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ComfyUI-Template-CMS'
  }

  // Add authorization if user is authenticated
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
    console.log('[fork check API] Using authenticated request')
  } else {
    console.log('[fork check API] No access token, using unauthenticated request')
  }

  const checkUrl = `https://api.github.com/repos/${username}/${config.public.repoName}`
  console.log(`[fork check API] Checking fork for user ${username}`)
  console.log(`[fork check API] URL: ${checkUrl}`)
  console.log(`[fork check API] Expected parent: ${config.public.repoOwner}/${config.public.repoName}`)

  try {
    // Check if the fork exists
    const response = await fetch(checkUrl, { headers })

    console.log(`[fork check API] Response status: ${response.status}`)

    if (!response.ok) {
      if (response.status === 404) {
        // Fork does not exist
        console.log(`[fork check API] Fork not found for user ${username} (404)`)
        return { exists: false }
      }
      const errorText = await response.text()
      console.error(`[fork check API] GitHub API error ${response.status}:`, errorText)
      throw new Error(`GitHub API returned ${response.status}`)
    }

    const data = await response.json()

    console.log(`[fork check API] Repository data:`, {
      name: data.name,
      fullName: data.full_name,
      isFork: data.fork,
      parentFullName: data.parent?.full_name
    })

    // Check if it's actually a fork of the main repo
    const isFork = data.fork &&
                   data.parent?.full_name === `${config.public.repoOwner}/${config.public.repoName}`

    console.log(`[fork check API] Repository ${username}/${config.public.repoName} exists. Is fork: ${isFork}, Parent: ${data.parent?.full_name}`)

    return {
      exists: isFork,
      fork: isFork ? {
        name: data.name,
        fullName: data.full_name,
        owner: data.owner.login,
        defaultBranch: data.default_branch,
        url: data.html_url
      } : null
    }
  } catch (error: any) {
    console.error('Failed to check fork:', error)
    return {
      exists: false,
      error: error.message
    }
  }
})
