import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

interface LogoUpdateRequest {
  repo: string
  branch: string
  logoMapping: Record<string, string>
  files: Record<string, string> // logoPath -> base64Content
  deletedFiles?: string[] // logoPath to delete
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.accessToken) {
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
    const octokit = new Octokit({
      auth: session.accessToken
    })

    console.log(`[Logo Update] Starting update for repo: ${owner}/${repoName}, branch: ${branch}`)
    console.log(`[Logo Update] Logo mapping entries: ${Object.keys(logoMapping).length}`)
    console.log(`[Logo Update] Files to upload: ${Object.keys(files).length}`)
    console.log(`[Logo Update] Files to delete: ${deletedFiles.length}`)

    // Get current commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`
    })
    const currentCommitSha = refData.object.sha
    console.log(`[Logo Update] Current commit SHA: ${currentCommitSha}`)

    // Get current commit tree
    const { data: currentCommit } = await octokit.git.getCommit({
      owner,
      repo: repoName,
      commit_sha: currentCommitSha
    })
    const baseTreeSha = currentCommit.tree.sha

    // Prepare tree changes
    const treeChanges: Array<{
      path: string
      mode: '100644' | '100755' | '040000' | '160000' | '120000'
      type: 'blob' | 'tree' | 'commit'
      content?: string
      sha?: string | null
    }> = []

    // 1. Update index_logo.json
    const indexLogoContent = JSON.stringify(logoMapping, null, 2)
    treeChanges.push({
      path: 'templates/index_logo.json',
      mode: '100644',
      type: 'blob',
      content: indexLogoContent
    })
    console.log(`[Logo Update] Added index_logo.json to tree`)

    // 2. Add/Update logo files - Create blobs first
    for (const [logoPath, base64Content] of Object.entries(files)) {
      console.log(`[Logo Update] Processing file: ${logoPath}`)
      console.log(`[Logo Update] Base64 content length: ${base64Content.length}`)
      console.log(`[Logo Update] Base64 content start: ${base64Content.substring(0, 100)}`)

      // Validate base64 content
      if (!base64Content || base64Content.length === 0) {
        console.error(`[Logo Update] Empty base64 content for ${logoPath}`)
        continue
      }

      // Create blob with proper encoding
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

    // 3. Delete logo files - Add tree entry with null sha
    for (const logoPath of deletedFiles) {
      console.log(`[Logo Update] Deleting file: ${logoPath}`)
      treeChanges.push({
        path: `templates/${logoPath}`,
        mode: '100644',
        type: 'blob',
        sha: null
      })
      console.log(`[Logo Update] Marked logo file for deletion: ${logoPath}`)
    }

    // Create new tree
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      base_tree: baseTreeSha,
      tree: treeChanges
    })
    console.log(`[Logo Update] Created new tree: ${newTree.sha}`)

    // Create commit
    const commitMessage = [`Update provider logos`, '']
    commitMessage.push(`- Updated index_logo.json with ${Object.keys(logoMapping).length} providers`)
    if (Object.keys(files).length > 0) {
      commitMessage.push(`- Modified ${Object.keys(files).length} logo file(s)`)
    }
    if (deletedFiles.length > 0) {
      commitMessage.push(`- Deleted ${deletedFiles.length} logo file(s)`)
    }

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: commitMessage.join('\n'),
      tree: newTree.sha,
      parents: [currentCommitSha]
    })
    console.log(`[Logo Update] Created new commit: ${newCommit.sha}`)

    // Update branch reference
    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    })
    console.log(`[Logo Update] Updated branch reference`)

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
      statusCode: error.status || 500,
      message: error.message || 'Failed to update logos'
    })
  }
})
