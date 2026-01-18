/**
 * Check if branches are merged into upstream
 * POST /api/github/fork/branch-status
 */
import { getServerSession } from '#auth'

interface BranchStatus {
  name: string
  isMerged: boolean
  status: 'ahead' | 'behind' | 'diverged' | 'identical'
  aheadBy: number
  behindBy: number
  canDelete: boolean
  message?: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const { branches } = body

  if (!branches || !Array.isArray(branches)) {
    return {
      success: false,
      error: 'Branches array is required'
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
  const upstreamOwner = config.public.repoOwner
  const upstreamRepo = config.public.repoName

  try {
    // Get fork's default branch
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

    console.log(`[branch-status API] Checking status for ${branches.length} branches`)

    // Check each branch
    const statuses: BranchStatus[] = await Promise.all(
      branches.map(async (branchName: string) => {
        try {
          // Don't check the default branch itself - it's the baseline
          if (branchName === defaultBranch) {
            return {
              name: branchName,
              isMerged: false,
              status: 'identical' as const,
              aheadBy: 0,
              behindBy: 0,
              canDelete: false,
              message: 'Default branch'
            }
          }

          // Compare branch with fork's default branch (not upstream!)
          // This tells us if this branch has been merged into the fork's main
          const compareUrl = `https://api.github.com/repos/${forkOwner}/${forkRepo}/compare/${defaultBranch}...${branchName}`

          const compareResponse = await fetch(compareUrl, {
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'ComfyUI-Template-CMS'
            }
          })

          if (!compareResponse.ok) {
            // If comparison fails, mark as not merged
            return {
              name: branchName,
              isMerged: false,
              status: 'diverged' as const,
              aheadBy: 0,
              behindBy: 0,
              canDelete: false,
              message: 'Unable to compare with main'
            }
          }

          const compareData = await compareResponse.json()

          // Branch is considered merged if:
          // 1. Status is 'identical' (branch is exactly same as main)
          // 2. Status is 'behind' (branch is behind main, all commits already in main)
          // 3. ahead_by is 0 and behind_by > 0 (no unique commits, just outdated)
          const isMerged =
            compareData.status === 'identical' ||
            compareData.status === 'behind' ||
            (compareData.ahead_by === 0 && compareData.behind_by > 0)

          const canDelete = isMerged && branchName !== defaultBranch

          return {
            name: branchName,
            isMerged,
            status: compareData.status,
            aheadBy: compareData.ahead_by || 0,
            behindBy: compareData.behind_by || 0,
            canDelete,
            message: isMerged
              ? 'All commits merged into main'
              : `${compareData.ahead_by || 0} commit(s) ahead of main`
          }
        } catch (error: any) {
          console.error(`[branch-status API] Error checking ${branchName}:`, error)
          return {
            name: branchName,
            isMerged: false,
            status: 'diverged' as const,
            aheadBy: 0,
            behindBy: 0,
            canDelete: false,
            message: 'Error checking status'
          }
        }
      })
    )

    console.log(`[branch-status API] Found ${statuses.filter(s => s.isMerged).length} merged branches`)

    return {
      success: true,
      statuses,
      defaultBranch
    }
  } catch (error: any) {
    console.error('[branch-status API] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
