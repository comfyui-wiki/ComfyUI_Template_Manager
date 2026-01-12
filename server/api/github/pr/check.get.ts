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
    const { owner, repo, branch } = query

    if (!owner || !repo || !branch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: owner, repo, branch'
      })
    }

    const octokit = new Octokit({ auth: session.accessToken })

    // Check if there are any pull requests for this branch
    const { data: pullRequests } = await octokit.pulls.list({
      owner: owner as string,
      repo: repo as string,
      head: `${owner}:${branch}`,
      state: 'all', // Get both open and closed PRs
      per_page: 10
    })

    // Find the most recent PR for this branch
    const latestPR = pullRequests.length > 0 ? pullRequests[0] : null

    let status = 'none' // none, open, closed, merged
    let prNumber = null
    let prUrl = null
    let prTitle = null
    let isMerged = false

    if (latestPR) {
      prNumber = latestPR.number
      prUrl = latestPR.html_url
      prTitle = latestPR.title

      if (latestPR.state === 'closed') {
        // Check if it was merged or just closed
        const { data: prDetail } = await octokit.pulls.get({
          owner: owner as string,
          repo: repo as string,
          pull_number: prNumber
        })
        isMerged = prDetail.merged || false
        status = isMerged ? 'merged' : 'closed'
      } else {
        status = 'open'
      }
    }

    // Check if branch is ahead/behind the base branch
    let comparison = null
    try {
      const { data: compareData } = await octokit.repos.compareCommitsWithBasehead({
        owner: owner as string,
        repo: repo as string,
        basehead: `main...${owner}:${branch}`
      })
      comparison = {
        aheadBy: compareData.ahead_by,
        behindBy: compareData.behind_by,
        totalCommits: compareData.total_commits
      }
    } catch (error) {
      console.warn('[PR Check] Failed to compare branches:', error)
    }

    return {
      hasPR: status !== 'none',
      status,
      prNumber,
      prUrl,
      prTitle,
      isMerged,
      comparison
    }

  } catch (error: any) {
    console.error('Error checking PR status:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to check PR status'
    })
  }
})
