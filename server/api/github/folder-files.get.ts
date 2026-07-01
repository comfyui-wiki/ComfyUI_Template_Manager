/**
 * List image files in a repo folder (input/, output/, thumbnail/)
 * GET /api/github/folder-files?repo=owner/repo&branch=main&folder=input
 */
import { readdir } from 'fs/promises'
import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { isLocalRepoMode, resolveRepoPath } from '~/server/utils/local-repo'

const IMAGE_EXT_RE = /\.(webp|jpg|jpeg|png|gif|avif|mp4|webm)$/i

async function listLocalFolderFiles(folder: string): Promise<string[]> {
  try {
    const dir = resolveRepoPath(folder)
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && IMAGE_EXT_RE.test(entry.name))
      .map(entry => entry.name)
      .sort()
  } catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  const { repo, branch = 'main', folder } = getQuery(event)

  if (!folder) {
    throw createError({ statusCode: 400, statusMessage: 'folder is required' })
  }

  if (isLocalRepoMode()) {
    return { files: await listLocalFolderFiles(folder as string) }
  }

  if (!repo) {
    throw createError({ statusCode: 400, statusMessage: 'repo is required' })
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
