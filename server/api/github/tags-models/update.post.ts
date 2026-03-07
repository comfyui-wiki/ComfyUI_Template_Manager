import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { formatTemplateJson } from '~/server/utils/json-formatter'
import i18nConfig from '~/config/i18n-config.json'

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
      deleteTags: string[]
      deleteModels: string[]
    }>(event)

    const { repo, branch, deleteTags = [], deleteModels = [] } = body

    if (!repo || !branch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: repo, branch'
      })
    }

    if (deleteTags.length === 0 && deleteModels.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No tags or models to delete'
      })
    }

    const [owner, repoName] = repo.split('/')
    const octokit = new Octokit({ auth: session.accessToken })
    const i18nPath = i18nConfig.i18nDataPath?.default || 'scripts/i18n.json'

    console.log(`[tags-models update] Deleting tags: [${deleteTags.join(', ')}], models: [${deleteModels.join(', ')}]`)

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

    const tree: any[] = []

    // Read i18n.json to get translated tag values per locale
    // locale files store translated tag values (not the English key), so we need
    // to match against the localized value for each language
    const tagTranslations: Record<string, Record<string, string>> = {}
    // tagTranslations[tagEnKey][langCode] = localizedValue
    try {
      const { data: i18nFileData } = await octokit.repos.getContent({
        owner, repo: repoName, path: i18nPath, ref: branch,
        headers: { 'If-None-Match': '' }
      })
      if ('content' in i18nFileData) {
        const i18nData = JSON.parse(Buffer.from(i18nFileData.content, 'base64').toString('utf-8'))
        if (i18nData.tags && typeof i18nData.tags === 'object') {
          for (const [enKey, translations] of Object.entries(i18nData.tags as Record<string, Record<string, string>>)) {
            tagTranslations[enKey] = translations
          }
        }
      }
    } catch (e: any) {
      console.warn('[tags-models update] Could not read i18n.json, falling back to English keys only:', e.message)
    }

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

    // 1. Update all locale index files (remove tags/models from templates)
    for (const localeFile of localeFiles) {
      const indexPath = `templates/${localeFile}`
      const langCode = langCodeMap[localeFile] || 'en'

      // Build the set of localized tag values to delete for this language
      const localizedTagsToDelete = new Set<string>()
      for (const enKey of deleteTags) {
        // Always include the English key (fallback)
        localizedTagsToDelete.add(enKey)
        // Also include the localized translation if available
        const localized = tagTranslations[enKey]?.[langCode]
        if (localized) localizedTagsToDelete.add(localized)
      }

      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo: repoName,
          path: indexPath,
          ref: branch,
          headers: { 'If-None-Match': '' }
        })

        if (!('content' in fileData)) {
          console.warn(`[tags-models update] Skipping ${localeFile}: invalid structure`)
          continue
        }

        const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
        const localeData = JSON.parse(content)

        if (!Array.isArray(localeData)) {
          console.warn(`[tags-models update] Skipping ${localeFile}: not an array`)
          continue
        }

        let modified = false

        for (const category of localeData) {
          if (!category.templates || !Array.isArray(category.templates)) continue

          for (const template of category.templates) {
            // Remove deleted tags (match both English key and localized value)
            if (localizedTagsToDelete.size > 0 && template.tags && Array.isArray(template.tags)) {
              const originalLen = template.tags.length
              template.tags = template.tags.filter((tag: string) => !localizedTagsToDelete.has(tag))
              if (template.tags.length !== originalLen) modified = true
            }

            // Remove deleted models (model names are never translated)
            if (deleteModels.length > 0 && template.models && Array.isArray(template.models)) {
              const originalLen = template.models.length
              template.models = template.models.filter((model: string) => !deleteModels.includes(model))
              if (template.models.length !== originalLen) modified = true
            }
          }
        }

        if (modified) {
          tree.push({
            path: indexPath,
            mode: '100644' as const,
            type: 'blob' as const,
            content: formatTemplateJson(localeData)
          })
          console.log(`[tags-models update] Updated ${localeFile}`)
        }
      } catch (error: any) {
        console.error(`[tags-models update] Error processing ${localeFile}:`, error.message)
      }
    }

    // Note: i18n.json is intentionally NOT modified on deletion.
    // Tag translations are preserved so they can be reused if the tag is re-added later.

    if (tree.length === 0) {
      return {
        success: true,
        message: 'No changes needed',
        commit: null
      }
    }

    // Create new tree and commit
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree,
      base_tree: currentTreeSha
    })

    const deleteDesc: string[] = []
    if (deleteTags.length > 0) deleteDesc.push(`${deleteTags.length} tag(s)`)
    if (deleteModels.length > 0) deleteDesc.push(`${deleteModels.length} model(s)`)

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: `Remove ${deleteDesc.join(' and ')}\n\nDeleted via Tag & Model Manager`,
      tree: newTree.sha,
      parents: [currentCommitSha]
    })

    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    })

    console.log(`[tags-models update] Successfully committed changes: ${newCommit.sha}`)

    return {
      success: true,
      message: `Deleted ${deleteDesc.join(' and ')} successfully`,
      commit: {
        sha: newCommit.sha,
        url: `https://github.com/${owner}/${repoName}/commit/${newCommit.sha}`
      }
    }
  } catch (error: any) {
    console.error('[tags-models update] Error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update tags/models'
    })
  }
})
