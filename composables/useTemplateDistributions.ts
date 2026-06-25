export const TEMPLATE_DISTRIBUTIONS = [
  { id: 'cloud', label: 'Cloud' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'local', label: 'Local' }
] as const

export type TemplateDistributionId = (typeof TEMPLATE_DISTRIBUTIONS)[number]['id']

/**
 * Empty or missing includeOnDistributions means available on all platforms.
 */
export function isAvailableOnDistribution(
  includeOnDistributions: string[] | undefined | null,
  platform: TemplateDistributionId
): boolean {
  if (!includeOnDistributions || includeOnDistributions.length === 0) {
    return true
  }
  return includeOnDistributions.includes(platform)
}

export function getDistributionStatuses(includeOnDistributions?: string[] | null) {
  return TEMPLATE_DISTRIBUTIONS.map((platform) => ({
    ...platform,
    available: isAvailableOnDistribution(includeOnDistributions, platform.id)
  }))
}
