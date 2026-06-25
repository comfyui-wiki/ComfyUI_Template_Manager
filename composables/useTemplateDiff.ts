import { ref, computed, watch } from 'vue'
import { hash } from 'ohash'
import bundleMappingRules from '~/config/bundle-mapping-rules.json'
import {
  buildTemplateToBundleMap,
  compareBundleChanges,
  type BundleDiffResult,
  type BundlesData
} from '~/lib/bundle-diff'

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
        if (Date.now() - data.timestamp < 5 * 60 * 1000 && Array.isArray(data.categories)) {
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

const getBundleLabel = (bundleId: string) =>
  bundleMappingRules.bundles?.[bundleId as keyof typeof bundleMappingRules.bundles]?.label || bundleId

const getBundlePypiPackage = (bundleId: string) =>
  bundleMappingRules.bundles?.[bundleId as keyof typeof bundleMappingRules.bundles]?.pypiPackage || null

const fetchBundlesJson = async (owner: string, repo: string, branch: string): Promise<BundlesData> => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/bundles.json?t=${Date.now()}`,
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    if (!response.ok) return {}
    return await response.json()
  } catch (err) {
    console.warn('[fetchBundlesJson] Failed (non-blocking):', err)
    return {}
  }
}

export const useTemplateDiff = () => {
  const currentTemplates = ref<any>(null)
  const mainTemplates = ref<any>(null)
  const currentBundles = ref<BundlesData>({})
  const mainBundles = ref<BundlesData>({})
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Main repository reference
  const mainRepo = {
    owner: 'Comfy-Org',
    name: 'workflow_templates',
    branch: 'main'
  }

  const isForkBranch = (owner: string, repo: string, branch: string) => {
    return !(
      owner === mainRepo.owner &&
      repo === mainRepo.name &&
      branch === mainRepo.branch
    )
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
      console.log('[fetchTemplates] 🔄 Force refresh - bypassing cache')
    }

    console.log(`[fetchTemplates] 🌐 Fetching data from: ${owner}/${repo}/${branch}`)
    const useApi = forceRefresh || isForkBranch(owner, repo, branch)
    const response = await $fetch('/api/github/templates', {
      query: {
        owner,
        repo,
        branch,
        useApi: useApi ? 'true' : 'false'
      }
    })

    setCachedData(cacheKey, response.categories)
    console.log(`[fetchTemplates] ✅ Data fetched via ${response.source?.method || 'unknown'} and cached`)
    return response.categories
  }

  /** Load main/bundle comparison data in background — never blocks the template list */
  const loadComparisonInBackground = async (owner: string, repo: string, branch: string, forceRefresh = false) => {
    const skipMain = owner === mainRepo.owner && repo === mainRepo.name && branch === mainRepo.branch

    if (forceRefresh) {
      clearCache(mainRepo.owner, mainRepo.name, mainRepo.branch)
      mainTemplates.value = null
    }

    const tasks: Promise<void>[] = []

    if (!skipMain) {
      tasks.push((async () => {
        try {
          if (mainTemplates.value) return
          mainTemplates.value = await fetchTemplates(
            mainRepo.owner,
            mainRepo.name,
            mainRepo.branch,
            false
          )
        } catch (err) {
          console.warn('[useTemplateDiff] Main branch comparison unavailable:', err)
        }
      })())
    } else {
      mainTemplates.value = currentTemplates.value
    }

    tasks.push((async () => {
      currentBundles.value = await fetchBundlesJson(owner, repo, branch)
    })())

    tasks.push((async () => {
      mainBundles.value = await fetchBundlesJson(mainRepo.owner, mainRepo.name, mainRepo.branch)
    })())

    await Promise.allSettled(tasks)
    console.log('[useTemplateDiff] Background comparison finished')
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
      const current = await fetchTemplates(owner, repo, branch, forceRefresh)
      currentTemplates.value = current

      console.log('[useTemplateDiff] Current templates categories:', current?.length || 0)

      // Comparison + bundles run in background so categories render immediately
      void loadComparisonInBackground(owner, repo, branch, forceRefresh)
    } catch (err: any) {
      console.error('[useTemplateDiff] Failed to load templates:', err)
      error.value = err.message || 'Failed to load templates'
      currentTemplates.value = null
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
    if (!currentTemplates.value) {
      return []
    }

    // Show templates even when main-branch comparison is unavailable
    if (!mainTemplates.value || !compareTemplates.value) {
      return currentTemplates.value
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
   * Compare bundles.json + template diffs to find PyPI sub-packages that need republishing
   */
  const bundleDiff = computed<BundleDiffResult | null>(() => {
    if (!compareTemplates.value) return null

    return compareBundleChanges(
      currentBundles.value,
      mainBundles.value,
      compareTemplates.value,
      getBundleLabel,
      getBundlePypiPackage
    )
  })

  /**
   * Map template name → bundle id on the current branch
   */
  const templateBundleMap = computed(() => buildTemplateToBundleMap(currentBundles.value))

  const hasDiffComparison = computed(() => {
    return Boolean(currentTemplates.value && mainTemplates.value && compareTemplates.value)
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
    bundleDiff,
    templateBundleMap,
    currentBundles,
    hasDiffComparison,

    // Methods
    loadMainTemplates,
    loadCurrentTemplates,
    isMainBranch,
    clearCache
  }
}
