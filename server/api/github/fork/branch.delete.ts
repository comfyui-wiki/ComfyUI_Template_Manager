/**
 * Delete a branch from the fork repository
 * DELETE /api/github/fork/branch
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const { branch } = body

  if (!branch) {
    return {
      success: false,
      error: 'Branch name is required'
    }
  }

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
    // Get repository info to check default branch
    const repoUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}`
    const repoResponse = await fetch(repoUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ComfyUI-Template-CMS'
      }
    })

    if (!repoResponse.ok) {
      throw new Error('Failed to get repository information')
    }

    const repoData = await repoResponse.json()
    const defaultBranch = repoData.default_branch || 'main'

    // Prevent deleting the default branch
    if (branch === defaultBranch) {
      return {
        success: false,
        error: `Cannot delete the default branch: ${defaultBranch}`
      }
    }

    // Delete the branch using GitHub API
    const deleteUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}/git/refs/heads/${branch}`

    console.log(`[branch delete API] Deleting branch ${branch} from ${forkOwner}/${forkRepo}`)

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ComfyUI-Template-CMS'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`[branch delete API] GitHub API error ${response.status}:`, errorData)

      if (response.status === 404) {
        return {
          success: false,
          error: `Branch "${branch}" not found`
        }
      }

      throw new Error(errorData.message || `GitHub API returned ${response.status}`)
    }

    console.log(`[branch delete API] Branch ${branch} deleted successfully`)

    return {
      success: true,
      message: `Branch "${branch}" deleted successfully`,
      deletedBranch: branch
    }
  } catch (error: any) {
    console.error('[branch delete API] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
