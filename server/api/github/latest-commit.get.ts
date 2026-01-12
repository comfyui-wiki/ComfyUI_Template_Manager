import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)
    const query = getQuery(event)
    const { owner, repo, branch } = query

    if (!owner || !repo || !branch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: owner, repo, branch'
      })
    }

    // Use authenticated requests if available for higher rate limits
    const octokit = session?.accessToken
      ? new Octokit({ auth: session.accessToken })
      : new Octokit()

    // Get the latest commit on the branch
    const { data } = await octokit.repos.getBranch({
      owner: owner as string,
      repo: repo as string,
      branch: branch as string
    })

    return {
      sha: data.commit.sha,
      url: data.commit.url
    }
  } catch (error: any) {
    console.error('Error fetching latest commit:', error)
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || 'Failed to fetch latest commit'
    })
  }
})
