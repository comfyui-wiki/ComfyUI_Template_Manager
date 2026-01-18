import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { formatTemplateJson } from '~/server/utils/json-formatter'
import fs from 'fs'
import path from 'path'

interface I18nData {
  _status: any
  templates: Record<string, {
    title: Record<string, string>
    description: Record<string, string>
  }>
  tags: Record<string, Record<string, string>>
  categories: Record<string, Record<string, string>>
}

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
      i18nData: I18nData
    }>(event)

    const { repo, branch, i18nData } = body

    if (!repo || !branch || !i18nData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters'
      })
    }

    const [owner, repoName] = repo.split('/')
    const octokit = new Octokit({ auth: session.accessToken })

    // Read i18n config to get the correct path
    const configPath = path.join(process.cwd(), 'config', 'i18n-config.json')
    const configContent = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configContent)
    const i18nPath = config.i18nDataPath?.default || 'scripts/i18n.json'

    console.log('[Update i18n] Starting translation update and sync...')
    console.log('[Update i18n] i18n.json path:', i18nPath)

    // Get current commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`
    })
    const currentCommitSha = refData.object.sha

    // Get current tree
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo: repoName,
      commit_sha: currentCommitSha
    })
    const currentTreeSha = commitData.tree.sha

    // Prepare tree items
    const tree: any[] = []

    // 1. Update i18n.json
    tree.push({
      path: i18nPath,
      mode: '100644' as const,
      type: 'blob' as const,
      content: JSON.stringify(i18nData, null, 2)
    })

    console.log('[Update i18n] Updated i18n.json at path:', i18nPath)

    // 2. Sync translations to all locale files
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

    const langCodeMap: Record<string, string> = {
      'index.json': 'en',
      'index.zh.json': 'zh',
      'index.zh-TW.json': 'zh-TW',
      'index.ja.json': 'ja',
      'index.ko.json': 'ko',
      'index.es.json': 'es',
      'index.fr.json': 'fr',
      'index.ru.json': 'ru',
      'index.tr.json': 'tr',
      'index.ar.json': 'ar',
      'index.pt-BR.json': 'pt-BR'
    }

    for (const localeFile of localeFiles) {
      const langCode = langCodeMap[localeFile]
      const indexPath = `templates/${localeFile}`

      try {
        // Read current locale file
        const { data: localeFileData } = await octokit.repos.getContent({
          owner,
          repo: repoName,
          path: indexPath,
          ref: branch
        })

        if (!('content' in localeFileData)) {
          console.warn(`[Update i18n] Skipping ${localeFile}: invalid structure`)
          continue
        }

        const localeContent = Buffer.from(localeFileData.content, 'base64').toString('utf-8')
        const localeData = JSON.parse(localeContent)

        if (!Array.isArray(localeData)) {
          console.warn(`[Update i18n] Skipping ${localeFile}: not an array`)
          continue
        }

        // Apply translations to templates
        for (const category of localeData) {
          if (!category.templates || !Array.isArray(category.templates)) continue

          for (const template of category.templates) {
            const templateName = template.name
            if (!templateName) continue

            // Apply title translation
            if (i18nData.templates[templateName]?.title?.[langCode]) {
              template.title = i18nData.templates[templateName].title[langCode]
            }

            // Apply description translation
            if (i18nData.templates[templateName]?.description?.[langCode]) {
              template.description = i18nData.templates[templateName].description[langCode]
            }

            // Apply tag translations
            if (template.tags && Array.isArray(template.tags)) {
              template.tags = template.tags.map((tag: string) => {
                return i18nData.tags[tag]?.[langCode] || tag
              })
            }
          }

          // Apply category title translation
          if (category.title && i18nData.categories[category.title]?.[langCode]) {
            category.title = i18nData.categories[category.title][langCode]
          }
        }

        // Add updated locale file to tree
        tree.push({
          path: indexPath,
          mode: '100644' as const,
          type: 'blob' as const,
          content: formatTemplateJson(localeData)
        })

        console.log(`[Update i18n] Synced translations to ${localeFile}`)
      } catch (error: any) {
        console.error(`[Update i18n] Error syncing ${localeFile}:`, error.message)
        // Continue with other files
      }
    }

    // Create new tree
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree,
      base_tree: currentTreeSha
    })

    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: `Update translations\n\nUpdated via Translation Manager`,
      tree: newTree.sha,
      parents: [currentCommitSha]
    })

    // Update branch reference
    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    })

    console.log('[Update i18n] Successfully updated and synced all translations')

    return {
      success: true,
      message: 'Translations updated and synced successfully',
      commit: {
        sha: newCommit.sha,
        url: `https://github.com/${owner}/${repoName}/commit/${newCommit.sha}`
      }
    }
  } catch (error: any) {
    console.error('Error updating translations:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update translations'
    })
  }
})
