import { getServerSession } from '#auth'
import { formatTemplateJson } from '~/server/utils/json-formatter'

export default defineEventHandler(async (event) => {
  try {
    // Get session
    const session = await getServerSession(event)
    if (!session || !session.accessToken) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }

    // Get request body
    const body = await readBody(event)
    const { repo, branch, usageData } = body

    if (!repo || !branch || !usageData) {
      throw createError({ statusCode: 400, message: 'Missing required fields' })
    }

    console.log(`[Batch Usage Update] Updating ${Object.keys(usageData).length} templates on ${repo}/${branch}`)

    // All index files to update (default index.json + all language-specific files)
    const indexFiles = [
      'templates/index.json',  // Default English
      'templates/index.en.json',
      'templates/index.zh.json',
      'templates/index.zh-TW.json',
      'templates/index.ja.json',
      'templates/index.ko.json',
      'templates/index.es.json',
      'templates/index.fr.json',
      'templates/index.ru.json',
      'templates/index.tr.json',
      'templates/index.ar.json',
      'templates/index.pt-BR.json'
    ]
    const [owner, repoName] = repo.split('/')

    // Fetch latest commit SHA for the branch
    const branchUrl = `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`
    const branchResponse = await fetch(branchUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })

    if (!branchResponse.ok) {
      throw createError({ statusCode: branchResponse.status, message: 'Failed to fetch branch info' })
    }

    const branchData = await branchResponse.json()
    const latestCommitSha = branchData.object.sha

    // Fetch the latest commit to get the tree
    const commitUrl = `https://api.github.com/repos/${owner}/${repoName}/git/commits/${latestCommitSha}`
    const commitResponse = await fetch(commitUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })

    if (!commitResponse.ok) {
      throw createError({ statusCode: commitResponse.status, message: 'Failed to fetch commit info' })
    }

    const commitData = await commitResponse.json()
    const baseTreeSha = commitData.tree.sha

    // Build tree with updated index files
    const tree: any[] = []
    let updatedCount = 0
    const updatedFiles: string[] = []

    for (const filePath of indexFiles) {
      // Fetch current index file
      const fileUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`
      const fileResponse = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })

      if (!fileResponse.ok) {
        console.warn(`[Batch Usage Update] Failed to fetch ${filePath}, skipping`)
        continue
      }

      const fileData = await fileResponse.json()
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
      let indexData = JSON.parse(content)

      // Update usage for each template
      let languageUpdatedCount = 0
      for (const category of indexData) {
        if (!category.templates || !Array.isArray(category.templates)) continue

        for (const template of category.templates) {
          const templateName = template.name
          if (usageData[templateName] !== undefined) {
            template.usage = usageData[templateName]
            languageUpdatedCount++
          }
        }
      }

      if (languageUpdatedCount > 0) {
        // Format JSON using custom formatter
        const newContent = formatTemplateJson(indexData) + '\n'

        // Add to tree
        tree.push({
          path: filePath,
          mode: '100644',
          type: 'blob',
          content: newContent
        })

        updatedFiles.push(filePath)
        updatedCount += languageUpdatedCount
        console.log(`[Batch Usage Update] Updated ${languageUpdatedCount} templates in ${filePath}`)
      }
    }

    if (tree.length === 0) {
      throw createError({ statusCode: 400, message: 'No templates were updated' })
    }

    // Create new tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repoName}/git/trees`
    const treeResponse = await fetch(treeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree
      })
    })

    if (!treeResponse.ok) {
      const errorText = await treeResponse.text()
      throw createError({ statusCode: treeResponse.status, message: `Failed to create tree: ${errorText}` })
    }

    const treeData = await treeResponse.json()

    // Create new commit
    const commitMessage = `Update template usage data\n\nBatch update ${updatedCount} template usage counts across ${updatedFiles.length} files`
    const newCommitUrl = `https://api.github.com/repos/${owner}/${repoName}/git/commits`
    const newCommitResponse = await fetch(newCommitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: commitMessage,
        tree: treeData.sha,
        parents: [latestCommitSha]
      })
    })

    if (!newCommitResponse.ok) {
      const errorText = await newCommitResponse.text()
      throw createError({ statusCode: newCommitResponse.status, message: `Failed to create commit: ${errorText}` })
    }

    const newCommitData = await newCommitResponse.json()

    // Update branch reference
    const updateRefUrl = `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`
    const updateRefResponse = await fetch(updateRefUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sha: newCommitData.sha,
        force: false
      })
    })

    if (!updateRefResponse.ok) {
      const errorText = await updateRefResponse.text()
      throw createError({ statusCode: updateRefResponse.status, message: `Failed to update branch: ${errorText}` })
    }

    console.log(`[Batch Usage Update] Successfully updated ${updatedCount} templates across ${updatedFiles.length} files`)

    return {
      success: true,
      updatedCount,
      updatedFiles,
      commit: {
        sha: newCommitData.sha,
        url: `https://github.com/${owner}/${repoName}/commit/${newCommitData.sha}`
      }
    }
  } catch (error: any) {
    console.error('[Batch Usage Update] Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to update usage data'
    })
  }
})
