/**
 * List all branches in the fork repository
 * GET /api/github/fork/branches
 */
import { getServerSession } from '#auth'

interface BranchInfo {
  name: string
  sha: string
  protected: boolean
  isCurrent?: boolean
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Get user session to use their access token
  const session = await getServerSession(event)

  if (!session?.accessToken || !session?.user?.login) {
    return {
      success: false,
      error: 'Not authenticated'
    }
  }

  const username = session.user.login
  const forkOwner = username
  const forkRepo = config.public.repoName

  try {
    // Get all branches
    const branchesUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}/branches`

    console.log(`[branches API] Fetching branches for ${forkOwner}/${forkRepo}`)

    const response = await fetch(branchesUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ComfyUI-Template-CMS'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`[branches API] GitHub API error ${response.status}:`, errorData)
      throw new Error(errorData.message || `GitHub API returned ${response.status}`)
    }

    const branches = await response.json()

    // Get current default branch
    const repoUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}`
    const repoResponse = await fetch(repoUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ComfyUI-Template-CMS'
      }
    })

    const repoData = await repoResponse.json()
    const defaultBranch = repoData.default_branch || 'main'

    // Format branch data
    const branchList: BranchInfo[] = branches.map((branch: any) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
      isCurrent: branch.name === defaultBranch
    }))

    console.log(`[branches API] Found ${branchList.length} branches`)

    return {
      success: true,
      branches: branchList,
      defaultBranch
    }
  } catch (error: any) {
    console.error('[branches API] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
