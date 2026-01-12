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
    const { owner, repo, branch, pr_number } = query

    if (!owner || !repo || !branch || !pr_number) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters'
      })
    }

    const octokit = new Octokit({ auth: session.accessToken })

    // Get PR details
    const { data: pr } = await octokit.pulls.get({
      owner: owner as string,
      repo: repo as string,
      pull_number: Number(pr_number)
    })

    // Get local branch SHA
    const { data: branchData } = await octokit.repos.getBranch({
      owner: owner as string,
      repo: repo as string,
      branch: branch as string
    })

    const localSha = branchData.commit.sha
    const prHeadSha = pr.head.sha

    // Compare commits
    const needsUpdate = localSha !== prHeadSha

    let comparison = null
    if (needsUpdate) {
      try {
        // Compare local branch with PR head
        const { data: compareData } = await octokit.repos.compareCommitsWithBasehead({
          owner: owner as string,
          repo: repo as string,
          basehead: `${localSha}...${prHeadSha}`
        })

        comparison = {
          aheadBy: compareData.ahead_by, // How many commits PR is ahead
          behindBy: compareData.behind_by, // How many commits local is behind
          totalCommits: compareData.total_commits,
          commits: compareData.commits.map(c => ({
            sha: c.sha,
            message: c.commit.message,
            author: c.commit.author?.name,
            date: c.commit.author?.date
          }))
        }
      } catch (error) {
        console.warn('[Needs Update] Failed to compare commits:', error)
      }
    }

    return {
      needsUpdate,
      localSha,
      prHeadSha,
      comparison,
      pr: {
        number: pr.number,
        title: pr.title,
        html_url: pr.html_url,
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha
        }
      }
    }

  } catch (error: any) {
    console.error('Error checking if PR needs update:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to check PR update status'
    })
  }
})
