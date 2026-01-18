<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
const i18nData = ref<any>(null)
const activeLanguage = ref('zh') // Default to Chinese for easier translation
const filterMode = ref<'all' | 'outdated' | 'untranslated'>('untranslated')
const searchQuery = ref('')
const editingKey = ref<string | null>(null)
const editValue = ref('')

// Translation sections
type TranslationSection = 'templates' | 'tags' | 'categories'
const activeSection = ref<TranslationSection>('templates')

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
    items = items.filter(item => item.untranslatedLangs.includes(activeLanguage.value))
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
  const untranslated = translationItems.value.filter(item =>
    item.untranslatedLangs.includes(activeLanguage.value)
  ).length

  return { total, outdated, untranslated }
})

// Start editing
const startEdit = (key: string, currentValue: string) => {
  editingKey.value = key
  editValue.value = currentValue
}

// Cancel editing
const cancelEdit = () => {
  editingKey.value = null
  editValue.value = ''
}

// Save single translation
const saveTranslation = (key: string, value: string) => {
  if (!i18nData.value) return

  const [mainKey, subKey] = key.includes('.') ? key.split('.') : [key, null]
  const lang = activeLanguage.value

  if (activeSection.value === 'templates' && subKey) {
    if (!i18nData.value.templates[mainKey]) {
      i18nData.value.templates[mainKey] = { title: {}, description: {} }
    }
    if (!i18nData.value.templates[mainKey][subKey]) {
      i18nData.value.templates[mainKey][subKey] = {}
    }
    i18nData.value.templates[mainKey][subKey][lang] = value
  } else {
    if (!i18nData.value[activeSection.value][mainKey]) {
      i18nData.value[activeSection.value][mainKey] = {}
    }
    i18nData.value[activeSection.value][mainKey][lang] = value
  }

  cancelEdit()
}

// Save all changes
const saveAllChanges = async () => {
  if (!i18nData.value) return

  saving.value = true
  try {
    const { selectedRepo, selectedBranch } = useGitHubRepo()
    const repo = selectedRepo.value
    const branch = selectedBranch.value

    console.log('[TranslationManager] Saving i18n data to:', { repo, branch })

    await $fetch('/api/github/i18n/update', {
      method: 'POST',
      body: {
        repo,
        branch,
        i18nData: i18nData.value
      }
    })

    console.log('[TranslationManager] Translations saved and synced successfully')
    alert('Translations saved and synced successfully!')
    emit('update:open', false)
  } catch (error: any) {
    console.error('[TranslationManager] Failed to save translations:', error)

    let errorMessage = 'Failed to save translations.'
    if (error.data?.message) {
      errorMessage = `Error: ${error.data.message}`
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`
    }

    alert(errorMessage)
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
              <SelectTrigger class="w-[180px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
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
                  Untranslated in {{ languages.find(l => l.code === activeLanguage)?.name }} ({{ stats.untranslated }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Translation list -->
        <div class="flex-1 overflow-y-auto space-y-3 pr-2">
          <div
            v-for="item in filteredItems"
            :key="item.key"
            class="border rounded-lg p-4 space-y-3"
            :class="{
              'border-red-500 bg-red-50': item.isOutdated,
              'border-amber-500 bg-amber-50': item.untranslatedLangs.includes(activeLanguage)
            }"
          >
            <!-- Header -->
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="font-mono text-xs text-muted-foreground truncate">{{ item.key }}</div>
                <div class="flex gap-2 mt-1">
                  <span v-if="item.isOutdated" class="text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded">
                    Outdated
                  </span>
                  <span v-if="item.untranslatedLangs.includes(activeLanguage)" class="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded">
                    Needs translation
                  </span>
                </div>
              </div>
            </div>

            <!-- English (reference) -->
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">English (Reference)</Label>
              <div class="text-sm p-2 rounded border bg-muted">
                {{ item.englishValue }}
              </div>
            </div>

            <!-- Target language -->
            <div class="space-y-1">
              <Label class="text-xs font-medium">
                {{ languages.find(l => l.code === activeLanguage)?.name }}
              </Label>
              <div v-if="editingKey === item.key" class="flex gap-2">
                <Input
                  v-model="editValue"
                  class="flex-1"
                  @keyup.enter="saveTranslation(item.key, editValue)"
                  @keyup.esc="cancelEdit"
                  autofocus
                />
                <Button size="sm" @click="saveTranslation(item.key, editValue)">
                  Save
                </Button>
                <Button size="sm" variant="outline" @click="cancelEdit">
                  Cancel
                </Button>
              </div>
              <div
                v-else
                class="text-sm p-2 rounded border cursor-pointer hover:bg-accent transition-colors"
                :class="{
                  'text-muted-foreground italic': !item.translations[activeLanguage] || item.translations[activeLanguage] === item.englishValue,
                  'border-amber-500': item.untranslatedLangs.includes(activeLanguage)
                }"
                @click="startEdit(item.key, item.translations[activeLanguage])"
              >
                {{ item.translations[activeLanguage] || '(empty - click to translate)' }}
              </div>
            </div>
          </div>

          <div v-if="filteredItems.length === 0" class="text-center text-muted-foreground py-12">
            No translations found matching your criteria
          </div>
        </div>

        <!-- Actions -->
        <div class="border-t pt-4 flex justify-between items-center">
          <div class="text-sm text-muted-foreground">
            Showing {{ filteredItems.length }} of {{ stats.total }} items
          </div>
          <div class="flex gap-2">
            <Button variant="outline" @click="emit('update:open', false)" :disabled="saving">
              Cancel
            </Button>
            <Button @click="saveAllChanges" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save & Sync All' }}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
