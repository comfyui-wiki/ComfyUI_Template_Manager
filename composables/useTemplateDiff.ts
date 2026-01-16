import { ref, computed, watch } from 'vue'
import { hash } from 'ohash'

// Cache helper functions
const getCacheKey = (owner: string, repo: string, branch: string) => {
  return `templates_cache_${owner}_${repo}_${branch}`
}

const getCachedData = (key: string) => {
  if (process.client) {
    try {
      const cached = localStorage.getItem(key)
      if (cached) {
        const data = JSON.parse(cached)
        // Check if cache is less than 5 minutes old
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          console.log('[Cache] Using cached data for', key)
          return data.categories
        } else {
          console.log('[Cache] Cache expired for', key)
        }
      }
    } catch (err) {
      console.error('[Cache] Error reading cache:', err)
    }
  }
  return null
}

const setCachedData = (key: string, categories: any) => {
  if (process.client) {
    try {
      localStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        categories
      }))
      console.log('[Cache] Cached data for', key)
    } catch (err) {
      console.error('[Cache] Error setting cache:', err)
    }
  }
}

export const useTemplateDiff = () => {
  const currentTemplates = ref<any>(null)
  const mainTemplates = ref<any>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Main repository reference
  const mainRepo = {
    owner: 'Comfy-Org',
    name: 'workflow_templates',
    branch: 'main'
  }

  /**
   * Fetch templates from a specific repository and branch
   * @param forceRefresh - If true, bypasses cache and uses GitHub API for fresh data
   */
  const fetchTemplates = async (owner: string, repo: string, branch: string, forceRefresh = false) => {
    const cacheKey = getCacheKey(owner, repo, branch)

    // Try to use cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedData(cacheKey)
      if (cached) {
        console.log('[fetchTemplates] ⚡ Using cached data (click refresh to force latest)')
        return cached
      }
    } else {
      console.log('[fetchTemplates] 🔄 Force refresh - bypassing cache AND CDN, using GitHub API for fresh data')
    }

    try {
      console.log(`[fetchTemplates] 🌐 Fetching data from: ${owner}/${repo}/${branch}`)
      const response = await $fetch('/api/github/templates', {
        query: {
          owner,
          repo,
          branch,
          useApi: forceRefresh ? 'true' : 'false' // Use API when force refreshing to bypass CDN
        }
      })

      // Cache the fresh data
      setCachedData(cacheKey, response.categories)
      console.log(`[fetchTemplates] ✅ Data fetched via ${response.source?.method || 'unknown'} and cached`)

      return response.categories
    } catch (err: any) {
      console.error('Failed to fetch templates:', err)
      throw err
    }
  }

  /**
   * Load templates from main branch (always Comfy-Org/workflow_templates/main)
   */
  const loadMainTemplates = async () => {
    try {
      mainTemplates.value = await fetchTemplates(
        mainRepo.owner,
        mainRepo.name,
        mainRepo.branch
      )
    } catch (err: any) {
      console.error('Failed to load main templates:', err)
      error.value = 'Failed to load main branch templates'
    }
  }

  /**
   * Load templates from current branch
   * @param forceRefresh - If true, forces fresh fetch from API
   */
  const loadCurrentTemplates = async (owner: string, repo: string, branch: string, forceRefresh = false) => {
    console.log(`[useTemplateDiff] Loading templates from ${owner}/${repo}/${branch}`, forceRefresh ? '(force refresh)' : '(may use cache)')
    isLoading.value = true
    error.value = null

    try {
      // Load both current and main templates in parallel
      const [current, main] = await Promise.all([
        fetchTemplates(owner, repo, branch, forceRefresh),
        // Always fetch from main if not already loaded or force refresh
        (mainTemplates.value && !forceRefresh) ? Promise.resolve(mainTemplates.value) : fetchTemplates(mainRepo.owner, mainRepo.name, mainRepo.branch, forceRefresh)
      ])

      currentTemplates.value = current
      mainTemplates.value = main

      console.log('[useTemplateDiff] Current templates categories:', current?.length || 0)
      console.log('[useTemplateDiff] Main templates categories:', main?.length || 0)
      console.log('[useTemplateDiff] Is same branch as main?', owner === mainRepo.owner && repo === mainRepo.name && branch === mainRepo.branch)
    } catch (err: any) {
      console.error('[useTemplateDiff] Failed to load templates:', err)
      error.value = err.message || 'Failed to load templates'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Clear cache for specific or all repos
   */
  const clearCache = (owner?: string, repo?: string, branch?: string) => {
    if (process.client) {
      if (owner && repo && branch) {
        // Clear specific cache
        const key = getCacheKey(owner, repo, branch)
        localStorage.removeItem(key)
        console.log('[Cache] Cleared cache for', owner, repo, branch)
      } else {
        // Clear all template caches
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.startsWith('templates_cache_')) {
            localStorage.removeItem(key)
          }
        })
        console.log('[Cache] Cleared all template caches')
      }
    }
  }

  /**
   * Create a flat map of templates by name for quick lookup
   */
  const createTemplateMap = (categories: any[]) => {
    const map = new Map()
    categories?.forEach((category: any) => {
      category.templates?.forEach((template: any) => {
        map.set(template.name, {
          ...template,
          categoryTitle: category.title
        })
      })
    })
    return map
  }

  /**
   * Generate a hash for template content (for comparison)
   */
  const getTemplateHash = (template: any) => {
    // Hash relevant fields that indicate changes
    const relevantData = {
      title: template.title,
      description: template.description,
      thumbnail: template.thumbnail,
      thumbnailVariant: template.thumbnailVariant, // Include thumbnail variant
      models: template.models,
      tags: template.tags,
      openSource: template.openSource,
      audio: template.audio,
      hoverThumbnail: template.hoverThumbnail,
      tutorialUrl: template.tutorialUrl, // Include tutorial URL
      comfyuiVersion: template.comfyuiVersion, // Include ComfyUI version
      mediaType: template.mediaType, // Include media type
      mediaSubtype: template.mediaSubtype, // Include media subtype
      date: template.date // Include date
    }
    return hash(relevantData)
  }

  /**
   * Compare current templates with main branch templates
   * Returns enriched templates with status: 'new' | 'modified' | 'unchanged' | 'deleted'
   */
  const compareTemplates = computed(() => {
    if (!currentTemplates.value || !mainTemplates.value) {
      return null
    }

    const mainMap = createTemplateMap(mainTemplates.value)
    const currentMap = createTemplateMap(currentTemplates.value)

    const enrichedTemplates: any[] = []

    // Check each template in current branch
    currentMap.forEach((template, name) => {
      const mainTemplate = mainMap.get(name)

      let status = 'unchanged'
      if (!mainTemplate) {
        // Template doesn't exist in main branch - it's new
        status = 'new'
      } else {
        // Compare content to detect modifications
        const currentHash = getTemplateHash(template)
        const mainHash = getTemplateHash(mainTemplate)

        if (currentHash !== mainHash) {
          status = 'modified'
        }
      }

      enrichedTemplates.push({
        ...template,
        diffStatus: status
      })
    })

    // Check for templates that exist in main but not in current (deleted)
    mainMap.forEach((template, name) => {
      if (!currentMap.has(name)) {
        // Template exists in main but not in current branch - it's deleted
        enrichedTemplates.push({
          ...template,
          diffStatus: 'deleted'
        })
      }
    })

    return enrichedTemplates
  })

  /**
   * Get templates grouped by category with diff status
   * Includes templates from current branch AND deleted templates from main branch
   */
  const categoriesWithDiff = computed(() => {
    if (!currentTemplates.value || !compareTemplates.value) {
      return []
    }

    console.log('[categoriesWithDiff] Processing templates, preserving order from index.json')

    // Create a map of enriched templates
    const enrichedMap = new Map()
    compareTemplates.value.forEach((template: any) => {
      enrichedMap.set(template.name, template)
    })

    // Start with categories from current branch (preserves order)
    const categoriesMap = new Map()

    // Add all templates from current branch with their categories
    // Using forEach + Map preserves insertion order from currentTemplates
    currentTemplates.value.forEach((category: any) => {
      const categoryData = {
        ...category,
        templates: category.templates?.map((template: any) => {
          const enriched = enrichedMap.get(template.name)
          return enriched || template
        }) || []
      }
      console.log(`[categoriesWithDiff] Category "${category.title}" has ${categoryData.templates.length} templates in order:`,
        categoryData.templates.map((t: any) => t.name).slice(0, 5))
      categoriesMap.set(category.title, categoryData)
    })

    // Add deleted templates to their respective categories
    // Deleted templates have their categoryTitle from main branch
    compareTemplates.value.forEach((template: any) => {
      if (template.diffStatus === 'deleted') {
        const categoryTitle = template.categoryTitle

        if (!categoriesMap.has(categoryTitle)) {
          // Category doesn't exist in current branch, create it
          categoriesMap.set(categoryTitle, {
            title: categoryTitle,
            templates: []
          })
        }

        // Add deleted template to the category
        const category = categoriesMap.get(categoryTitle)
        if (category && !category.templates.find((t: any) => t.name === template.name)) {
          category.templates.push(template)
        }
      }
    })

    return Array.from(categoriesMap.values())
  })

  /**
   * Get count of new, modified, unchanged, and deleted templates
   */
  const diffStats = computed(() => {
    if (!compareTemplates.value) {
      return { new: 0, modified: 0, unchanged: 0, deleted: 0 }
    }

    const stats = {
      new: 0,
      modified: 0,
      unchanged: 0,
      deleted: 0
    }

    compareTemplates.value.forEach((template: any) => {
      if (template.diffStatus === 'new') {
        stats.new++
      } else if (template.diffStatus === 'modified') {
        stats.modified++
      } else if (template.diffStatus === 'deleted') {
        stats.deleted++
      } else {
        stats.unchanged++
      }
    })

    return stats
  })

  /**
   * Check if current branch is the main branch
   */
  const isMainBranch = (owner: string, repo: string, branch: string) => {
    return (
      owner === mainRepo.owner &&
      repo === mainRepo.name &&
      branch === mainRepo.branch
    )
  }

  return {
    // State
    currentTemplates,
    mainTemplates,
    isLoading,
    error,

    // Computed
    compareTemplates,
    categoriesWithDiff,
    diffStats,

    // Methods
    loadMainTemplates,
    loadCurrentTemplates,
    isMainBranch,
    clearCache
  }
}
