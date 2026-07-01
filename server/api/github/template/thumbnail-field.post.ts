import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { formatTemplateJson } from '~/server/utils/json-formatter'
import {
  createLocalOctokit,
  isLocalModeEnabled,
  writeLocalTreeAndCommit
} from '~/server/utils/local-template-persist'

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
  const localMode = isLocalModeEnabled()
  const session = await getServerSession(event)

  if (!localMode && !session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<ThumbnailFieldRequest>(event)
  const { repo, branch, templateName, thumbnail, newFiles } = body

  if (!templateName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  if (!localMode && (!repo || !branch)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing repo or branch' })
  }

  const [owner, repoName] = (repo || 'local/workflow_templates').split('/')
  const octokit = localMode
    ? createLocalOctokit()
    : new Octokit({ auth: session!.accessToken })

  let currentCommitSha = 'local'
  let currentTreeSha = 'local'

  if (!localMode) {
    const { data: refData } = await octokit.git.getRef({ owner, repo: repoName, ref: `heads/${branch}` })
    currentCommitSha = refData.object.sha
    const { data: commitData } = await octokit.git.getCommit({ owner, repo: repoName, commit_sha: currentCommitSha })
    currentTreeSha = commitData.tree.sha
  }

  const tree: any[] = []

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

  const commitMessage = `Update thumbnail field: ${templateName}\n\nUpdated via ComfyUI Template Manager`

  if (localMode) {
    const { sha } = await writeLocalTreeAndCommit(tree, commitMessage)
    return {
      success: true,
      commit: { sha, url: `local://${sha.substring(0, 7)}` }
    }
  }

  const { data: newTree } = await octokit.git.createTree({ owner, repo: repoName, tree, base_tree: currentTreeSha })
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo: repoName,
    message: commitMessage,
    tree: newTree.sha,
    parents: [currentCommitSha]
  })
  await octokit.git.updateRef({ owner, repo: repoName, ref: `heads/${branch}`, sha: newCommit.sha })

  return {
    success: true,
    commit: { sha: newCommit.sha, url: `https://github.com/${owner}/${repoName}/commit/${newCommit.sha}` }
  }
})
