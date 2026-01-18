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
const filterMode = ref<'all' | 'outdated' | 'untranslated'>('untranslated')
const searchQuery = ref('')
const editingCell = ref<{ key: string; lang: string } | null>(null)
const editValue = ref('')

// Translation sections
type TranslationSection = 'templates' | 'tags' | 'categories'
const activeSection = ref<TranslationSection>('templates')

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

// Watch dialog open state
watch(() => props.open, (isOpen) => {
  if (isOpen && !i18nData.value) {
    loadI18nData()
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
      const translations: Record<string, string> = {}
      for (const lang of languages) {
        translations[lang.code] = (value as any)[lang.code] || ''
      }

      const untranslatedLangs = languages
        .filter(l => l.code !== 'en' && translations[l.code] === translations['en'])
        .map(l => l.code)

      items.push({
        key,
        type: activeSection.value,
        englishValue: translations.en || '',
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

  return { total, outdated, untranslated }
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
    if (!i18nData.value[activeSection.value][mainKey]) {
      i18nData.value[activeSection.value][mainKey] = {}
    }
    i18nData.value[activeSection.value][mainKey][lang] = cleanedValue
  }

  cancelEdit()
}

// Check if a cell is being edited
const isCellEditing = (key: string, lang: string) => {
  return editingCell.value?.key === key && editingCell.value?.lang === lang
}

// Save all changes
const saveAllChanges = async () => {
  if (!i18nData.value) return

  saving.value = true
  saveSuccess.value = null
  saveError.value = null

  try {
    const { selectedRepo, selectedBranch } = useGitHubRepo()
    const repo = selectedRepo.value
    const branch = selectedBranch.value

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
    <DialogContent class="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>Translation Manager</DialogTitle>
        <DialogDescription>
          Manage translations for templates, tags, and categories across all languages
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex items-center justify-center h-[400px]">
        <div class="text-muted-foreground">Loading translations...</div>
      </div>

      <div v-else-if="i18nData" class="flex-1 flex flex-col gap-4 overflow-hidden">
        <!-- Controls -->
        <div class="flex flex-col gap-3 border-b pb-4">
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
                <SelectItem value="outdated">Outdated ({{ stats.outdated }})</SelectItem>
                <SelectItem value="untranslated">
                  Untranslated ({{ stats.untranslated }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Translation table -->
        <div class="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader class="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead class="w-[250px] font-semibold">Key</TableHead>
                <TableHead
                  v-for="lang in visibleLanguages"
                  :key="lang.code"
                  class="min-w-[200px] font-semibold"
                >
                  {{ lang.name }}
                </TableHead>
                <TableHead class="w-[100px] font-semibold">Status</TableHead>
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
                    <Textarea
                      v-model="editValue"
                      class="text-sm min-h-[80px] resize-y"
                      @keyup.ctrl.enter="saveTranslation(item.key, lang.code, editValue)"
                      @keyup.meta.enter="saveTranslation(item.key, lang.code, editValue)"
                      @keyup.esc="cancelEdit"
                      placeholder="Enter translation..."
                      autofocus
                    />
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
                    class="text-sm p-1.5 rounded cursor-pointer hover:bg-accent transition-colors min-h-[32px]"
                    :class="{
                      'text-muted-foreground italic': !item.translations[lang.code] || (lang.code !== 'en' && item.translations[lang.code] === item.englishValue),
                      'bg-amber-100': lang.code !== 'en' && item.untranslatedLangs.includes(lang.code),
                      'bg-blue-50': lang.code === 'en'
                    }"
                    :title="item.translations[lang.code] || '(empty - click to edit)'"
                    @click="startEditCell(item.key, lang.code, item.translations[lang.code])"
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

        <!-- Actions -->
        <div class="border-t pt-4 flex justify-between items-center">
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
</template>
