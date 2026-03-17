/**
 * List image files in a repo folder (input/, output/, thumbnail/)
 * GET /api/github/folder-files?repo=owner/repo&branch=main&folder=input
 */
import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

const IMAGE_EXT_RE = /\.(webp|jpg|jpeg|png|gif|avif|mp4|webm)$/i

export default defineEventHandler(async (event) => {
  const { repo, branch = 'main', folder } = getQuery(event)

  if (!repo || !folder) {
    throw createError({ statusCode: 400, statusMessage: 'repo and folder are required' })
  }

  const session = await getServerSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const [owner, repoName] = (repo as string).split('/')
  const octokit = new Octokit({ auth: session.accessToken })

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: folder as string,
      ref: branch as string
    })

    if (!Array.isArray(data)) return { files: [] }

    const files = data
      .filter(item => item.type === 'file' && IMAGE_EXT_RE.test(item.name))
      .map(item => item.name)
      .sort()

    return { files }
  } catch (error: any) {
    if (error.status === 404) return { files: [] }
    throw error
  }
})
