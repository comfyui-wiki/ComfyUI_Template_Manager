import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

interface CreatePRRequest {
  owner: string
  repo: string
  head: string // branch name to merge from (e.g., "username:feature-branch")
  base: string // branch to merge into (usually "main")
  title: string
  body?: string
}

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)

    if (!session?.accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Please sign in'
      })
    }

    const body = await readBody<CreatePRRequest>(event)
    const { owner, repo, head, base, title, body: prBody } = body

    if (!owner || !repo || !head || !base || !title) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      })
    }

    const octokit = new Octokit({ auth: session.accessToken })

    // Check if there's already an open PR for this branch
    const { data: existingPRs } = await octokit.pulls.list({
      owner,
      repo,
      head,
      state: 'open',
      per_page: 1
    })

    if (existingPRs.length > 0) {
      return {
        success: false,
        message: 'A pull request already exists for this branch',
        existingPR: {
          number: existingPRs[0].number,
          url: existingPRs[0].html_url,
          title: existingPRs[0].title
        }
      }
    }

    // Create the pull request
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      head,
      base,
      title,
      body: prBody || ''
    })

    return {
      success: true,
      message: 'Pull request created successfully',
      pr: {
        number: pr.number,
        url: pr.html_url,
        title: pr.title,
        body: pr.body
      }
    }

  } catch (error: any) {
    console.error('Error creating pull request:', error)

    if (error.statusCode) {
      throw error
    }

    // GitHub API specific errors
    if (error.status === 422) {
      throw createError({
        statusCode: 422,
        statusMessage: 'No commits between branches or PR already exists'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to create pull request'
    })
  }
})
