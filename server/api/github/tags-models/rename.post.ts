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

interface RenameItem {
  oldKey: string
  newKey: string
  type: 'tag' | 'model'
}

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)

    if (!session?.accessToken) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized - Please sign in' })
    }

    const body = await readBody<{
      repo: string
      branch: string
      renames: RenameItem[]
    }>(event)

    const { repo, branch, renames = [] } = body

    if (!repo || !branch) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required parameters: repo, branch' })
    }

    if (renames.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No renames provided' })
    }

    // Validate: no empty keys, no duplicates
    for (const r of renames) {
      if (!r.oldKey?.trim() || !r.newKey?.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'Rename keys cannot be empty' })
      }
      if (r.oldKey === r.newKey) {
        throw createError({ statusCode: 400, statusMessage: `Old and new key are the same: "${r.oldKey}"` })
      }
    }

    const tagRenames = renames.filter(r => r.type === 'tag')
    const modelRenames = renames.filter(r => r.type === 'model')

    const [owner, repoName] = repo.split('/')
    const octokit = new Octokit({ auth: session.accessToken })
    const i18nPath = i18nConfig.i18nDataPath?.default || 'scripts/i18n.json'

    console.log(`[tags-models rename] Processing ${renames.length} rename(s)`)

    // Get current commit SHA
    const { data: refData } = await octokit.git.getRef({ owner, repo: repoName, ref: `heads/${branch}` })
    const currentCommitSha = refData.object.sha
    const { data: commitData } = await octokit.git.getCommit({ owner, repo: repoName, commit_sha: currentCommitSha })
    const currentTreeSha = commitData.tree.sha

    const tree: any[] = []

    // Read i18n.json to get translated tag values per locale.
    // Locale files store localized tag values (not English keys), so for renaming
    // we need to replace the localized old value with the new English key.
    // After rename, the TranslationManager can be used to add proper translations.
    const tagTranslations: Record<string, Record<string, string>> = {}
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
      console.warn('[tags-models rename] Could not read i18n.json, using English keys only:', e.message)
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

    // 1. Update all locale index files
    for (const localeFile of localeFiles) {
      const indexPath = `templates/${localeFile}`
      const langCode = langCodeMap[localeFile] || 'en'

      // Build per-locale tag rename map: localizedOldValue -> newKey
      // (for non-English locales, the old value in the file is the translated string)
      const localizedTagRenameMap = new Map<string, string>()
      for (const { oldKey, newKey } of tagRenames) {
        localizedTagRenameMap.set(oldKey, newKey) // always map English key
        const localizedOld = tagTranslations[oldKey]?.[langCode]
        if (localizedOld && localizedOld !== oldKey) {
          localizedTagRenameMap.set(localizedOld, newKey)
        }
      }

      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner, repo: repoName, path: indexPath, ref: branch,
          headers: { 'If-None-Match': '' }
        })

        if (!('content' in fileData)) continue

        const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
        const localeData = JSON.parse(content)
        if (!Array.isArray(localeData)) continue

        let modified = false

        for (const category of localeData) {
          if (!category.templates || !Array.isArray(category.templates)) continue

          for (const template of category.templates) {
            // Rename tags: match both English key and localized old value
            if (localizedTagRenameMap.size > 0 && template.tags && Array.isArray(template.tags)) {
              const before = JSON.stringify(template.tags)
              const mapped = template.tags.map((tag: string) => localizedTagRenameMap.get(tag) ?? tag)
              template.tags = [...new Set(mapped)]
              if (JSON.stringify(template.tags) !== before) modified = true
            }

            // Rename models (model names are never translated)
            if (modelRenames.length > 0 && template.models && Array.isArray(template.models)) {
              const before = JSON.stringify(template.models)
              const mapped = template.models.map((model: string) => {
                const rename = modelRenames.find(r => r.oldKey === model)
                return rename ? rename.newKey : model
              })
              template.models = [...new Set(mapped)]
              if (JSON.stringify(template.models) !== before) modified = true
            }
          }
        }

        if (modified) {
          tree.push({
            path: indexPath, mode: '100644' as const, type: 'blob' as const,
            content: formatTemplateJson(localeData)
          })
          console.log(`[tags-models rename] Updated ${localeFile}`)
        }
      } catch (error: any) {
        console.error(`[tags-models rename] Error processing ${localeFile}:`, error.message)
      }
    }

    // 2. If renaming tags, update i18n.json (rename the key, preserve translations)
    if (tagRenames.length > 0) {
      try {
        const { data: i18nFileData } = await octokit.repos.getContent({
          owner, repo: repoName, path: i18nPath, ref: branch,
          headers: { 'If-None-Match': '' }
        })

        if ('content' in i18nFileData) {
          const i18nContent = Buffer.from(i18nFileData.content, 'base64').toString('utf-8')
          const i18nData = JSON.parse(i18nContent)
          let i18nModified = false

          if (i18nData.tags && typeof i18nData.tags === 'object') {
            for (const { oldKey, newKey } of tagRenames) {
              const oldTranslations = i18nData.tags[oldKey] || {}
              const targetAlreadyExists = newKey in i18nData.tags

              if (targetAlreadyExists) {
                // Merge: keep newKey's existing translations, fill in any missing langs from oldKey
                const merged = { ...oldTranslations, ...i18nData.tags[newKey] }
                i18nData.tags[newKey] = merged
                console.log(`[tags-models rename] Merged tag "${oldKey}" into existing "${newKey}" in i18n.json`)
              } else {
                // Copy translations to new key (preserve old key too)
                const translations = { ...oldTranslations }
                if (!translations.en) translations.en = newKey
                i18nData.tags[newKey] = translations
                console.log(`[tags-models rename] Copied translations from "${oldKey}" to "${newKey}" in i18n.json`)
              }

              // Note: old key is intentionally kept so translations are not lost
              i18nModified = true
            }
          }

          if (i18nModified) {
            tree.push({
              path: i18nPath, mode: '100644' as const, type: 'blob' as const,
              content: JSON.stringify(i18nData, null, 2)
            })
          }
        }
      } catch (error: any) {
        console.error(`[tags-models rename] Error updating i18n.json:`, error.message)
      }
    }

    if (tree.length === 0) {
      return { success: true, message: 'No changes needed', commit: null }
    }

    // Create commit
    const { data: newTree } = await octokit.git.createTree({ owner, repo: repoName, tree, base_tree: currentTreeSha })

    const renameDesc = renames.map(r => `"${r.oldKey}" → "${r.newKey}"`).join(', ')
    const { data: newCommit } = await octokit.git.createCommit({
      owner, repo: repoName,
      message: `Rename ${renames.length} tag/model(s)\n\n${renameDesc}\n\nRenamed via Tag & Model Manager`,
      tree: newTree.sha,
      parents: [currentCommitSha]
    })

    await octokit.git.updateRef({ owner, repo: repoName, ref: `heads/${branch}`, sha: newCommit.sha })

    console.log(`[tags-models rename] Committed: ${newCommit.sha}`)

    return {
      success: true,
      message: `Renamed ${renames.length} item(s) successfully`,
      commit: {
        sha: newCommit.sha,
        url: `https://github.com/${owner}/${repoName}/commit/${newCommit.sha}`
      }
    }
  } catch (error: any) {
    console.error('[tags-models rename] Error:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to rename' })
  }
})
