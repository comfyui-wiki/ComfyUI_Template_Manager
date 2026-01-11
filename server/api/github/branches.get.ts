/**
 * Get list of branches for a repository
 * GET /api/github/branches?owner=xxx&repo=xxx
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const { owner, repo } = getQuery(event)

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: 'Owner and repo are required'
    })
  }

  // Try to get user session for authenticated requests
  const session = await getServerSession(event)

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ComfyUI-Template-CMS'
  }

  // Add authorization if user is authenticated
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
    console.log(`[branches API] Using authenticated request for ${owner}/${repo}`)
  } else {
    console.log(`[branches API] Using unauthenticated request for ${owner}/${repo}`)
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      { headers }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[branches API] GitHub API error ${response.status}:`, errorText)
      throw new Error(`GitHub API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // Get repository info to find default branch
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers }
    )

    let defaultBranch = 'main'
    if (repoResponse.ok) {
      const repoData = await repoResponse.json()
      defaultBranch = repoData.default_branch
    }

    const branches = data.map((branch: any) => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha,
        url: branch.commit.url
      },
      protected: branch.protected,
      isDefault: branch.name === defaultBranch
    }))

    return {
      branches,
      defaultBranch
    }
  } catch (error: any) {
    console.error('Failed to get branches:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to get branches'
    })
  }
})
