import bundleMappingRules from '~/config/bundle-mapping-rules.json'

export type BundlesData = Record<string, string[]>

export function getBundleSizeLimitBytes(): number {
  const limitMB = bundleMappingRules.sizeLimitMB ?? 100
  return limitMB * 1024 * 1024
}

export function getKnownBundleIds(): string[] {
  return Object.keys(bundleMappingRules.bundles || {})
}

export function getFrozenBundleIds(): string[] {
  return bundleMappingRules.frozenBundles?.length
    ? [...bundleMappingRules.frozenBundles]
    : Object.entries(bundleMappingRules.bundles || {})
      .filter(([, meta]) => (meta as { frozen?: boolean }).frozen)
      .map(([id]) => id)
}

export function isFrozenBundle(bundleId: string): boolean {
  return getFrozenBundleIds().includes(bundleId)
}

export function getRecommendedAssetBundle(): string {
  return bundleMappingRules.recommendedAssetBundle || bundleMappingRules.defaultBundle || 'media-assets-01'
}

export function getBundleLabel(bundleId: string): string {
  return bundleMappingRules.bundles?.[bundleId as keyof typeof bundleMappingRules.bundles]?.label || bundleId
}

export function getBundlePypiPackage(bundleId: string): string | null {
  return bundleMappingRules.bundles?.[bundleId as keyof typeof bundleMappingRules.bundles]?.pypiPackage || null
}

export function getFrozenBundleReason(bundleId: string): string | null {
  const meta = bundleMappingRules.bundles?.[bundleId as keyof typeof bundleMappingRules.bundles] as
    | { frozenReason?: string }
    | undefined
  return meta?.frozenReason || (isFrozenBundle(bundleId) ? 'Legacy frozen bundle' : null)
}

export function resolveTargetBundle(
  category: string,
  explicitBundle?: string | null,
  options?: { currentBundle?: string | null }
): string {
  if (explicitBundle && getKnownBundleIds().includes(explicitBundle)) {
    if (!isFrozenBundle(explicitBundle)) {
      return explicitBundle
    }
    // Preserve existing legacy assignment; do not silently migrate on save
    if (options?.currentBundle === explicitBundle) {
      return explicitBundle
    }
  }

  const mapped = bundleMappingRules.categoryMapping[category as keyof typeof bundleMappingRules.categoryMapping]
    || bundleMappingRules.defaultBundle

  if (mapped && !isFrozenBundle(mapped)) {
    return mapped
  }

  return getRecommendedAssetBundle()
}

export function findTemplateBundle(bundlesData: BundlesData, templateName: string): string | null {
  for (const [bundleName, templates] of Object.entries(bundlesData)) {
    if (Array.isArray(templates) && templates.includes(templateName)) {
      return bundleName
    }
  }
  return null
}

export function assignTemplateToBundle(
  bundlesData: BundlesData,
  templateName: string,
  targetBundle: string
): boolean {
  if (isFrozenBundle(targetBundle)) {
    const currentBundle = findTemplateBundle(bundlesData, templateName)
    if (currentBundle !== targetBundle) {
      throw new Error(`Bundle "${targetBundle}" is frozen — assign new templates to "${getRecommendedAssetBundle()}" instead`)
    }
    return false
  }

  let changed = false

  for (const bundleName of Object.keys(bundlesData)) {
    if (!Array.isArray(bundlesData[bundleName])) continue
    const filtered = bundlesData[bundleName].filter(t => t !== templateName)
    if (filtered.length !== bundlesData[bundleName].length) {
      bundlesData[bundleName] = filtered
      changed = true
    }
  }

  if (!bundlesData[targetBundle]) {
    bundlesData[targetBundle] = []
    changed = true
  }

  if (!bundlesData[targetBundle].includes(templateName)) {
    bundlesData[targetBundle].push(templateName)
    changed = true
  }

  return changed
}

export async function fetchPyPIWheelSizeBytes(packageName: string): Promise<number | null> {
  try {
    const response = await fetch(`https://pypi.org/pypi/${packageName}/json`, {
      headers: { 'User-Agent': 'ComfyUI-Template-CMS' }
    })
    if (!response.ok) return null

    const data = await response.json()
    const wheel = data.urls?.find((entry: { packagetype?: string }) => entry.packagetype === 'bdist_wheel')
    return typeof wheel?.size === 'number' ? wheel.size : null
  } catch {
    return null
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
