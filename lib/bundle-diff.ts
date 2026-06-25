export type BundlesData = Record<string, string[]>

export type BundleTemplateChangeStatus = 'new' | 'modified' | 'deleted'

export interface BundleChangeDetail {
  id: string
  label: string
  pypiPackage: string | null
  hasChanges: boolean
  /** Templates newly listed in this bundle vs base branch */
  addedTemplates: string[]
  /** Templates removed from this bundle vs base branch */
  removedTemplates: string[]
  /** Templates with index/content changes that belong to this bundle */
  contentChangedTemplates: Array<{ name: string; status: BundleTemplateChangeStatus }>
  totalAffected: number
}

export interface BundleDiffResult {
  bundles: BundleChangeDetail[]
  changedBundleCount: number
}

export interface TemplateDiffEntry {
  name: string
  diffStatus?: string
}

export function buildTemplateToBundleMap(bundlesData: BundlesData): Map<string, string> {
  const map = new Map<string, string>()
  for (const [bundleId, templates] of Object.entries(bundlesData || {})) {
    if (!Array.isArray(templates)) continue
    for (const templateName of templates) {
      map.set(templateName, bundleId)
    }
  }
  return map
}

export function compareBundleChanges(
  currentBundles: BundlesData,
  baseBundles: BundlesData,
  templateDiffs: TemplateDiffEntry[],
  getLabel: (bundleId: string) => string,
  getPypiPackage: (bundleId: string) => string | null
): BundleDiffResult {
  const currentMap = buildTemplateToBundleMap(currentBundles)
  const baseMap = buildTemplateToBundleMap(baseBundles)

  const bundleIds = new Set<string>([
    ...Object.keys(currentBundles || {}),
    ...Object.keys(baseBundles || {})
  ])

  const bundles: BundleChangeDetail[] = []

  for (const bundleId of bundleIds) {
    const currentSet = new Set(Array.isArray(currentBundles[bundleId]) ? currentBundles[bundleId] : [])
    const baseSet = new Set(Array.isArray(baseBundles[bundleId]) ? baseBundles[bundleId] : [])

    const addedTemplates = [...currentSet].filter(name => !baseSet.has(name))
    const removedTemplates = [...baseSet].filter(name => !currentSet.has(name))

    const contentChangedTemplates: BundleChangeDetail['contentChangedTemplates'] = []

    for (const template of templateDiffs) {
      const status = template.diffStatus
      if (status !== 'new' && status !== 'modified' && status !== 'deleted') continue

      const currentBundle = currentMap.get(template.name)
      const baseBundle = baseMap.get(template.name)

      if (status === 'deleted') {
        if (baseBundle === bundleId) {
          contentChangedTemplates.push({ name: template.name, status })
        }
        continue
      }

      if (currentBundle === bundleId) {
        // Avoid duplicating pure membership adds for brand-new templates
        if (status === 'new' && addedTemplates.includes(template.name)) continue
        contentChangedTemplates.push({ name: template.name, status })
      }
    }

    const affectedNames = new Set<string>([
      ...addedTemplates,
      ...removedTemplates,
      ...contentChangedTemplates.map(t => t.name)
    ])

    const hasChanges = affectedNames.size > 0

    bundles.push({
      id: bundleId,
      label: getLabel(bundleId),
      pypiPackage: getPypiPackage(bundleId),
      hasChanges,
      addedTemplates,
      removedTemplates,
      contentChangedTemplates,
      totalAffected: affectedNames.size
    })
  }

  bundles.sort((a, b) => {
    if (a.hasChanges !== b.hasChanges) return a.hasChanges ? -1 : 1
    return a.label.localeCompare(b.label)
  })

  return {
    bundles,
    changedBundleCount: bundles.filter(b => b.hasChanges).length
  }
}

export function isTemplateInChangedBundle(
  templateName: string,
  bundleDiff: BundleDiffResult | null
): boolean {
  if (!bundleDiff) return false
  return bundleDiff.bundles.some(bundle => {
    if (!bundle.hasChanges) return false
    return (
      bundle.addedTemplates.includes(templateName)
      || bundle.removedTemplates.includes(templateName)
      || bundle.contentChangedTemplates.some(t => t.name === templateName)
    )
  })
}
