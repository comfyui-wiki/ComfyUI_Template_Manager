<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import MainBranchWarningDialog from '~/components/MainBranchWarningDialog.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

// Language configuration
const languages = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ru', name: 'Русский' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية' },
  { code: 'pt-BR', name: 'Português (Brasil)' }
]

// State
const loading = ref(false)
const saving = ref(false)
const saveSuccess = ref<{ commitSha: string; commitUrl: string } | null>(null)
const saveError = ref<string | null>(null)
const i18nData = ref<any>(null)
const activeLanguage = ref('all') // Default to "all" to show all languages
const filterMode = ref<'all' | 'outdated' | 'untranslated' | 'modified' | 'new'>('untranslated')
const searchQuery = ref('')
const editingCell = ref<{ key: string; lang: string } | null>(null)
const editValue = ref('')
const translatingCell = ref<string | null>(null) // "key:lang" format
const modifiedCells = ref<Set<string>>(new Set()) // Track modified cells "key:lang"

// Check if AI translation is enabled
const config = useRuntimeConfig()
const aiEnabled = computed(() => config.public.aiTranslationEnabled)

// Batch translation state
const selectedItems = ref<Set<string>>(new Set()) // Set of item keys
const batchTargetLang = ref<string>('all') // Default to "All Languages"
const batchTranslating = ref(false)
const batchProgress = ref({ current: 0, total: 0, status: '' })
const showBatchDialog = ref(false)

// Custom prompt dialog state
const showCustomPromptDialog = ref(false)
const customSystemPrompt = ref('')
const defaultSystemPrompt = ref('') // Store default prompt from config

// Translation sections
type TranslationSection = 'templates' | 'tags' | 'categories'
const activeSection = ref<TranslationSection>('templates')

// Main branch warning dialog state
const showMainBranchWarning = ref(false)
const pendingSave = ref(false)
const warningTiming = ref<'opening' | 'saving'>('opening')

// Visible languages (for table columns)
const visibleLanguages = computed(() => {
  if (activeLanguage.value === 'all') {
    return languages
  }
  return languages.filter(l => l.code === 'en' || l.code === activeLanguage.value)
})

// Load i18n data
const loadI18nData = async () => {
  loading.value = true
  try {
    const { selectedRepo, selectedBranch } = useGitHubRepo()
    const repo = selectedRepo.value
    const branch = selectedBranch.value

    console.log('[TranslationManager] Loading i18n data from:', { repo, branch })

    const response = await $fetch('/api/github/i18n/read', {
      method: 'GET',
      query: { repo, branch }
    })

    i18nData.value = response
    console.log('[TranslationManager] Successfully loaded i18n data')
  } catch (error: any) {
    console.error('[TranslationManager] Failed to load i18n data:', error)

    let errorMessage = 'Failed to load translation data.'
    if (error.statusCode === 404) {
      errorMessage = 'i18n.json file not found in repository. Please check that scripts/i18n.json exists in your repository.'
    } else if (error.statusCode === 401) {
      errorMessage = 'Authentication error. Please sign in again.'
    } else if (error.data?.message) {
      errorMessage = `Error: ${error.data.message}`
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`
    }

    alert(errorMessage)
  } finally {
    loading.value = false
  }
}

// Load default system prompt from config
const loadDefaultPrompt = async () => {
  try {
    const response = await $fetch('/api/config/i18n-config.json')
    if (response && response.aiTranslation && response.aiTranslation.systemPrompt) {
      defaultSystemPrompt.value = response.aiTranslation.systemPrompt
      console.log('[TranslationManager] Loaded default system prompt')
    }
  } catch (error) {
    console.error('[TranslationManager] Failed to load default prompt:', error)
  }
}

// Watch dialog open state
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // Check for main branch when opening dialog
    const { selectedBranch } = useGitHubRepo()
    const branch = selectedBranch.value || 'main'
    const isMainBranch = branch === 'main' || branch === 'master'

    if (isMainBranch) {
      // Show warning when opening translation manager on main branch
      warningTiming.value = 'opening'
      showMainBranchWarning.value = true
    }

    if (!i18nData.value) {
      loadI18nData()
    }
    if (!defaultSystemPrompt.value) {
      loadDefaultPrompt()
    }
  }
})

// Get translation items for current section
const translationItems = computed(() => {
  if (!i18nData.value) return []

  const section = i18nData.value[activeSection.value] || {}
  const items: Array<{
    key: string
    type: TranslationSection
    englishValue: string
    translations: Record<string, string>
    isOutdated: boolean
    untranslatedLangs: string[]
  }> = []

  for (const [key, value] of Object.entries(section)) {
    if (activeSection.value === 'templates') {
      // For templates, we have title and description
      const template = value as any

      // Title
      if (template.title) {
        const translations: Record<string, string> = {}
        for (const lang of languages) {
          translations[lang.code] = template.title[lang.code] || ''
        }

        const isOutdated = i18nData.value._status?.outdated_translations?.templates?.[key]?.fields?.includes('title') || false
        const untranslatedLangs = languages
          .filter(l => l.code !== 'en' && translations[l.code] === translations['en'])
          .map(l => l.code)

        items.push({
          key: `${key}.title`,
          type: 'templates',
          englishValue: translations.en || '',
          translations,
          isOutdated,
          untranslatedLangs
        })
      }

      // Description
      if (template.description) {
        const translations: Record<string, string> = {}
        for (const lang of languages) {
          translations[lang.code] = template.description[lang.code] || ''
        }

        const isOutdated = i18nData.value._status?.outdated_translations?.templates?.[key]?.fields?.includes('description') || false
        const untranslatedLangs = languages
          .filter(l => l.code !== 'en' && translations[l.code] === translations['en'])
          .map(l => l.code)

        items.push({
          key: `${key}.description`,
          type: 'templates',
          englishValue: translations.en || '',
          translations,
          isOutdated,
          untranslatedLangs
        })
      }
    } else {
      // For tags and categories
      // The key itself is the English value, other languages are in the object
      const translations: Record<string, string> = {}
      translations['en'] = key // Key is the English text

      for (const lang of languages) {
        if (lang.code === 'en') {
          continue // Already set above
        }
        translations[lang.code] = (value as any)[lang.code] || key // Default to key if missing
      }

      const untranslatedLangs = languages
        .filter(l => l.code !== 'en' && translations[l.code] === key)
        .map(l => l.code)

      items.push({
        key,
        type: activeSection.value,
        englishValue: key, // English value is the key itself
        translations,
        isOutdated: false,
        untranslatedLangs
      })
    }
  }

  return items
})

// Filtered items
const filteredItems = computed(() => {
  let items = translationItems.value

  // Apply filter mode
  if (filterMode.value === 'outdated') {
    items = items.filter(item => item.isOutdated)
  } else if (filterMode.value === 'untranslated') {
    if (activeLanguage.value === 'all') {
      // In "all" mode, show items that have ANY untranslated language
      items = items.filter(item => item.untranslatedLangs.length > 0)
    } else {
      // In single language mode, show items untranslated for that language
      items = items.filter(item => item.untranslatedLangs.includes(activeLanguage.value))
    }
  } else if (filterMode.value === 'modified') {
    // Show items that have been modified in current session
    items = items.filter(item => {
      // Check if any language cell for this item is modified
      return visibleLanguages.value.some(lang =>
        modifiedCells.value.has(`${item.key}:${lang.code}`)
      )
    })
  } else if (filterMode.value === 'new') {
    // Show items that are completely new (all non-English languages are untranslated)
    items = items.filter(item => {
      const nonEnglishLangs = languages.filter(l => l.code !== 'en').length
      return item.untranslatedLangs.length === nonEnglishLangs
    })
  }

  // Apply search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    items = items.filter(item => {
      return item.key.toLowerCase().includes(query) ||
        item.englishValue.toLowerCase().includes(query) ||
        Object.values(item.translations).some(t => t.toLowerCase().includes(query))
    })
  }

  return items
})

// Statistics
const stats = computed(() => {
  const total = translationItems.value.length
  const outdated = translationItems.value.filter(item => item.isOutdated).length
  const untranslated = activeLanguage.value === 'all'
    ? translationItems.value.filter(item => item.untranslatedLangs.length > 0).length
    : translationItems.value.filter(item => item.untranslatedLangs.includes(activeLanguage.value)).length

  // Count modified items (items with modified cells in current session)
  const modified = translationItems.value.filter(item => {
    return visibleLanguages.value.some(lang =>
      modifiedCells.value.has(`${item.key}:${lang.code}`)
    )
  }).length

  // Count new items (completely untranslated in all languages)
  const nonEnglishLangs = languages.filter(l => l.code !== 'en').length
  const newItems = translationItems.value.filter(item =>
    item.untranslatedLangs.length === nonEnglishLangs
  ).length

  return { total, outdated, untranslated, modified, new: newItems }
})

// Start editing a cell
const startEditCell = (key: string, lang: string, currentValue: string) => {
  editingCell.value = { key, lang }
  editValue.value = currentValue
}

// Cancel editing
const cancelEdit = () => {
  editingCell.value = null
  editValue.value = ''
}

// Clean translation value - remove newlines and extra spaces
const cleanTranslationValue = (value: string): string => {
  return value
    .replace(/\n/g, ' ')        // Replace newlines with space
    .replace(/\r/g, ' ')        // Replace carriage returns with space
    .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
    .trim()                     // Remove leading/trailing spaces
}

// Save single translation cell
const saveTranslation = (key: string, lang: string, value: string) => {
  if (!i18nData.value) return

  // Clean the value before saving
  const cleanedValue = cleanTranslationValue(value)

  const [mainKey, subKey] = key.includes('.') ? key.split('.') : [key, null]

  if (activeSection.value === 'templates' && subKey) {
    if (!i18nData.value.templates[mainKey]) {
      i18nData.value.templates[mainKey] = { title: {}, description: {} }
    }
    if (!i18nData.value.templates[mainKey][subKey]) {
      i18nData.value.templates[mainKey][subKey] = {}
    }

    // Check if English value changed
    const oldEnglishValue = i18nData.value.templates[mainKey][subKey]['en']
    const englishChanged = lang === 'en' && oldEnglishValue !== cleanedValue

    i18nData.value.templates[mainKey][subKey][lang] = cleanedValue

    // If English was edited, mark as outdated
    if (englishChanged) {
      if (!i18nData.value._status) {
        i18nData.value._status = { outdated_translations: { templates: {} } }
      }
      if (!i18nData.value._status.outdated_translations) {
        i18nData.value._status.outdated_translations = { templates: {} }
      }
      if (!i18nData.value._status.outdated_translations.templates) {
        i18nData.value._status.outdated_translations.templates = {}
      }

      if (!i18nData.value._status.outdated_translations.templates[mainKey]) {
        i18nData.value._status.outdated_translations.templates[mainKey] = {
          fields: [],
          lastUpdated: new Date().toISOString()
        }
      }

      const outdatedFields = i18nData.value._status.outdated_translations.templates[mainKey].fields
      if (!outdatedFields.includes(subKey)) {
        outdatedFields.push(subKey)
      }
      i18nData.value._status.outdated_translations.templates[mainKey].lastUpdated = new Date().toISOString()

      console.log(`[TranslationManager] Marked ${mainKey}.${subKey} as outdated (English updated)`)
    }
    // Clear outdated status if non-English translation is updated
    else if (lang !== 'en' && i18nData.value._status?.outdated_translations?.templates?.[mainKey]) {
      const outdatedFields = i18nData.value._status.outdated_translations.templates[mainKey].fields
      const fieldIndex = outdatedFields.indexOf(subKey)

      if (fieldIndex > -1) {
        // Remove this field from outdated list
        outdatedFields.splice(fieldIndex, 1)

        // If no more outdated fields, remove the entire entry
        if (outdatedFields.length === 0) {
          delete i18nData.value._status.outdated_translations.templates[mainKey]
        }

        console.log(`[TranslationManager] Cleared outdated status for ${mainKey}.${subKey}`)
      }
    }
  } else {
    // For tags and categories, key is the English value
    // Don't save 'en' to the data structure
    if (lang === 'en') {
      console.log('[TranslationManager] Skipping English save for tags/categories (key is the English value)')
      cancelEdit()
      return
    }

    if (!i18nData.value[activeSection.value][mainKey]) {
      i18nData.value[activeSection.value][mainKey] = {}
    }
    i18nData.value[activeSection.value][mainKey][lang] = cleanedValue
  }

  // Mark cell as modified
  modifiedCells.value.add(`${key}:${lang}`)

  cancelEdit()
}

// Check if a cell is being edited
const isCellEditing = (key: string, lang: string) => {
  return editingCell.value?.key === key && editingCell.value?.lang === lang
}

// Check if a cell is being translated
const isCellTranslating = (key: string, lang: string) => {
  return translatingCell.value === `${key}:${lang}`
}

// Check if a cell was modified
const isCellModified = (key: string, lang: string) => {
  return modifiedCells.value.has(`${key}:${lang}`)
}

// AI Translate single cell
const translateCell = async (key: string, lang: string, sourceText: string) => {
  if (!sourceText || lang === 'en') return

  const cellKey = `${key}:${lang}`
  translatingCell.value = cellKey

  try {
    console.log('[TranslationManager] AI translating:', { key, lang, sourceText })

    const response = await $fetch('/api/ai/translate/single', {
      method: 'POST',
      body: {
        sourceText,
        sourceLang: 'en',
        targetLang: lang
      }
    })

    if (response.success && response.translation) {
      // Auto-fill the textarea
      editValue.value = response.translation

      console.log('[TranslationManager] AI translation successful:', {
        key,
        lang,
        translation: response.translation,
        usage: response.usage
      })
    } else {
      throw new Error('Translation failed')
    }
  } catch (error: any) {
    console.error('[TranslationManager] AI translation failed:', error)

    let errorMessage = 'AI translation failed.'
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    alert(errorMessage)
  } finally {
    translatingCell.value = null
  }
}

// Toggle item selection
const toggleItemSelection = (key: string) => {
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key)
  } else {
    selectedItems.value.add(key)
  }
}

// Select/deselect all items
const toggleSelectAll = () => {
  if (selectedItems.value.size === filteredItems.value.length) {
    selectedItems.value.clear()
  } else {
    selectedItems.value.clear()
    filteredItems.value.forEach(item => {
      selectedItems.value.add(item.key)
    })
  }
}

// Check if all items are selected
const allSelected = computed(() => {
  return filteredItems.value.length > 0 && selectedItems.value.size === filteredItems.value.length
})

// Count selected items
const selectedCount = computed(() => selectedItems.value.size)

// Open custom prompt dialog
const openCustomPromptDialog = () => {
  if (selectedItems.value.size === 0) {
    alert('Please select at least one item to translate')
    return
  }

  // Load default prompt if not loaded
  if (!defaultSystemPrompt.value) {
    loadDefaultPrompt()
  }

  // Initialize custom prompt with default
  customSystemPrompt.value = defaultSystemPrompt.value || 'You are a professional translator. Translate the following text accurately while maintaining the original meaning and tone.'

  showCustomPromptDialog.value = true
}

// Execute batch translation with custom prompt
const executeCustomBatchTranslate = () => {
  showCustomPromptDialog.value = false
  batchTranslate(customSystemPrompt.value)
}

// Batch translate selected items
const batchTranslate = async (customPrompt?: string) => {
  if (selectedItems.value.size === 0) {
    alert('Please select at least one item to translate')
    return
  }

  // Special handling for single item - translate to all languages
  if (selectedItems.value.size === 1) {
    await translateSingleItemToAllLanguages(customPrompt)
    return
  }

  // Handle "All Languages" option
  if (batchTargetLang.value === 'all') {
    await translateMultipleItemsToAllLanguages(customPrompt)
    return
  }

  if (!batchTargetLang.value || batchTargetLang.value === 'en') {
    alert('Please select a valid target language (non-English)')
    return
  }

  batchTranslating.value = true
  showBatchDialog.value = true
  batchProgress.value = { current: 0, total: selectedItems.value.size, status: 'Starting...' }

  try {
    // Prepare items for batch translation
    const itemsToTranslate: Array<{ key: string; text: string }> = []

    for (const itemKey of selectedItems.value) {
      const item = filteredItems.value.find(i => i.key === itemKey)
      if (item && item.englishValue) {
        itemsToTranslate.push({
          key: itemKey,
          text: item.englishValue
        })
      }
    }

    console.log('[TranslationManager] Batch translating:', {
      count: itemsToTranslate.length,
      targetLang: batchTargetLang.value
    })

    batchProgress.value.status = `Translating ${itemsToTranslate.length} items to ${languages.find(l => l.code === batchTargetLang.value)?.name}...`

    // Call batch translation API
    const requestBody: any = {
      items: itemsToTranslate,
      sourceLang: 'en',
      targetLang: batchTargetLang.value
    }

    // Add custom prompt if provided
    if (customPrompt) {
      requestBody.systemPrompt = customPrompt
      console.log('[TranslationManager] Using custom system prompt for batch translation')
    }

    const response = await $fetch('/api/ai/translate/batch', {
      method: 'POST',
      body: requestBody
    })

    if (response.success) {
      console.log('[TranslationManager] Batch translation completed:', {
        succeeded: response.results.length,
        failed: response.failed.length,
        usage: response.usage
      })

      // Apply translations to i18nData
      let successCount = 0
      for (const result of response.results) {
        const item = filteredItems.value.find(i => i.key === result.key)
        if (item) {
          saveTranslation(result.key, batchTargetLang.value, result.translation)
          successCount++
        }
      }

      batchProgress.value.current = successCount
      batchProgress.value.status = `Successfully translated ${successCount} items!`

      // Show failed items if any
      if (response.failed.length > 0) {
        console.warn('[TranslationManager] Some items failed:', response.failed)
        batchProgress.value.status += ` (${response.failed.length} failed)`
      }

      // Clear selection after successful batch
      selectedItems.value.clear()

      // Auto-close dialog after 3 seconds
      setTimeout(() => {
        showBatchDialog.value = false
      }, 3000)
    } else {
      throw new Error('Batch translation failed')
    }
  } catch (error: any) {
    console.error('[TranslationManager] Batch translation failed:', error)

    let errorMessage = 'Batch translation failed.'
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    batchProgress.value.status = `Error: ${errorMessage}`
    alert(errorMessage)
  } finally {
    batchTranslating.value = false
  }
}

// Translate single selected item to all languages
const translateSingleItemToAllLanguages = async (customPrompt?: string) => {
  const itemKey = Array.from(selectedItems.value)[0]
  const item = filteredItems.value.find(i => i.key === itemKey)

  if (!item || !item.englishValue) {
    alert('Cannot find item or English text')
    return
  }

  batchTranslating.value = true
  showBatchDialog.value = true

  // Get all non-English language codes
  const targetLangs = languages
    .filter(l => l.code !== 'en')
    .map(l => l.code)

  batchProgress.value = {
    current: 0,
    total: targetLangs.length,
    status: `Translating "${item.englishValue.substring(0, 50)}..." to ${targetLangs.length} languages...`
  }

  try {
    console.log('[TranslationManager] Multi-language translation:', {
      key: itemKey,
      text: item.englishValue,
      targetLangs: targetLangs.length,
      customPrompt: !!customPrompt
    })

    const requestBody: any = {
      sourceText: item.englishValue,
      sourceLang: 'en',
      targetLangs
    }

    // Add custom prompt if provided
    if (customPrompt) {
      requestBody.systemPrompt = customPrompt
      console.log('[TranslationManager] Using custom system prompt for multi-language translation')
    }

    const response = await $fetch('/api/ai/translate/multi-lang', {
      method: 'POST',
      body: requestBody
    })

    if (response.success) {
      console.log('[TranslationManager] Multi-language translation completed:', {
        succeeded: Object.keys(response.translations).length,
        failed: response.failed?.length || 0,
        usage: response.usage
      })

      // Apply all translations
      let successCount = 0
      for (const [lang, translation] of Object.entries(response.translations)) {
        saveTranslation(itemKey, lang, translation as string)
        successCount++
        batchProgress.value.current = successCount
      }

      batchProgress.value.status = `Successfully translated to ${successCount} languages!`

      // Show failed languages if any
      if (response.failed && response.failed.length > 0) {
        console.warn('[TranslationManager] Some languages failed:', response.failed)
        batchProgress.value.status += ` (${response.failed.length} failed: ${response.failed.join(', ')})`
      }

      // Clear selection
      selectedItems.value.clear()

      // Auto-close after 3 seconds
      setTimeout(() => {
        showBatchDialog.value = false
      }, 3000)
    } else {
      throw new Error('Multi-language translation failed')
    }
  } catch (error: any) {
    console.error('[TranslationManager] Multi-language translation failed:', error)

    let errorMessage = 'Multi-language translation failed.'
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    batchProgress.value.status = `Error: ${errorMessage}`
    alert(errorMessage)
  } finally {
    batchTranslating.value = false
  }
}

// Translate multiple selected items to all languages
const translateMultipleItemsToAllLanguages = async (customPrompt?: string) => {
  const selectedKeys = Array.from(selectedItems.value)
  const itemsToTranslate = filteredItems.value.filter(i => selectedKeys.includes(i.key))

  if (itemsToTranslate.length === 0 || itemsToTranslate.some(i => !i.englishValue)) {
    alert('Cannot find items or English text')
    return
  }

  batchTranslating.value = true
  showBatchDialog.value = true

  // Get all non-English language codes
  const targetLangs = languages
    .filter(l => l.code !== 'en')
    .map(l => l.code)

  const totalOperations = itemsToTranslate.length
  batchProgress.value = {
    current: 0,
    total: totalOperations,
    status: `Translating ${totalOperations} items to all ${targetLangs.length} languages...`
  }

  try {
    let successCount = 0
    let failedCount = 0

    // Process each item
    for (const item of itemsToTranslate) {
      try {
        console.log('[TranslationManager] Multi-language translation for item:', {
          key: item.key,
          text: item.englishValue,
          targetLangs: targetLangs.length,
          customPrompt: !!customPrompt
        })

        batchProgress.value.status = `Translating "${item.key}" (${successCount + 1}/${totalOperations})...`

        const requestBody: any = {
          sourceText: item.englishValue,
          sourceLang: 'en',
          targetLangs
        }

        // Add custom prompt if provided
        if (customPrompt) {
          requestBody.systemPrompt = customPrompt
        }

        const response = await $fetch('/api/ai/translate/multi-lang', {
          method: 'POST',
          body: requestBody
        })

        if (response.success) {
          // Apply all translations for this item
          for (const [lang, translation] of Object.entries(response.translations)) {
            saveTranslation(item.key, lang, translation as string)
          }
          successCount++
          batchProgress.value.current = successCount
        } else {
          failedCount++
          console.warn('[TranslationManager] Failed to translate item:', item.key)
        }
      } catch (error: any) {
        failedCount++
        console.error('[TranslationManager] Error translating item:', item.key, error)
      }
    }

    const summary = `Completed! Translated ${successCount} items to all languages.`
    batchProgress.value.status = failedCount > 0
      ? `${summary} (${failedCount} failed)`
      : summary

    console.log('[TranslationManager] Multiple items to all languages completed:', {
      succeeded: successCount,
      failed: failedCount,
      totalItems: totalOperations,
      totalLanguages: targetLangs.length
    })

    // Clear selection
    selectedItems.value.clear()

    // Auto-close after 3 seconds
    setTimeout(() => {
      showBatchDialog.value = false
    }, 3000)
  } catch (error: any) {
    console.error('[TranslationManager] Multiple items multi-language translation failed:', error)

    let errorMessage = 'Failed to translate multiple items to all languages.'
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    batchProgress.value.status = `Error: ${errorMessage}`
    alert(errorMessage)
  } finally {
    batchTranslating.value = false
  }
}

// Close batch dialog
const closeBatchDialog = () => {
  if (!batchTranslating.value) {
    showBatchDialog.value = false
  }
}

// Handle main branch warning confirmation
const handleConfirmMainBranchSave = () => {
  pendingSave.value = true
  saveAllChanges()
}

// Handle main branch warning cancellation
const handleCancelMainBranchSave = () => {
  pendingSave.value = false

  // If user cancels on opening warning, close translation manager
  if (warningTiming.value === 'opening') {
    emit('update:open', false)
  }
}

// Save all changes
const saveAllChanges = async () => {
  if (!i18nData.value) return

  const { selectedRepo, selectedBranch } = useGitHubRepo()
  const branch = selectedBranch.value

  // Check if committing to main branch and show warning if needed
  const isMainBranch = branch === 'main' || branch === 'master'

  // If on main branch and haven't confirmed yet, show warning dialog
  if (isMainBranch && !pendingSave.value) {
    warningTiming.value = 'saving'
    showMainBranchWarning.value = true
    return
  }

  // Reset pending save flag after proceeding
  pendingSave.value = false

  saving.value = true
  saveSuccess.value = null
  saveError.value = null

  try {
    const repo = selectedRepo.value

    console.log('[TranslationManager] Saving i18n data to:', { repo, branch })

    const response = await $fetch('/api/github/i18n/update', {
      method: 'POST',
      body: {
        repo,
        branch,
        i18nData: i18nData.value
      }
    })

    console.log('[TranslationManager] Translations saved and synced successfully:', response)

    // Set success state with commit info
    saveSuccess.value = {
      commitSha: response.commit.sha,
      commitUrl: response.commit.url
    }

    // Clear modified cells tracking
    modifiedCells.value.clear()

    // Clear success message after 5 seconds
    setTimeout(() => {
      saveSuccess.value = null
    }, 5000)
  } catch (error: any) {
    console.error('[TranslationManager] Failed to save translations:', error)

    let errorMessage = 'Failed to save translations.'
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    saveError.value = errorMessage

    // Clear error message after 5 seconds
    setTimeout(() => {
      saveError.value = null
    }, 5000)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="w-[98vw] h-[98vh] max-w-none overflow-hidden flex flex-col p-6">
      <DialogHeader>
        <DialogTitle>Translation Manager</DialogTitle>
        <DialogDescription>
          Manage translations for templates, tags, and categories across all languages
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex items-center justify-center h-[400px]">
        <div class="text-muted-foreground">Loading translations...</div>
      </div>

      <div v-else-if="i18nData" class="flex-1 flex flex-col gap-2 min-h-0">
        <!-- Controls -->
        <div class="flex flex-col gap-3 border-b pb-3 flex-shrink-0">
          <!-- Section tabs -->
          <div class="flex gap-2">
            <Button
              v-for="section in ['templates', 'tags', 'categories'] as TranslationSection[]"
              :key="section"
              :variant="activeSection === section ? 'default' : 'outline'"
              size="sm"
              @click="activeSection = section"
            >
              {{ section.charAt(0).toUpperCase() + section.slice(1) }}
            </Button>
          </div>

          <!-- Filters and language selector -->
          <div class="flex gap-3 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <Input
                v-model="searchQuery"
                placeholder="Search..."
                class="w-full"
              />
            </div>

            <Select v-model="activeLanguage">
              <SelectTrigger class="w-[200px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                <SelectItem
                  v-for="lang in languages.filter(l => l.code !== 'en')"
                  :key="lang.code"
                  :value="lang.code"
                >
                  {{ lang.name }}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select v-model="filterMode">
              <SelectTrigger class="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({{ stats.total }})</SelectItem>
                <SelectItem value="new">🆕 New ({{ stats.new }})</SelectItem>
                <SelectItem value="modified">✏️ Modified ({{ stats.modified }})</SelectItem>
                <SelectItem value="outdated">⚠️ Outdated ({{ stats.outdated }})</SelectItem>
                <SelectItem value="untranslated">
                  🌐 Untranslated ({{ stats.untranslated }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Batch translation bar -->
          <div v-if="aiEnabled && selectedCount > 0" class="flex items-center gap-3 p-3 bg-accent/50 rounded-md border border-border">
            <span class="text-sm font-medium">
              {{ selectedCount }} item{{ selectedCount > 1 ? 's' : '' }} selected
            </span>

            <Select v-model="batchTargetLang" class="flex-shrink-0">
              <SelectTrigger class="w-[180px]">
                <SelectValue placeholder="Target language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  🌐 All Languages
                </SelectItem>
                <SelectItem
                  v-for="lang in languages.filter(l => l.code !== 'en')"
                  :key="lang.code"
                  :value="lang.code"
                >
                  {{ lang.name }}
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              @click="batchTranslate()"
              :disabled="batchTranslating || !batchTargetLang"
              size="sm"
              class="flex-shrink-0"
            >
              <svg
                v-if="batchTranslating"
                class="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {{ batchTranslating ? 'Translating...' : 'Batch Translate' }}
            </Button>

            <Button
              @click="openCustomPromptDialog"
              :disabled="batchTranslating || !batchTargetLang"
              variant="outline"
              size="sm"
              class="flex-shrink-0"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Custom Translate
            </Button>

            <Button
              @click="selectedItems.clear()"
              variant="ghost"
              size="sm"
              class="flex-shrink-0"
            >
              Clear Selection
            </Button>
          </div>
        </div>

        <!-- Translation table -->
        <div class="flex-1 min-h-[300px] border rounded-md relative">
          <div class="absolute inset-0 overflow-auto">
            <Table>
              <TableHeader class="sticky-header">
                <TableRow class="hover:bg-transparent bg-background">
                  <!-- Checkbox column for batch selection -->
                  <TableHead v-if="aiEnabled" class="w-[50px] bg-background">
                    <input
                      type="checkbox"
                      :checked="allSelected"
                      @change="toggleSelectAll"
                      class="w-4 h-4 cursor-pointer"
                      title="Select/Deselect all"
                    />
                  </TableHead>
                  <TableHead class="w-[250px] font-semibold bg-background">Key</TableHead>
                  <TableHead
                    v-for="lang in visibleLanguages"
                    :key="lang.code"
                    class="min-w-[200px] font-semibold bg-background"
                  >
                    {{ lang.name }}
                  </TableHead>
                  <TableHead class="w-[100px] font-semibold bg-background">Status</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              <TableRow
                v-for="item in filteredItems"
                :key="item.key"
                :class="{
                  'bg-red-50': item.isOutdated,
                  'bg-amber-50': !item.isOutdated && item.untranslatedLangs.length > 0
                }"
              >
                <!-- Checkbox column -->
                <TableCell v-if="aiEnabled" class="align-top py-2">
                  <input
                    type="checkbox"
                    :checked="selectedItems.has(item.key)"
                    @change="toggleItemSelection(item.key)"
                    class="w-4 h-4 cursor-pointer"
                  />
                </TableCell>

                <!-- Key column -->
                <TableCell class="font-mono text-xs align-top py-2">
                  <div class="truncate" :title="item.key">{{ item.key }}</div>
                </TableCell>

                <!-- Language columns -->
                <TableCell
                  v-for="lang in visibleLanguages"
                  :key="lang.code"
                  class="align-top py-2"
                >
                  <div
                    v-if="isCellEditing(item.key, lang.code)"
                    class="flex flex-col gap-1"
                  >
                    <div class="relative">
                      <Textarea
                        v-model="editValue"
                        class="text-sm min-h-[80px] resize-y pr-10"
                        @keyup.ctrl.enter="saveTranslation(item.key, lang.code, editValue)"
                        @keyup.meta.enter="saveTranslation(item.key, lang.code, editValue)"
                        @keyup.esc="cancelEdit"
                        placeholder="Enter translation..."
                        autofocus
                      />
                      <!-- AI Translate Button -->
                      <Button
                        v-if="aiEnabled && lang.code !== 'en'"
                        size="sm"
                        variant="ghost"
                        class="absolute top-1 right-1 h-7 w-7 p-0"
                        :disabled="isCellTranslating(item.key, lang.code) || !item.englishValue"
                        @click="translateCell(item.key, lang.code, item.englishValue)"
                        :title="isCellTranslating(item.key, lang.code) ? 'Translating...' : 'AI Translate'"
                      >
                        <svg
                          v-if="isCellTranslating(item.key, lang.code)"
                          class="h-4 w-4 animate-spin text-blue-600"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <svg
                          v-else
                          class="h-4 w-4 text-purple-600"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </Button>
                    </div>
                    <div class="flex gap-1 items-center flex-wrap">
                      <Button size="sm" class="h-6 text-xs px-2" @click="saveTranslation(item.key, lang.code, editValue)">
                        Save
                      </Button>
                      <Button size="sm" variant="outline" class="h-6 text-xs px-2" @click="cancelEdit">
                        Cancel
                      </Button>
                      <span class="text-[10px] text-muted-foreground">Ctrl+Enter to save • Line breaks will be removed</span>
                    </div>
                  </div>
                  <div
                    v-else
                    class="text-sm p-1.5 rounded min-h-[32px] border"
                    :class="{
                      'text-muted-foreground italic': !item.translations[lang.code] || (lang.code !== 'en' && item.translations[lang.code] === item.englishValue),
                      'bg-amber-100 border-amber-300': lang.code !== 'en' && item.untranslatedLangs.includes(lang.code) && !isCellModified(item.key, lang.code),
                      'bg-blue-50 border-blue-200': lang.code === 'en',
                      'bg-green-50 border-green-400 border-2': isCellModified(item.key, lang.code),
                      'border-transparent': !isCellModified(item.key, lang.code) && lang.code !== 'en' && !item.untranslatedLangs.includes(lang.code),
                      'cursor-pointer hover:bg-accent transition-colors': !(lang.code === 'en' && (activeSection === 'tags' || activeSection === 'categories')),
                      'cursor-not-allowed opacity-60': lang.code === 'en' && (activeSection === 'tags' || activeSection === 'categories')
                    }"
                    :title="lang.code === 'en' && (activeSection === 'tags' || activeSection === 'categories') ? 'English value is the key itself (cannot be edited)' : (item.translations[lang.code] || '(empty - click to edit)')"
                    @click="!(lang.code === 'en' && (activeSection === 'tags' || activeSection === 'categories')) && startEditCell(item.key, lang.code, item.translations[lang.code])"
                  >
                    {{ item.translations[lang.code] || '(click to edit)' }}
                  </div>
                </TableCell>

                <!-- Status column -->
                <TableCell class="align-top py-2">
                  <div class="flex flex-col gap-1">
                    <Badge v-if="item.isOutdated" variant="destructive" class="text-[10px] px-1.5 py-0">
                      Outdated
                    </Badge>
                    <Badge v-if="item.untranslatedLangs.length > 0" variant="secondary" class="text-[10px] px-1.5 py-0">
                      {{ item.untranslatedLangs.length }} untranslated
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>

              <TableRow v-if="filteredItems.length === 0">
                <TableCell :colspan="visibleLanguages.length + 2" class="text-center text-muted-foreground py-12">
                  No translations found matching your criteria
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          </div>
        </div>

        <!-- Actions -->
        <div class="border-t pt-3 flex justify-between items-center flex-shrink-0">
          <div class="text-sm text-muted-foreground">
            Showing {{ filteredItems.length }} of {{ stats.total }} items
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="flex gap-2">
              <Button variant="outline" @click="emit('update:open', false)" :disabled="saving">
                Cancel
              </Button>
              <Button @click="saveAllChanges" :disabled="saving">
                <svg v-if="saving" class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ saving ? 'Saving...' : 'Save & Sync All' }}
              </Button>
            </div>

            <!-- Success Message -->
            <div v-if="saveSuccess" class="text-xs text-green-600 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Translations saved and synced successfully!</span>
              <a :href="saveSuccess.commitUrl" target="_blank" class="text-blue-600 hover:underline font-mono">
                {{ saveSuccess.commitSha.substring(0, 7) }}
              </a>
            </div>

            <!-- Error Message -->
            <div v-if="saveError" class="text-xs text-red-600 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{{ saveError }}</span>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Batch Translation Progress Dialog -->
  <Dialog :open="showBatchDialog" @update:open="closeBatchDialog">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Batch Translation Progress</DialogTitle>
        <DialogDescription>
          Translating multiple items to {{ languages.find(l => l.code === batchTargetLang)?.name }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-4">
        <!-- Progress bar -->
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span>Progress</span>
            <span>{{ batchProgress.current }} / {{ batchProgress.total }}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              :style="{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }"
            ></div>
          </div>
        </div>

        <!-- Status message -->
        <div class="text-sm text-muted-foreground">
          {{ batchProgress.status }}
        </div>

        <!-- Spinner when translating -->
        <div v-if="batchTranslating" class="flex items-center justify-center py-4">
          <svg
            class="animate-spin h-8 w-8 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>

        <!-- Success checkmark when done -->
        <div v-else-if="batchProgress.current === batchProgress.total && batchProgress.total > 0" class="flex items-center justify-center py-4">
          <svg class="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <div class="flex justify-end">
        <Button
          @click="closeBatchDialog"
          :disabled="batchTranslating"
          variant="outline"
        >
          {{ batchTranslating ? 'Please wait...' : 'Close' }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Custom Prompt Dialog -->
  <Dialog :open="showCustomPromptDialog" @update:open="(val) => showCustomPromptDialog = val">
    <DialogContent class="max-w-2xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Custom Translation Prompt</DialogTitle>
        <DialogDescription>
          Edit the system prompt to customize how AI translates your content. You can provide additional context, specify tone, or add domain-specific guidance.
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-auto py-4">
        <div class="space-y-4">
          <!-- Help text -->
          <div class="text-sm text-muted-foreground bg-accent/30 border border-border rounded-md p-3">
            <div class="font-medium mb-2">Tips for customizing prompts:</div>
            <ul class="list-disc list-inside space-y-1 text-xs">
              <li>Add domain-specific context (e.g., "This is technical documentation for developers")</li>
              <li>Specify tone or style (e.g., "Use professional and formal language")</li>
              <li>Provide terminology guidelines (e.g., "Translate 'workflow' as '工作流程', not '流程'")</li>
              <li>Give examples of correct translations for specific terms</li>
            </ul>
          </div>

          <!-- Textarea for editing prompt -->
          <div class="space-y-2">
            <label class="text-sm font-medium">System Prompt</label>
            <textarea
              v-model="customSystemPrompt"
              class="w-full min-h-[300px] p-3 rounded-md border border-input bg-background text-sm font-mono resize-y"
              placeholder="Enter your custom system prompt here..."
            />
          </div>

          <!-- Info about target language -->
          <div class="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 flex items-start gap-2">
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              This will translate {{ selectedCount }} item{{ selectedCount > 1 ? 's' : '' }} to
              <strong>{{ batchTargetLang === 'all' ? 'All Languages' : languages.find(l => l.code === batchTargetLang)?.name }}</strong>
            </span>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 border-t pt-4">
        <Button
          @click="showCustomPromptDialog = false"
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          @click="executeCustomBatchTranslate"
          :disabled="!customSystemPrompt.trim()"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Execute Translation
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Main Branch Warning Dialog -->
  <MainBranchWarningDialog
    v-model:open="showMainBranchWarning"
    :repo="useGitHubRepo().selectedRepo.value"
    :branch="useGitHubRepo().selectedBranch.value"
    :timing="warningTiming"
    action-type="Save Translations"
    @confirm="handleConfirmMainBranchSave"
    @cancel="handleCancelMainBranchSave"
  />
</template>

<style scoped>
/* Fixed sticky header - only scroll inside table container */
:deep(.sticky-header) {
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: hsl(var(--background));
}

:deep(.sticky-header tr) {
  background-color: hsl(var(--background));
}

:deep(.sticky-header th) {
  position: sticky;
  top: 0;
  background-color: hsl(var(--background));
  z-index: 20;
  border-bottom: 1px solid hsl(var(--border));
}

/* Add shadow for better visual separation */
:deep(.sticky-header)::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.05), transparent);
  pointer-events: none;
}
</style>
