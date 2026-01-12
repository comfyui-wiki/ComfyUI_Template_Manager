import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

interface UpdateBranchRequest {
  owner: string
  repo: string
  branch: string
  targetSha: string // The SHA to update to (usually PR head SHA)
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

    const body = await readBody<UpdateBranchRequest>(event)
    const { owner, repo, branch, targetSha } = body

    if (!owner || !repo || !branch || !targetSha) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      })
    }

    const octokit = new Octokit({ auth: session.accessToken })

    // Update the branch reference to point to the target SHA
    const { data: ref } = await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: targetSha,
      force: false // Don't force update to prevent losing commits
    })

    return {
      success: true,
      message: 'Branch updated successfully',
      ref: {
        ref: ref.ref,
        sha: ref.object.sha,
        url: ref.url
      }
    }

  } catch (error: any) {
    console.error('Error updating branch:', error)

    if (error.statusCode) {
      throw error
    }

    // GitHub API specific errors
    if (error.status === 422) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Cannot update branch: conflicts detected or non-fast-forward update'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update branch'
    })
  }
})
