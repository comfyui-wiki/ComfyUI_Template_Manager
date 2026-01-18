import type { Octokit } from '@octokit/rest'
import { formatTemplateJson } from './json-formatter'

/**
 * i18n Configuration Interface
 */
interface I18nConfig {
  supportedLocales: Array<{
    code: string
    name: string
    indexFile: string
    isDefault?: boolean
  }>
  i18nDataPath: {
    default: string
    fallback: string
  }
  translatableFields: {
    template: string[]
    category: string[]
  }
  autoSyncFields: {
    fields: string[]
  }
}

/**
 * Template data interface
 */
interface TemplateData {
  name: string
  title: string
  description: string
  tags?: string[]
  [key: string]: any
}

/**
 * i18n.json data structure
 */
interface I18nData {
  _status: {
    comment: string
    pending_templates: Record<string, any>
    vram_size_update_templates: {
      comment: string
      templates: string[]
    }
    outdated_translations?: {
      comment?: string
      templates: Record<string, {
        fields: string[]
        lastUpdated: string
      }>
    }
  }
  templates: Record<string, {
    title: Record<string, string>
    description: Record<string, string>
  }>
  tags: Record<string, Record<string, string>>
  categories: Record<string, Record<string, string>>
}

/**
 * File update result
 */
interface FileUpdate {
  path: string
  content: string
}

/**
 * Load i18n configuration from config file
 */
export async function loadI18nConfig(
  octokit: Octokit,
  repo: string,
  branch: string
): Promise<I18nConfig> {
  const [owner, repoName] = repo.split('/')

  try {
    // Try to read from GitHub repo (workflow_templates/config/i18n-config.json)
    const { data } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: 'config/i18n-config.json',
      ref: branch
    })

    if ('content' in data && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('Failed to load i18n config from repo:', error)
  }

  // Fallback to local config
  const fs = await import('fs/promises')
  const path = await import('path')
  const configPath = path.join(process.cwd(), 'config', 'i18n-config.json')

  try {
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to load local i18n config:', error)
    throw new Error('Could not load i18n configuration')
  }
}

/**
 * Read JSON file from GitHub
 */
async function readJsonFromGitHub(
  octokit: Octokit,
  repo: string,
  branch: string,
  path: string
): Promise<any> {
  const [owner, repoName] = repo.split('/')

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path,
      ref: branch
    })

    if ('content' in data && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      return JSON.parse(content)
    }
  } catch (error: any) {
    // If file doesn't exist (404), return empty structure
    if (error.status === 404) {
      console.log(`File not found: ${path}, will create new`)
      return null
    }
    throw error
  }

  return null
}

/**
 * Read current i18n.json from GitHub
 */
async function readI18nJson(
  octokit: Octokit,
  repo: string,
  branch: string,
  config: I18nConfig
): Promise<I18nData> {
  const i18nPath = config.i18nDataPath.default
  const data = await readJsonFromGitHub(octokit, repo, branch, i18nPath)

  if (!data) {
    // Return default structure if file doesn't exist
    return {
      _status: {
        comment: 'Pending translation tasks. Only templates with missing translations appear here.',
        pending_templates: {},
        vram_size_update_templates: {
          comment: 'Templates that need vram and size data management in i18n.json',
          templates: []
        },
        outdated_translations: {
          comment: 'Templates with English updates that need translation review',
          templates: {}
        }
      },
      templates: {},
      tags: {},
      categories: {}
    }
  }

  // Ensure outdated_translations exists
  if (!data._status.outdated_translations) {
    data._status.outdated_translations = {
      comment: 'Templates with English updates that need translation review',
      templates: {}
    }
  }

  return data
}

/**
 * Sync a single template to all locale files
 * Returns array of file updates (path + content)
 */
export async function syncTemplateToAllLocales(
  octokit: Octokit,
  repo: string,
  branch: string,
  categoryIndex: number,
  templateData: TemplateData,
  templateOrder?: string[]
): Promise<FileUpdate[]> {
  const config = await loadI18nConfig(octokit, repo, branch)
  const i18nData = await readI18nJson(octokit, repo, branch, config)
  const fileUpdates: FileUpdate[] = []

  // Process each locale
  for (const locale of config.supportedLocales) {
    const indexPath = `templates/${locale.indexFile}`

    // Read current locale file
    const localeData = await readJsonFromGitHub(octokit, repo, branch, indexPath)

    if (!localeData || !Array.isArray(localeData)) {
      console.warn(`Skipping ${locale.code}: invalid or missing data`)
      continue
    }

    // Make sure category exists
    if (!localeData[categoryIndex]) {
      console.warn(`Skipping ${locale.code}: category ${categoryIndex} doesn't exist`)
      continue
    }

    // Clone the template data
    const newTemplate = { ...templateData }

    // For non-English locales, translate tags using i18n.json mappings
    if (!locale.isDefault && templateData.tags) {
      newTemplate.tags = translateTags(templateData.tags, locale.code, i18nData)
    }
    // For English locale, tags are already in English (no translation needed)

    // Find existing template index
    const existingIndex = localeData[categoryIndex].templates.findIndex(
      (t: any) => t.name === templateData.name
    )

    if (existingIndex >= 0) {
      // Update existing template
      localeData[categoryIndex].templates[existingIndex] = newTemplate
    } else {
      // Add new template
      if (templateOrder && templateOrder.length > 0) {
        // Insert at the correct position based on template order
        const orderIndex = templateOrder.indexOf(templateData.name)
        if (orderIndex >= 0) {
          localeData[categoryIndex].templates.splice(orderIndex, 0, newTemplate)
        } else {
          // If not in order array, append to end
          localeData[categoryIndex].templates.push(newTemplate)
        }
      } else {
        // No order specified, append to end
        localeData[categoryIndex].templates.push(newTemplate)
      }
    }

    // Format and add to updates
    const formattedContent = formatTemplateJson(localeData)
    fileUpdates.push({
      path: indexPath,
      content: formattedContent
    })

    console.log(`✓ Synced template to ${locale.code}: ${locale.indexFile}`)
  }

  return fileUpdates
}

/**
 * Update i18n.json with new template placeholders
 * Returns the file update object
 */
export async function updateI18nJson(
  octokit: Octokit,
  repo: string,
  branch: string,
  templateName: string,
  templateData: { title: string; description: string; tags?: string[] }
): Promise<FileUpdate> {
  const config = await loadI18nConfig(octokit, repo, branch)
  const i18nData = await readI18nJson(octokit, repo, branch, config)

  // Initialize template entry if it doesn't exist
  if (!i18nData.templates[templateName]) {
    i18nData.templates[templateName] = {
      title: {},
      description: {}
    }
  }

  // Add English values and placeholders for all languages
  const allLangCodes = config.supportedLocales.map(l => l.code)

  // Title
  for (const langCode of allLangCodes) {
    if (langCode === 'en' || !i18nData.templates[templateName].title[langCode]) {
      i18nData.templates[templateName].title[langCode] = templateData.title
    }
  }

  // Description
  for (const langCode of allLangCodes) {
    if (langCode === 'en' || !i18nData.templates[templateName].description[langCode]) {
      i18nData.templates[templateName].description[langCode] = templateData.description
    }
  }

  // Tags - add English placeholders if they don't exist
  if (templateData.tags) {
    for (const tag of templateData.tags) {
      if (!i18nData.tags[tag]) {
        i18nData.tags[tag] = {}
        for (const langCode of allLangCodes) {
          i18nData.tags[tag][langCode] = tag // English placeholder
        }
        console.log(`✓ Added new tag placeholder: ${tag}`)
      }
    }
  }

  // Add to pending templates (for manual translation later)
  if (!i18nData._status.pending_templates[templateName]) {
    i18nData._status.pending_templates[templateName] = {
      missing_fields: ['title', 'description'],
      missing_languages: allLangCodes.filter(code => code !== 'en')
    }
  }

  const i18nPath = config.i18nDataPath.default
  const formattedContent = JSON.stringify(i18nData, null, 2)

  console.log(`✓ Updated i18n.json with template: ${templateName}`)

  return {
    path: i18nPath,
    content: formattedContent
  }
}

/**
 * Translate a tag to target language using i18n data
 */
function translateTag(tag: string, targetLang: string, i18nData: I18nData): string {
  const tagsData = i18nData.tags || {}

  // Check if tag has translation mapping
  if (tagsData[tag] && tagsData[tag][targetLang]) {
    return tagsData[tag][targetLang]
  }

  // No translation found, return English (original tag)
  return tag
}

/**
 * Translate an array of tags to target language
 */
function translateTags(tags: string[], targetLang: string, i18nData: I18nData): string[] {
  return tags.map(tag => translateTag(tag, targetLang, i18nData))
}

/**
 * Sync tags to i18n.json (add new tags with English placeholders)
 */
export async function syncTagsToI18n(
  octokit: Octokit,
  repo: string,
  branch: string,
  tags: string[]
): Promise<FileUpdate | null> {
  if (!tags || tags.length === 0) {
    return null
  }

  const config = await loadI18nConfig(octokit, repo, branch)
  const i18nData = await readI18nJson(octokit, repo, branch, config)
  const allLangCodes = config.supportedLocales.map(l => l.code)

  let hasNewTags = false

  // Check each tag and add if it doesn't exist
  for (const tag of tags) {
    if (!i18nData.tags[tag]) {
      i18nData.tags[tag] = {}
      for (const langCode of allLangCodes) {
        i18nData.tags[tag][langCode] = tag // English placeholder
      }
      console.log(`✓ Added new tag to i18n.json: ${tag}`)
      hasNewTags = true
    }
  }

  // If no new tags were added, return null
  if (!hasNewTags) {
    return null
  }

  const i18nPath = config.i18nDataPath.default
  const formattedContent = JSON.stringify(i18nData, null, 2)

  return {
    path: i18nPath,
    content: formattedContent
  }
}

/**
 * Check if English title/description changed and track outdated translations
 * Also syncs new tags to i18n.json
 */
export async function trackOutdatedTranslations(
  octokit: Octokit,
  repo: string,
  branch: string,
  templateName: string,
  newTitle: string,
  newDescription: string,
  newTags?: string[]
): Promise<FileUpdate | null> {
  const config = await loadI18nConfig(octokit, repo, branch)
  const i18nData = await readI18nJson(octokit, repo, branch, config)
  const allLangCodes = config.supportedLocales.map(l => l.code)

  let hasChanges = false
  const outdatedFields: string[] = []

  // Check if template exists in i18n
  if (i18nData.templates[templateName]) {
    const templateI18n = i18nData.templates[templateName]

    // Check title
    if (templateI18n.title?.en && templateI18n.title.en !== newTitle) {
      outdatedFields.push('title')
      // Update English value in i18n
      templateI18n.title.en = newTitle
      console.log(`✓ Detected English title update for ${templateName}`)
      hasChanges = true
    }

    // Check description
    if (templateI18n.description?.en && templateI18n.description.en !== newDescription) {
      outdatedFields.push('description')
      // Update English value in i18n
      templateI18n.description.en = newDescription
      console.log(`✓ Detected English description update for ${templateName}`)
      hasChanges = true
    }

    // Mark template as having outdated translations if needed
    if (outdatedFields.length > 0) {
      if (!i18nData._status.outdated_translations) {
        i18nData._status.outdated_translations = {
          comment: 'Templates with English updates that need translation review',
          templates: {}
        }
      }

      i18nData._status.outdated_translations.templates[templateName] = {
        fields: outdatedFields,
        lastUpdated: new Date().toISOString()
      }

      console.log(`✓ Marked ${templateName} as needing translation update for: ${outdatedFields.join(', ')}`)
    }
  }

  // Sync new tags to i18n.json
  if (newTags && newTags.length > 0) {
    for (const tag of newTags) {
      if (!i18nData.tags[tag]) {
        i18nData.tags[tag] = {}
        for (const langCode of allLangCodes) {
          i18nData.tags[tag][langCode] = tag // English placeholder
        }
        console.log(`✓ Added new tag to i18n.json: ${tag}`)
        hasChanges = true
      }
    }
  }

  // If no changes detected, return null
  if (!hasChanges) {
    return null
  }

  const i18nPath = config.i18nDataPath.default
  const formattedContent = JSON.stringify(i18nData, null, 2)

  return {
    path: i18nPath,
    content: formattedContent
  }
}

/**
 * Sync updated template to all locale files (for edit mode)
 * This updates existing templates across all locales
 */
export async function syncUpdatedTemplateToAllLocales(
  octokit: Octokit,
  repo: string,
  branch: string,
  categoryIndex: number,
  templateData: TemplateData
): Promise<FileUpdate[]> {
  const config = await loadI18nConfig(octokit, repo, branch)
  const i18nData = await readI18nJson(octokit, repo, branch, config)
  const fileUpdates: FileUpdate[] = []

  // Process each locale
  for (const locale of config.supportedLocales) {
    const indexPath = `templates/${locale.indexFile}`

    // Read current locale file
    const localeData = await readJsonFromGitHub(octokit, repo, branch, indexPath)

    if (!localeData || !Array.isArray(localeData)) {
      console.warn(`Skipping ${locale.code}: invalid or missing data`)
      continue
    }

    // Make sure category exists
    if (!localeData[categoryIndex]) {
      console.warn(`Skipping ${locale.code}: category ${categoryIndex} doesn't exist`)
      continue
    }

    // Find existing template
    const existingIndex = localeData[categoryIndex].templates.findIndex(
      (t: any) => t.name === templateData.name
    )

    if (existingIndex >= 0) {
      const existingTemplate = localeData[categoryIndex].templates[existingIndex]

      // Update auto-sync fields only (preserve translations)
      const updatedTemplate = { ...existingTemplate }

      for (const field of config.autoSyncFields.fields) {
        if (field in templateData) {
          updatedTemplate[field] = templateData[field]
        }
      }

      // For English locale, update title and description from master
      if (locale.code === 'en') {
        updatedTemplate.title = templateData.title
        updatedTemplate.description = templateData.description
      }

      // Update tags - translate to target language using i18n.json mappings
      if (templateData.tags) {
        if (locale.code === 'en') {
          // For English, use original tags
          updatedTemplate.tags = templateData.tags
        } else {
          // For other languages, translate using i18n.json tag mappings
          updatedTemplate.tags = translateTags(templateData.tags, locale.code, i18nData)
        }
      }

      localeData[categoryIndex].templates[existingIndex] = updatedTemplate

      // Format and add to updates
      const formattedContent = formatTemplateJson(localeData)
      fileUpdates.push({
        path: indexPath,
        content: formattedContent
      })

      console.log(`✓ Updated template in ${locale.code}: ${locale.indexFile}`)
    } else {
      console.warn(`Template ${templateData.name} not found in ${locale.code}`)
    }
  }

  return fileUpdates
}
