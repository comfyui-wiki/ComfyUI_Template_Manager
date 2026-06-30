import { getServerSession } from '#auth'
import { formatTemplateJson } from '~/server/utils/json-formatter'
import { isLocalModeEnabled, writeLocalTreeAndCommit } from '~/server/utils/local-template-persist'
import { readRepoJson } from '~/server/utils/local-repo'

const INDEX_FILES = [
  'templates/index.json',
  'templates/index.zh.json',
  'templates/index.zh-TW.json',
  'templates/index.ja.json',
  'templates/index.ko.json',
  'templates/index.es.json',
  'templates/index.fr.json',
  'templates/index.ru.json',
  'templates/index.tr.json',
  'templates/index.ar.json',
  'templates/index.pt-BR.json',
  'templates/index.fa.json'
]

type TreeItem = { path: string; mode: '100644'; type: 'blob'; content: string }

function buildTreeFromIndexData(
  usageData: Record<string, number>,
  loadIndex: (filePath: string) => Promise<any[] | null>
): Promise<{ tree: TreeItem[]; updatedCount: number; updatedFiles: string[] }> {
  return (async () => {
    const tree: TreeItem[] = []
    let updatedCount = 0
    const updatedFiles: string[] = []

    for (const filePath of INDEX_FILES) {
      const indexData = await loadIndex(filePath)
      if (!indexData) continue

      let languageUpdatedCount = 0
      for (const category of indexData) {
        if (!category.templates || !Array.isArray(category.templates)) continue
        for (const template of category.templates) {
          if (usageData[template.name] !== undefined) {
            template.usage = usageData[template.name]
            languageUpdatedCount++
          }
        }
      }

      if (languageUpdatedCount > 0) {
        tree.push({
          path: filePath,
          mode: '100644',
          type: 'blob',
          content: formatTemplateJson(indexData) + '\n'
        })
        updatedFiles.push(filePath)
        updatedCount += languageUpdatedCount
        console.log(`[Batch Usage Update] Updated ${languageUpdatedCount} templates in ${filePath}`)
      }
    }

    return { tree, updatedCount, updatedFiles }
  })()
}

export default defineEventHandler(async (event) => {
  try {
    const localMode = isLocalModeEnabled()
    const session = await getServerSession(event)

    if (!localMode && (!session || !session.accessToken)) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }

    const body = await readBody(event)
    const { repo, branch, usageData } = body

    if (!usageData) {
      throw createError({ statusCode: 400, message: 'Missing usageData' })
    }

    if (!localMode && (!repo || !branch)) {
      throw createError({ statusCode: 400, message: 'Missing repo or branch' })
    }

    console.log(`[Batch Usage Update] Updating ${Object.keys(usageData).length} templates on ${localMode ? 'local clone' : `${repo}/${branch}`}`)

    if (localMode) {
      const { tree, updatedCount, updatedFiles } = await buildTreeFromIndexData(
        usageData,
        async (filePath) => {
          try {
            return await readRepoJson<any[]>(filePath)
          } catch {
            console.warn(`[Batch Usage Update] Skipping missing file: ${filePath}`)
            return null
          }
        }
      )

      if (tree.length === 0) {
        throw createError({ statusCode: 400, message: 'No templates were updated' })
      }

      const commitMessage = `Update template usage data\n\nBatch update ${updatedCount} template usage counts across ${updatedFiles.length} files`
      const { sha } = await writeLocalTreeAndCommit(tree, commitMessage)

      return {
        success: true,
        updatedCount,
        updatedFiles,
        commit: { sha, url: `local://${sha.substring(0, 7)}` }
      }
    }

    const [owner, repoName] = repo.split('/')
    const accessToken = session!.accessToken!

    const { tree, updatedCount, updatedFiles } = await buildTreeFromIndexData(
      usageData,
      async (filePath) => {
        const fileUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`
        const fileResponse = await fetch(fileUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json'
          }
        })
        if (!fileResponse.ok) {
          console.warn(`[Batch Usage Update] Failed to fetch ${filePath}, skipping`)
          return null
        }
        const fileData = await fileResponse.json()
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
        return JSON.parse(content)
      }
    )

    if (tree.length === 0) {
      throw createError({ statusCode: 400, message: 'No templates were updated' })
    }

    const branchUrl = `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`
    const branchResponse = await fetch(branchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    })

    if (!branchResponse.ok) {
      throw createError({ statusCode: branchResponse.status, message: 'Failed to fetch branch info' })
    }

    const branchData = await branchResponse.json()
    const latestCommitSha = branchData.object.sha

    const commitUrl = `https://api.github.com/repos/${owner}/${repoName}/git/commits/${latestCommitSha}`
    const commitResponse = await fetch(commitUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    })

    if (!commitResponse.ok) {
      throw createError({ statusCode: commitResponse.status, message: 'Failed to fetch commit info' })
    }

    const commitData = await commitResponse.json()
    const baseTreeSha = commitData.tree.sha

    const treeUrl = `https://api.github.com/repos/${owner}/${repoName}/git/trees`
    const treeResponse = await fetch(treeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base_tree: baseTreeSha, tree })
    })

    if (!treeResponse.ok) {
      const errorText = await treeResponse.text()
      throw createError({ statusCode: treeResponse.status, message: `Failed to create tree: ${errorText}` })
    }

    const treeData = await treeResponse.json()
    const commitMessage = `Update template usage data\n\nBatch update ${updatedCount} template usage counts across ${updatedFiles.length} files`

    const newCommitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
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

    const updateRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sha: newCommitData.sha, force: false })
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
