/**
 * Compare fork with upstream to check if it's behind
 * GET /api/github/fork/compare?username=xxx
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const { username } = getQuery(event)
  const config = useRuntimeConfig()

  if (!username) {
    return {
      error: 'Username is required'
    }
  }

  // Get user session to use their access token
  const session = await getServerSession(event)

  console.log('[fork compare API] Session:', {
    exists: !!session,
    hasAccessToken: !!session?.accessToken,
    userLogin: session?.user?.login
  })

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ComfyUI-Template-CMS'
  }

  // Add authorization if user is authenticated
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
    console.log('[fork compare API] Using authenticated request')
  }

  const forkRepo = `${username}/${config.public.repoName}`
  const upstreamRepo = `${config.public.repoOwner}/${config.public.repoName}`

  try {
    // Compare the fork's default branch with upstream's default branch
    // Format: base...head where base is what we're comparing to (upstream)
    const compareUrl = `https://api.github.com/repos/${upstreamRepo}/compare/main...${username}:${config.public.repoName}:main`

    console.log(`[fork compare API] Comparing fork ${forkRepo} with upstream ${upstreamRepo}`)
    console.log(`[fork compare API] URL: ${compareUrl}`)

    const response = await fetch(compareUrl, { headers })

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[fork compare API] Fork or comparison not found')
        return {
          error: 'Fork not found or comparison unavailable'
        }
      }
      const errorText = await response.text()
      console.error(`[fork compare API] GitHub API error ${response.status}:`, errorText)
      throw new Error(`GitHub API returned ${response.status}`)
    }

    const data = await response.json()

    console.log('[fork compare API] Comparison result:', {
      status: data.status,
      ahead_by: data.ahead_by,
      behind_by: data.behind_by,
      total_commits: data.total_commits
    })

    // status can be: "identical", "ahead", "behind", "diverged"
    return {
      status: data.status,
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
      totalCommits: data.total_commits,
      isBehind: data.behind_by > 0,
      isAhead: data.ahead_by > 0,
      isDiverged: data.status === 'diverged'
    }
  } catch (error: any) {
    console.error('[fork compare API] Error:', error)
    return {
      error: error.message
    }
  }
})
