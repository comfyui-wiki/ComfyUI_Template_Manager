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

    const body = await readBody(event)
    const { owner, repo, prNumber, title, description } = body

    if (!owner || !repo || !prNumber) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: owner, repo, prNumber'
      })
    }

    const octokit = new Octokit({ auth: session.accessToken })

    // Update PR
    const { data: pr } = await octokit.pulls.update({
      owner,
      repo,
      pull_number: Number(prNumber),
      title,
      body: description
    })

    return {
      success: true,
      pr: {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        url: pr.html_url
      }
    }

  } catch (error: any) {
    console.error('[PR Update] Error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || 'Failed to update PR'
    })
  }
})
