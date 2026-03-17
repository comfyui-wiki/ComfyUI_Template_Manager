import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { formatTemplateJson } from '~/server/utils/json-formatter'

interface ThumbnailFieldRequest {
  repo: string
  branch: string
  templateName: string
  thumbnail: string[] // e.g. ["input/foo.jpg", "output/bar.png"]
  newFiles?: Array<{
    filename: string
    content: string // base64
  }>
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<ThumbnailFieldRequest>(event)
  const { repo, branch, templateName, thumbnail, newFiles } = body

  if (!repo || !branch || !templateName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  const [owner, repoName] = repo.split('/')
  const octokit = new Octokit({ auth: session.accessToken })

  // Get current commit SHA and tree
  const { data: refData } = await octokit.git.getRef({ owner, repo: repoName, ref: `heads/${branch}` })
  const currentCommitSha = refData.object.sha
  const { data: commitData } = await octokit.git.getCommit({ owner, repo: repoName, commit_sha: currentCommitSha })
  const currentTreeSha = commitData.tree.sha

  const tree: any[] = []

  // Load and update index.json
  const { data: indexFile } = await octokit.repos.getContent({
    owner, repo: repoName, path: 'templates/index.json', ref: branch
  })
  if (!('content' in indexFile)) {
    throw createError({ statusCode: 500, statusMessage: 'Invalid index.json structure' })
  }

  const indexData = JSON.parse(Buffer.from(indexFile.content, 'base64').toString('utf-8'))

  let found = false
  for (const category of indexData) {
    const template = category.templates?.find((t: any) => t.name === templateName)
    if (template) {
      if (thumbnail.length === 0) {
        delete template.thumbnail
      } else {
        template.thumbnail = thumbnail
      }
      found = true
      break
    }
  }

  if (!found) {
    throw createError({ statusCode: 404, statusMessage: `Template "${templateName}" not found in index.json` })
  }

  tree.push({
    path: 'templates/index.json',
    mode: '100644' as const,
    type: 'blob' as const,
    content: formatTemplateJson(indexData)
  })

  // Upload new files to thumbnail/ folder
  if (newFiles && newFiles.length > 0) {
    for (const file of newFiles) {
      const { data: blob } = await octokit.git.createBlob({
        owner, repo: repoName, content: file.content, encoding: 'base64'
      })
      tree.push({
        path: `thumbnail/${file.filename}`,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha
      })
    }
  }

  const { data: newTree } = await octokit.git.createTree({ owner, repo: repoName, tree, base_tree: currentTreeSha })
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo: repoName,
    message: `Update thumbnail field: ${templateName}\n\nUpdated via ComfyUI Template Manager`,
    tree: newTree.sha,
    parents: [currentCommitSha]
  })
  await octokit.git.updateRef({ owner, repo: repoName, ref: `heads/${branch}`, sha: newCommit.sha })

  return {
    success: true,
    commit: { sha: newCommit.sha, url: `https://github.com/${owner}/${repoName}/commit/${newCommit.sha}` }
  }
})
