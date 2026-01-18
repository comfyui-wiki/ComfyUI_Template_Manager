/**
 * Compare a branch with upstream to check ahead/behind status
 * GET /api/github/branch/compare-upstream?owner=xxx&repo=xxx&branch=xxx
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const { owner, repo, branch } = getQuery(event)
  const config = useRuntimeConfig()

  if (!owner || !repo || !branch) {
    return {
      success: false,
      error: 'Owner, repo, and branch are required'
    }
  }

  // Get user session to use their access token
  const session = await getServerSession(event)

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ComfyUI-Template-CMS'
  }

  // Add authorization if user is authenticated
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
  }

  const upstreamOwner = config.public.repoOwner
  const upstreamRepo = config.public.repoName

  try {
    // Compare the branch with upstream's main branch
    // Format: base...head where base is upstream main, head is the branch
    const compareUrl = `https://api.github.com/repos/${upstreamOwner}/${upstreamRepo}/compare/main...${owner}:${repo}:${branch}`

    console.log(`[branch compare API] Comparing ${owner}/${repo}:${branch} with upstream ${upstreamOwner}/${upstreamRepo}:main`)
    console.log(`[branch compare API] URL: ${compareUrl}`)

    const response = await fetch(compareUrl, { headers })

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[branch compare API] Branch or comparison not found')
        return {
          success: false,
          error: 'Branch not found or comparison unavailable'
        }
      }
      const errorText = await response.text()
      console.error(`[branch compare API] GitHub API error ${response.status}:`, errorText)
      return {
        success: false,
        error: `GitHub API returned ${response.status}`
      }
    }

    const data = await response.json()

    console.log('[branch compare API] Comparison result:', {
      status: data.status,
      ahead_by: data.ahead_by,
      behind_by: data.behind_by,
      total_commits: data.total_commits
    })

    // status can be: "identical", "ahead", "behind", "diverged"
    return {
      success: true,
      status: data.status,
      aheadBy: data.ahead_by || 0,
      behindBy: data.behind_by || 0,
      totalCommits: data.total_commits || 0,
      isBehind: (data.behind_by || 0) > 0,
      isAhead: (data.ahead_by || 0) > 0,
      isDiverged: data.status === 'diverged'
    }
  } catch (error: any) {
    console.error('[branch compare API] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
