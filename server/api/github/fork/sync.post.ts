/**
 * Sync fork with upstream repository
 * POST /api/github/fork/sync
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Get user session to use their access token
  const session = await getServerSession(event)

  console.log('[fork sync API] Session:', {
    exists: !!session,
    hasAccessToken: !!session?.accessToken,
    userLogin: session?.user?.login
  })

  if (!session?.accessToken || !session?.user?.login) {
    console.log('[fork sync API] No access token or username')
    return {
      success: false,
      error: 'Not authenticated'
    }
  }

  const username = session.user.login
  const forkOwner = username
  const forkRepo = config.public.repoName

  try {
    // Use GitHub's merge-upstream API to sync fork
    // This merges the upstream's default branch into the fork's default branch
    const syncUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}/merge-upstream`

    console.log(`[fork sync API] Syncing fork ${forkOwner}/${forkRepo} with upstream`)
    console.log(`[fork sync API] URL: ${syncUrl}`)

    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ComfyUI-Template-CMS',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: 'main' // The branch in the fork to update
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`[fork sync API] GitHub API error ${response.status}:`, errorData)

      // Handle specific error cases
      if (response.status === 409) {
        // Conflict - fork might be ahead or diverged
        return {
          success: false,
          error: 'Fork has diverged from upstream. Manual merge required.',
          needsManualMerge: true
        }
      } else if (response.status === 422) {
        // Check if it's a workflow permission issue
        const errorMessage = errorData.message || ''
        if (errorMessage.includes('workflow scope') || errorMessage.includes('workflow ')) {
          return {
            success: false,
            error: 'Cannot sync: upstream contains workflow changes but OAuth token lacks workflow permission. Please sync manually on GitHub.',
            needsWorkflowPermission: true
          }
        }

        // Already up to date
        return {
          success: true,
          message: 'Fork is already up to date',
          alreadyUpToDate: true
        }
      }

      throw new Error(errorData.message || `GitHub API returned ${response.status}`)
    }

    const data = await response.json()

    console.log('[fork sync API] Sync successful:', {
      message: data.message,
      merge_type: data.merge_type,
      base_branch: data.base_branch
    })

    return {
      success: true,
      message: data.message || 'Fork synced successfully',
      mergeType: data.merge_type,
      baseBranch: data.base_branch
    }
  } catch (error: any) {
    console.error('[fork sync API] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
