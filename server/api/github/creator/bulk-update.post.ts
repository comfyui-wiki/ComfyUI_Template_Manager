import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { formatTemplateJson } from '~/server/utils/json-formatter'

const localeFiles = [
  'index.json',
  'index.zh.json',
  'index.zh-TW.json',
  'index.ja.json',
  'index.ko.json',
  'index.es.json',
  'index.fr.json',
  'index.ru.json',
  'index.tr.json',
  'index.ar.json',
  'index.pt-BR.json'
]

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)

    if (!session?.accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Please sign in'
      })
    }

    const body = await readBody<{
      repo: string
      branch: string
      updates: Array<{ templateName: string; username: string | null }>
    }>(event)

    const { repo, branch, updates } = body

    if (!repo || !branch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: repo, branch'
      })
    }

    if (!updates || updates.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No updates provided'
      })
    }

    const [owner, repoName] = repo.split('/')
    const octokit = new Octokit({ auth: session.accessToken })

    console.log(`[creator bulk-update] Updating ${updates.length} template(s) in ${repo}@${branch}`)

    // Get current commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`
    })
    const currentCommitSha = refData.object.sha

    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo: repoName,
      commit_sha: currentCommitSha
    })
    const currentTreeSha = commitData.tree.sha

    // Build lookup map for fast access
    const updateMap = new Map(updates.map(u => [u.templateName, u.username]))

    const tree: any[] = []
    let totalModifiedCount = 0

    // Update all locale index files
    for (const localeFile of localeFiles) {
      const indexPath = `templates/${localeFile}`

      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo: repoName,
          path: indexPath,
          ref: branch,
          headers: { 'If-None-Match': '' }
        })

        if (!('content' in fileData)) {
          console.warn(`[creator bulk-update] Skipping ${localeFile}: invalid structure`)
          continue
        }

        const indexData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'))

        if (!Array.isArray(indexData)) {
          console.warn(`[creator bulk-update] Skipping ${localeFile}: not an array`)
          continue
        }

        let modified = false

        for (const category of indexData) {
          if (!category.templates || !Array.isArray(category.templates)) continue
          for (const template of category.templates) {
            if (!updateMap.has(template.name)) continue
            const newUsername = updateMap.get(template.name)
            if (newUsername) {
              template.username = newUsername
            } else {
              delete template.username
            }
            modified = true
            if (localeFile === 'index.json') totalModifiedCount++
          }
        }

        if (modified) {
          tree.push({
            path: indexPath,
            mode: '100644' as const,
            type: 'blob' as const,
            content: formatTemplateJson(indexData)
          })
          console.log(`[creator bulk-update] Updated ${localeFile}`)
        }
      } catch (error: any) {
        console.error(`[creator bulk-update] Error processing ${localeFile}:`, error.message)
      }
    }

    if (tree.length === 0) {
      return { success: true, message: 'No matching templates found', commit: null }
    }

    // Create new tree and commit
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree,
      base_tree: currentTreeSha
    })

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: `Update creator for ${totalModifiedCount} template(s)\n\nUpdated via Creator Manager`,
      tree: newTree.sha,
      parents: [currentCommitSha]
    })

    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    })

    console.log(`[creator bulk-update] Committed ${totalModifiedCount} changes across ${tree.length} files: ${newCommit.sha}`)

    return {
      success: true,
      message: `Updated creator for ${totalModifiedCount} template(s)`,
      commit: {
        sha: newCommit.sha,
        url: `https://github.com/${owner}/${repoName}/commit/${newCommit.sha}`
      }
    }
  } catch (error: any) {
    console.error('[creator bulk-update] Error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update creators'
    })
  }
})
