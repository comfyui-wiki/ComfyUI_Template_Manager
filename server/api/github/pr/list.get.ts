import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)

    if (!session?.accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Please sign in'
      })
    }

    const query = getQuery(event)
    const { owner, repo, state = 'open', per_page = 20, page = 1 } = query

    if (!owner || !repo) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: owner, repo'
      })
    }

    const octokit = new Octokit({ auth: session.accessToken })

    // Get pull requests
    const { data: pullRequests } = await octokit.pulls.list({
      owner: owner as string,
      repo: repo as string,
      state: state as 'open' | 'closed' | 'all',
      per_page: Number(per_page),
      page: Number(page),
      sort: 'updated',
      direction: 'desc'
    })

    // Enrich PR data with additional info
    const enrichedPRs = await Promise.all(
      pullRequests.map(async (pr) => {
        let isMerged = false
        if (pr.state === 'closed') {
          try {
            const { data: prDetail } = await octokit.pulls.get({
              owner: owner as string,
              repo: repo as string,
              pull_number: pr.number
            })
            isMerged = prDetail.merged || false
          } catch (error) {
            console.warn(`Failed to get merge status for PR #${pr.number}`)
          }
        }

        return {
          number: pr.number,
          title: pr.title,
          state: pr.state,
          isMerged,
          status: pr.state === 'closed' ? (isMerged ? 'merged' : 'closed') : 'open',
          user: {
            login: pr.user?.login,
            avatar_url: pr.user?.avatar_url,
            html_url: pr.user?.html_url
          },
          head: {
            ref: pr.head.ref,
            sha: pr.head.sha,
            repo: pr.head.repo ? {
              full_name: pr.head.repo.full_name,
              owner: pr.head.repo.owner.login
            } : null
          },
          base: {
            ref: pr.base.ref,
            sha: pr.base.sha
          },
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          closed_at: pr.closed_at,
          merged_at: pr.merged_at,
          html_url: pr.html_url,
          comments: pr.comments,
          commits: pr.commits,
          additions: pr.additions,
          deletions: pr.deletions,
          changed_files: pr.changed_files,
          draft: pr.draft,
          body: pr.body
        }
      })
    )

    return {
      pullRequests: enrichedPRs,
      total: enrichedPRs.length
    }

  } catch (error: any) {
    console.error('Error listing pull requests:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to list pull requests'
    })
  }
})
