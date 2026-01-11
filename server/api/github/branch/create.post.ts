/**
 * Create a new branch in a repository
 * POST /api/github/branch/create
 * Body: { owner, repo, branch, from }
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const { owner, repo, branch, from = 'main' } = await readBody(event)

  if (!session || !session.accessToken) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized: Please sign in'
    })
  }

  if (!owner || !repo || !branch) {
    throw createError({
      statusCode: 400,
      message: 'Owner, repo, and branch name are required'
    })
  }

  try {
    // Step 1: Get the SHA of the source branch
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${from}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ComfyUI-Template-CMS'
        }
      }
    )

    if (!refResponse.ok) {
      throw new Error(`Failed to get source branch: ${refResponse.status}`)
    }

    const refData = await refResponse.json()
    const sha = refData.object.sha

    // Step 2: Create the new branch
    const createResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'ComfyUI-Template-CMS'
        },
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: sha
        })
      }
    )

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(error.message || `Failed to create branch: ${createResponse.status}`)
    }

    const data = await createResponse.json()

    return {
      success: true,
      branch: {
        name: branch,
        ref: data.ref,
        sha: data.object.sha
      }
    }
  } catch (error: any) {
    console.error('Failed to create branch:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to create branch'
    })
  }
})
