/**
 * Force reset a branch to upstream's latest commit
 * POST /api/github/branch/reset-to-upstream
 *
 * Body: { owner, repo, branch, upstreamBranch?, saveToNewBranch?, newBranchName? }
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = await getServerSession(event)

  if (!session?.accessToken || !session?.user?.login) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized - Please sign in' })
  }

  const body = await readBody(event)
  const {
    owner,
    repo,
    branch,
    upstreamBranch = 'main',
    saveToNewBranch = false,
    newBranchName
  } = body

  if (!owner || !repo || !branch) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters: owner, repo, branch'
    })
  }

  if (saveToNewBranch && !newBranchName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'newBranchName is required when saveToNewBranch is true'
    })
  }

  const username = session.user.login
  const upstreamOwner = config.public.repoOwner
  const upstreamRepo = config.public.repoName

  // Only allow resetting repos the user owns (fork) or has collaborator write access
  if (owner !== username) {
    const permResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/collaborators/${username}/permission`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'ComfyUI-Template-CMS'
        }
      }
    )
    const permData = permResponse.ok ? await permResponse.json() : null
    if (!permResponse.ok || !['write', 'admin'].includes(permData?.permission)) {
      throw createError({ statusCode: 403, statusMessage: 'You do not have write access to this repository' })
    }
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ComfyUI-Template-CMS',
    'Content-Type': 'application/json'
  }

  console.log(`[reset-to-upstream] Resetting ${owner}/${repo}:${branch} to ${upstreamOwner}/${upstreamRepo}:${upstreamBranch}`)

  try {
    // Check branch is not protected
    const branchInfoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
      { headers }
    )
    if (!branchInfoResponse.ok) {
      if (branchInfoResponse.status === 404) {
        throw createError({ statusCode: 404, statusMessage: `Branch "${branch}" not found` })
      }
      throw new Error(`Failed to get branch info: ${branchInfoResponse.status}`)
    }
    const branchInfo = await branchInfoResponse.json()
    if (branchInfo.protected) {
      throw createError({ statusCode: 403, statusMessage: `Branch "${branch}" is protected and cannot be reset` })
    }

    // Get upstream branch SHA
    const upstreamRefResponse = await fetch(
      `https://api.github.com/repos/${upstreamOwner}/${upstreamRepo}/git/refs/heads/${upstreamBranch}`,
      { headers }
    )
    if (!upstreamRefResponse.ok) {
      throw new Error(`Failed to get upstream ref: ${upstreamRefResponse.status}`)
    }
    const upstreamRef = await upstreamRefResponse.json()
    const upstreamSha = upstreamRef.object.sha

    // Get current branch SHA
    const branchRefResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
      { headers }
    )
    if (!branchRefResponse.ok) {
      throw new Error(`Failed to get branch ref: ${branchRefResponse.status}`)
    }
    const branchRef = await branchRefResponse.json()
    const currentSha = branchRef.object.sha

    if (currentSha === upstreamSha) {
      return {
        success: true,
        message: 'Branch is already up to date with upstream',
        alreadyUpToDate: true,
        upstreamSha
      }
    }

    // Optionally save current state to a backup branch
    let createdBranch: string | null = null
    if (saveToNewBranch) {
      const createBranchResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ref: `refs/heads/${newBranchName}`,
            sha: currentSha
          })
        }
      )

      if (!createBranchResponse.ok) {
        const errorData = await createBranchResponse.json().catch(() => ({}))
        throw new Error(`Failed to create backup branch: ${errorData.message || createBranchResponse.status}`)
      }

      createdBranch = newBranchName
      console.log(`[reset-to-upstream] Created backup branch: ${newBranchName}`)
    }

    // Force reset branch to upstream SHA
    const updateResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: upstreamSha,
          force: true
        })
      }
    )

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}))
      if (updateResponse.status === 403) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Permission denied. Try signing out and back in to refresh your GitHub token.'
        })
      }
      throw new Error(`Failed to reset branch: ${errorData.message || updateResponse.status}`)
    }

    console.log(`[reset-to-upstream] Successfully reset ${branch} to upstream ${upstreamSha}`)

    return {
      success: true,
      message: createdBranch
        ? `Branch "${branch}" reset to upstream. Backup saved as "${createdBranch}"`
        : `Branch "${branch}" reset to upstream latest`,
      createdBranch,
      upstreamSha,
      previousSha: currentSha
    }
  } catch (error: any) {
    console.error('[reset-to-upstream] Error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to reset branch to upstream'
    })
  }
})
