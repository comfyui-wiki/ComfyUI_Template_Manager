/**
 * Reset fork's main branch to upstream
 * POST /api/github/fork/reset-main
 *
 * Options:
 * - saveToNewBranch: boolean - If true, create a new branch with current changes before resetting
 * - newBranchName: string - Name for the new branch (if saveToNewBranch is true)
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  // Get user session to use their access token
  const session = await getServerSession(event)

  if (!session?.accessToken || !session?.user?.login) {
    return {
      success: false,
      error: 'Not authenticated'
    }
  }

  const { saveToNewBranch = false, newBranchName } = body
  const username = session.user.login
  const forkOwner = username
  const forkRepo = config.public.repoName
  const upstreamOwner = config.public.repoOwner

  console.log(`[reset-main API] Request from user: ${username}`)
  console.log(`[reset-main API] Target fork: ${forkOwner}/${forkRepo}`)
  console.log(`[reset-main API] Upstream: ${upstreamOwner}/${forkRepo}`)
  console.log(`[reset-main API] Save to new branch: ${saveToNewBranch}`)

  try {
    const headers = {
      'Authorization': `Bearer ${session.accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ComfyUI-Template-CMS',
      'Content-Type': 'application/json'
    }

    // Step 0: Verify fork repository exists
    const forkRepoUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}`
    console.log(`[reset-main API] Checking if fork exists: ${forkRepoUrl}`)

    const forkRepoResponse = await fetch(forkRepoUrl, { headers })
    if (!forkRepoResponse.ok) {
      if (forkRepoResponse.status === 404) {
        throw new Error(
          `Fork repository ${forkOwner}/${forkRepo} not found. ` +
          `Please create a fork of ${upstreamOwner}/${forkRepo} first.`
        )
      }
      const errorData = await forkRepoResponse.json().catch(() => ({}))
      throw new Error(`Failed to check fork repository: ${errorData.message || forkRepoResponse.status}`)
    }

    const forkRepoData = await forkRepoResponse.json()
    console.log(`[reset-main API] Fork exists. Default branch: ${forkRepoData.default_branch}`)

    // Check if it's actually a fork
    if (!forkRepoData.fork) {
      console.warn(`[reset-main API] Warning: ${forkOwner}/${forkRepo} is not marked as a fork`)
    }

    // Step 1: Get upstream's main branch SHA
    const upstreamRefUrl = `https://api.github.com/repos/${upstreamOwner}/${forkRepo}/git/refs/heads/main`
    console.log(`[reset-main API] Getting upstream main SHA from: ${upstreamRefUrl}`)

    const upstreamRefResponse = await fetch(upstreamRefUrl, { headers })
    if (!upstreamRefResponse.ok) {
      const errorData = await upstreamRefResponse.json().catch(() => ({}))
      throw new Error(`Failed to get upstream ref: ${errorData.message || upstreamRefResponse.status}`)
    }
    const upstreamRef = await upstreamRefResponse.json()
    const upstreamSha = upstreamRef.object.sha

    console.log(`[reset-main API] Upstream main SHA: ${upstreamSha}`)

    // Step 2: Get current fork's main branch SHA and optionally create backup branch
    const forkRefUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}/git/refs/heads/main`
    console.log(`[reset-main API] Getting fork's main branch from: ${forkRefUrl}`)

    const forkRefResponse = await fetch(forkRefUrl, { headers })
    if (!forkRefResponse.ok) {
      if (forkRefResponse.status === 404) {
        throw new Error(`Fork ${forkOwner}/${forkRepo} or main branch not found. Please make sure your fork exists.`)
      }
      const errorData = await forkRefResponse.json().catch(() => ({}))
      throw new Error(`Failed to get fork ref: ${errorData.message || forkRefResponse.status}`)
    }
    const forkRef = await forkRefResponse.json()
    const forkMainSha = forkRef.object.sha
    console.log(`[reset-main API] Fork main SHA: ${forkMainSha}`)

    // Step 3: If saveToNewBranch, create a new branch with current fork's main
    let createdBranch = null
    if (saveToNewBranch) {
      if (!newBranchName) {
        return {
          success: false,
          error: 'newBranchName is required when saveToNewBranch is true'
        }
      }

      // Create new branch from current fork's main
      const createBranchUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}/git/refs`
      console.log(`[reset-main API] Creating backup branch: ${newBranchName} from SHA: ${forkMainSha}`)

      const createBranchResponse = await fetch(createBranchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${newBranchName}`,
          sha: forkMainSha
        })
      })

      if (!createBranchResponse.ok) {
        const errorData = await createBranchResponse.json().catch(() => ({}))
        console.error(`[reset-main API] Failed to create branch. Status: ${createBranchResponse.status}, Error:`, errorData)
        throw new Error(`Failed to create branch: ${errorData.message || createBranchResponse.status}`)
      }

      createdBranch = newBranchName
      console.log(`[reset-main API] Successfully created backup branch: ${newBranchName}`)
    }

    // Step 4: Force update fork's main branch to upstream's SHA
    // Using GitHub's update reference API with public_repo scope
    const updateRefUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}/git/refs/heads/main`
    console.log(`[reset-main API] Resetting fork main to upstream SHA: ${upstreamSha}`)
    console.log(`[reset-main API] Update URL: ${updateRefUrl}`)

    const updateResponse = await fetch(updateRefUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: upstreamSha,
        force: true
      })
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}))
      console.error(`[reset-main API] Failed to update ref. Status: ${updateResponse.status}, Error:`, errorData)

      // Detailed error handling
      if (updateResponse.status === 403) {
        // Permission issue - but we're using public_repo which should be sufficient
        throw new Error(
          `GitHub permission denied. This usually means:\n\n` +
          `1. Your fork might not exist\n` +
          `2. The repository is private (this app only works with public repos)\n` +
          `3. You need to re-authenticate\n\n` +
          `Please ensure your fork is public and try logging out and back in.`
        )
      } else if (updateResponse.status === 404) {
        throw new Error(
          `Branch not found: ${forkOwner}/${forkRepo}/main\n\n` +
          `Please verify:\n` +
          `1. Your fork exists at github.com/${forkOwner}/${forkRepo}\n` +
          `2. The main branch exists in your fork\n` +
          `3. Your fork is a public repository`
        )
      } else if (updateResponse.status === 422) {
        // Validation error
        throw new Error(
          `GitHub API validation error: ${errorData.message || 'Invalid request'}\n\n` +
          `This might mean the SHA is invalid or the branch is protected.`
        )
      }

      throw new Error(`Failed to reset main branch: ${errorData.message || updateResponse.status}`)
    }

    const updateData = await updateResponse.json()
    console.log(`[reset-main API] Successfully updated ref to:`, updateData.object.sha)

    console.log('[reset-main API] Successfully reset main branch to upstream')

    return {
      success: true,
      message: createdBranch
        ? `Main branch reset to upstream. Your changes were saved to branch "${createdBranch}"`
        : 'Main branch reset to upstream',
      createdBranch,
      upstreamSha
    }
  } catch (error: any) {
    console.error('[reset-main API] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
