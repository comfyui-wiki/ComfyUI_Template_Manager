/**
 * Check if a user can push to a specific branch
 * GET /api/github/branch-permission?owner=xxx&repo=xxx&branch=xxx
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const { owner, repo, branch } = getQuery(event)

  if (!owner || !repo || !branch) {
    return {
      canPush: false,
      error: 'Owner, repo, and branch are required'
    }
  }

  // Get user session to use their access token
  const session = await getServerSession(event)

  console.log('[branch-permission API] Session:', {
    exists: !!session,
    hasAccessToken: !!session?.accessToken,
    hasUser: !!session?.user,
    userLogin: session?.user?.login
  })

  if (!session?.accessToken || !session?.user?.login) {
    console.log('[branch-permission API] No access token found - session:', session ? 'exists but incomplete' : 'missing')
    return {
      canPush: false,
      error: 'Not authenticated'
    }
  }

  const username = session.user.login

  console.log(`[branch-permission API] Checking permission for ${username} on ${owner}/${repo}/${branch}`)

  try {
    // Check if user owns the repository (e.g., their fork)
    if (owner === username) {
      console.log(`[branch-permission API] User owns the repository`)

      // Check if branch is protected
      try {
        const protectionResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`,
          {
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'ComfyUI-Template-CMS'
            }
          }
        )

        if (protectionResponse.ok) {
          // Branch is protected
          const protection = await protectionResponse.json()
          console.log(`[branch-permission API] Branch ${branch} is protected:`, protection)

          // If user owns the repo and branch is protected, they still can't push directly
          // but they might be able to create PRs
          return {
            canPush: false,
            canCreatePR: true,
            isProtected: true,
            protection
          }
        } else if (protectionResponse.status === 404) {
          // Branch is not protected, user can push
          console.log(`[branch-permission API] Branch ${branch} is not protected, user can push`)
          return {
            canPush: true,
            canCreatePR: true,
            isProtected: false
          }
        }
      } catch (protectionError) {
        console.error('[branch-permission API] Error checking branch protection:', protectionError)
        // If we can't check protection, assume user can push since they own the repo
        return {
          canPush: true,
          canCreatePR: true,
          isProtected: false
        }
      }
    }

    // Check repository-level permission
    const permResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/collaborators/${username}/permission`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ComfyUI-Template-CMS'
        }
      }
    )

    if (!permResponse.ok) {
      if (permResponse.status === 404) {
        console.log(`[branch-permission API] User is not a collaborator`)
        return {
          canPush: false,
          canCreatePR: true, // Can still fork and create PR
          reason: 'Not a collaborator'
        }
      }
      throw new Error(`GitHub API returned ${permResponse.status}`)
    }

    const permData = await permResponse.json()
    const hasWriteAccess = permData.permission === 'write' || permData.permission === 'admin'

    console.log(`[branch-permission API] User permission: ${permData.permission}`)

    if (!hasWriteAccess) {
      return {
        canPush: false,
        canCreatePR: true,
        permission: permData.permission,
        reason: 'Insufficient repository permissions'
      }
    }

    // User has write access, check branch protection
    // First, check if branch is protected at all
    const branchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ComfyUI-Template-CMS'
        }
      }
    )

    if (!branchResponse.ok) {
      console.error('[branch-permission API] Failed to get branch info:', branchResponse.status)
      return {
        canPush: hasWriteAccess,
        canCreatePR: true,
        permission: permData.permission
      }
    }

    const branchData = await branchResponse.json()
    const isProtected = branchData.protected === true

    console.log(`[branch-permission API] Branch ${branch} protected status:`, isProtected)

    if (!isProtected) {
      // Branch is not protected, user can push
      return {
        canPush: true,
        canCreatePR: true,
        isProtected: false,
        permission: permData.permission
      }
    }

    // Branch is protected, check detailed rules
    // Try traditional branch protection API first
    try {
      const protectionResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'ComfyUI-Template-CMS'
          }
        }
      )

      if (protectionResponse.ok) {
        const protection = await protectionResponse.json()
        console.log(`[branch-permission API] Branch ${branch} is protected with rules:`, {
          enforce_admins: protection.enforce_admins?.enabled,
          required_pull_request_reviews: !!protection.required_pull_request_reviews,
          required_status_checks: !!protection.required_status_checks,
          required_signatures: !!protection.required_signatures,
          allow_force_pushes: protection.allow_force_pushes?.enabled,
          allow_deletions: protection.allow_deletions?.enabled
        })

        // Branch is protected - check if user can bypass
        // If enforce_admins is enabled, even admins can't push directly
        const enforceForAdmins = protection.enforce_admins?.enabled === true
        const requiresPR = !!protection.required_pull_request_reviews
        const requiresStatusChecks = !!protection.required_status_checks
        const hasRestrictions = !!protection.restrictions // Push access restrictions

        // Check if user is in the allowed list for push restrictions
        let allowedToPush = true
        if (hasRestrictions && protection.restrictions) {
          const restrictions = protection.restrictions
          const allowedUsers = restrictions.users?.map((u: any) => u.login) || []
          const allowedTeams = restrictions.teams?.map((t: any) => t.slug) || []

          // If there are restrictions, user must be in the allowed list
          allowedToPush = allowedUsers.includes(username)

          console.log(`[branch-permission API] Push restrictions:`, {
            allowedUsers,
            allowedTeams,
            userAllowed: allowedToPush
          })
        }

        // User can push directly if:
        // 1. No push restrictions OR user is in allowed list
        // 2. (enforce_admins is disabled AND user is admin) OR no PR required
        // 3. No required PR reviews
        const isAdmin = permData.permission === 'admin'

        // Most conservative approach: if branch is protected, assume can't push
        // unless explicitly allowed
        let canPush = false

        if (hasRestrictions) {
          // If there are push restrictions, only allowed users can push
          canPush = allowedToPush
        } else if (requiresPR) {
          // If PR reviews are required, can't push directly
          canPush = false
        } else if (enforceForAdmins) {
          // If protection is enforced for admins, can't push directly
          canPush = false
        } else if (isAdmin) {
          // Admin can push if no restrictions and no PR required
          canPush = true
        }

        console.log(`[branch-permission API] Protection analysis:`, {
          enforceForAdmins,
          requiresPR,
          requiresStatusChecks,
          hasRestrictions,
          allowedToPush: hasRestrictions ? allowedToPush : 'N/A',
          isAdmin,
          canPush
        })

        return {
          canPush,
          canCreatePR: true,
          isProtected: true,
          protection: {
            enforce_admins: enforceForAdmins,
            required_pull_request_reviews: requiresPR,
            required_status_checks: requiresStatusChecks,
            has_restrictions: hasRestrictions
          },
          permission: permData.permission
        }
      } else if (protectionResponse.status === 404) {
        // Traditional protection API returned 404
        // Branch might be using new Rulesets API instead
        console.log(`[branch-permission API] Traditional protection API returned 404, checking rulesets...`)

        try {
          // Check repository rulesets
          const rulesetsResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/rulesets`,
            {
              headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'ComfyUI-Template-CMS'
              }
            }
          )

          if (rulesetsResponse.ok) {
            const rulesets = await rulesetsResponse.json()
            console.log(`[branch-permission API] Found ${rulesets.length} rulesets`)

            // Check if any ruleset applies to this branch
            for (const ruleset of rulesets) {
              if (ruleset.enforcement !== 'active') continue

              // Check if ruleset targets this branch
              const refName = `refs/heads/${branch}`
              const includes = ruleset.conditions?.ref_name?.include || []
              const excludes = ruleset.conditions?.ref_name?.exclude || []

              const isIncluded = includes.some((pattern: string) => {
                // Simple pattern matching (you might need more sophisticated matching)
                return pattern === refName || pattern === `refs/heads/*`
              })

              const isExcluded = excludes.some((pattern: string) => {
                return pattern === refName
              })

              if (isIncluded && !isExcluded) {
                console.log(`[branch-permission API] Branch ${branch} is protected by ruleset: ${ruleset.name}`)

                // Fetch detailed rules
                try {
                  const rulesetDetailResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/rulesets/${ruleset.id}`,
                    {
                      headers: {
                        'Authorization': `Bearer ${session.accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'ComfyUI-Template-CMS'
                      }
                    }
                  )

                  if (rulesetDetailResponse.ok) {
                    const rulesetDetails = await rulesetDetailResponse.json()
                    const rules = rulesetDetails.rules || []

                    // Check for pull_request rule
                    const hasPRRule = rules.some((rule: any) => rule.type === 'pull_request')
                    const hasDeletionRule = rules.some((rule: any) => rule.type === 'deletion')
                    const hasNonFFRule = rules.some((rule: any) => rule.type === 'non_fast_forward')

                    console.log(`[branch-permission API] Ruleset rules:`, {
                      pull_request: hasPRRule,
                      deletion: hasDeletionRule,
                      non_fast_forward: hasNonFFRule
                    })

                    // If PR rule is present, can't push directly
                    return {
                      canPush: false,
                      canCreatePR: true,
                      isProtected: true,
                      protection: {
                        type: 'ruleset',
                        ruleset_name: ruleset.name,
                        requires_pull_request: hasPRRule,
                        blocks_deletions: hasDeletionRule,
                        blocks_force_push: hasNonFFRule
                      },
                      permission: permData.permission
                    }
                  }
                } catch (detailError) {
                  console.error('[branch-permission API] Error fetching ruleset details:', detailError)
                }

                // If we can't get details but found a ruleset, be conservative
                return {
                  canPush: false,
                  canCreatePR: true,
                  isProtected: true,
                  protection: {
                    type: 'ruleset',
                    ruleset_name: ruleset.name
                  },
                  permission: permData.permission
                }
              }
            }
          }

          console.log(`[branch-permission API] No rulesets found for branch ${branch}`)
        } catch (rulesetError) {
          console.error('[branch-permission API] Error checking rulesets:', rulesetError)
        }

        // If branch is marked as protected but we can't find rules, be conservative
        return {
          canPush: false,
          canCreatePR: true,
          isProtected: true,
          protection: {
            type: 'unknown',
            message: 'Branch is protected but details unavailable'
          },
          permission: permData.permission
        }
      }
    } catch (protectionError) {
      console.error('[branch-permission API] Error checking branch protection:', protectionError)
    }

    // Default: user has write access
    return {
      canPush: hasWriteAccess,
      canCreatePR: true,
      permission: permData.permission
    }

  } catch (error: any) {
    console.error('[branch-permission API] Error:', error)
    return {
      canPush: false,
      error: error.message
    }
  }
})
