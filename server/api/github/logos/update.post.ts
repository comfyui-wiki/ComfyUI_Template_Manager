import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import {
  createLocalOctokit,
  isLocalModeEnabled,
  writeLocalTreeAndCommit
} from '~/server/utils/local-template-persist'

interface LogoUpdateRequest {
  repo: string
  branch: string
  logoMapping: Record<string, string>
  files: Record<string, string> // logoPath -> base64Content
  deletedFiles?: string[] // logoPath to delete
}

export default defineEventHandler(async (event) => {
  const localMode = isLocalModeEnabled()
  const session = await getServerSession(event)

  if (!localMode && !session?.accessToken) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized: No access token'
    })
  }

  const body = await readBody<LogoUpdateRequest>(event)
  const { repo, branch, logoMapping, files, deletedFiles = [] } = body

  if (!repo || !branch || !logoMapping) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: repo, branch, logoMapping'
    })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw createError({
      statusCode: 400,
      message: 'Invalid repository format. Expected: owner/repo'
    })
  }

  try {
    const octokit = localMode
      ? createLocalOctokit()
      : new Octokit({ auth: session!.accessToken })

    console.log(`[Logo Update] Starting update for repo: ${owner}/${repoName}, branch: ${branch}${localMode ? ' (local)' : ''}`)
    console.log(`[Logo Update] Logo mapping entries: ${Object.keys(logoMapping).length}`)
    console.log(`[Logo Update] Files to upload: ${Object.keys(files || {}).length}`)
    console.log(`[Logo Update] Files to delete: ${deletedFiles.length}`)

    let currentCommitSha = 'local'
    let baseTreeSha = 'local'

    if (!localMode) {
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo: repoName,
        ref: `heads/${branch}`
      })
      currentCommitSha = refData.object.sha
      console.log(`[Logo Update] Current commit SHA: ${currentCommitSha}`)

      const { data: currentCommit } = await octokit.git.getCommit({
        owner,
        repo: repoName,
        commit_sha: currentCommitSha
      })
      baseTreeSha = currentCommit.tree.sha
    }

    const treeChanges: Array<{
      path: string
      mode: '100644' | '100755' | '040000' | '160000' | '120000'
      type: 'blob' | 'tree' | 'commit'
      content?: string
      sha?: string | null
    }> = []

    // 1. Update index_logo.json
    treeChanges.push({
      path: 'templates/index_logo.json',
      mode: '100644',
      type: 'blob',
      content: JSON.stringify(logoMapping, null, 2)
    })
    console.log('[Logo Update] Added index_logo.json to tree')

    // 2. Add/Update logo files
    for (const [logoPath, base64Content] of Object.entries(files || {})) {
      console.log(`[Logo Update] Processing file: ${logoPath}`)

      if (!base64Content || base64Content.length === 0) {
        console.error(`[Logo Update] Empty base64 content for ${logoPath}`)
        continue
      }

      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo: repoName,
        content: base64Content,
        encoding: 'base64'
      })

      treeChanges.push({
        path: `templates/${logoPath}`,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      })
      console.log(`[Logo Update] Added logo file: ${logoPath} (blob: ${blob.sha})`)
    }

    // 3. Delete logo files
    for (const logoPath of deletedFiles) {
      console.log(`[Logo Update] Deleting file: ${logoPath}`)
      treeChanges.push({
        path: `templates/${logoPath}`,
        mode: '100644',
        type: 'blob',
        sha: null
      })
    }

    const commitMessage = [
      'Update provider logos',
      '',
      `- Updated index_logo.json with ${Object.keys(logoMapping).length} providers`,
      ...(Object.keys(files || {}).length > 0
        ? [`- Modified ${Object.keys(files).length} logo file(s)`]
        : []),
      ...(deletedFiles.length > 0
        ? [`- Deleted ${deletedFiles.length} logo file(s)`]
        : [])
    ].join('\n')

    if (localMode) {
      const { sha } = await writeLocalTreeAndCommit(treeChanges, commitMessage)
      console.log(`[Logo Update] Local commit: ${sha}`)
      return {
        success: true,
        message: 'Logos updated successfully',
        commit: {
          sha,
          url: `local://${sha.substring(0, 7)}`
        }
      }
    }

    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      base_tree: baseTreeSha,
      tree: treeChanges
    })
    console.log(`[Logo Update] Created new tree: ${newTree.sha}`)

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: commitMessage,
      tree: newTree.sha,
      parents: [currentCommitSha]
    })
    console.log(`[Logo Update] Created new commit: ${newCommit.sha}`)

    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    })
    console.log('[Logo Update] Updated branch reference')

    return {
      success: true,
      message: 'Logos updated successfully',
      commit: {
        sha: newCommit.sha,
        url: newCommit.html_url
      }
    }
  } catch (error: any) {
    console.error('[Logo Update] Error:', error)
    throw createError({
      statusCode: error.statusCode || error.status || 500,
      message: error.message || 'Failed to update logos'
    })
  }
})
