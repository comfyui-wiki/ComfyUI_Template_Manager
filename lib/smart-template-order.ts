export interface SortableTemplate {
  name: string
  usage?: number | null
  openSource?: boolean | null
  models?: string[]
}

export interface SmartOrderOptions {
  familyGapPercent: number
  openSourceGapPercent: number
  modelMatch?: 'exact' | 'family'
}

const usageOf = (template: SortableTemplate) =>
  Number.isFinite(template.usage) ? Math.max(0, template.usage ?? 0) : 0

const modelKey = (model: string, match: 'exact' | 'family') => {
  const normalized = model.trim().toLocaleLowerCase()
  if (match === 'exact') return normalized
  // The first alphabetic token is the broad model brand/series. Versions and
  // variants such as Wan2.1/Wan2.2 or Qwen-Image/Qwen-Image-Edit then match.
  return normalized.match(/^[\p{L}]+/u)?.[0] ?? normalized
}

const modelKeys = (template: SortableTemplate, match: 'exact' | 'family') => new Set(
  (template.models ?? []).map(model => modelKey(model, match)).filter(Boolean)
)

const sharesModel = (a: SortableTemplate, b: SortableTemplate, match: 'exact' | 'family') => {
  const keys = modelKeys(a, match)
  return (b.models ?? []).some(model => keys.has(modelKey(model, match)))
}

/** Sort one category. A candidate may pass a higher-usage item only within the chosen gap. */
export function smartTemplateOrder<T extends SortableTemplate>(
  templates: T[],
  options: SmartOrderOptions
): T[] {
  const remaining = templates.map((template, index) => ({ template, index }))
    .sort((a, b) => usageOf(b.template) - usageOf(a.template) || a.index - b.index)
  const result: T[] = []
  const familyGap = Math.max(0, Math.min(100, options.familyGapPercent)) / 100
  const openGap = Math.max(0, Math.min(100, options.openSourceGapPercent)) / 100
  const match = options.modelMatch ?? 'exact'

  while (remaining.length) {
    const highest = remaining[0]!
    let chosen = highest
    // The first item is always the highest-usage template. Later items may group
    // with the last model, but only when their usage is close to the current maximum.
    if (result.length) {
      const previous = result[result.length - 1]!
      const familyCandidate = remaining.find(item =>
        sharesModel(previous, item.template, match) &&
        usageOf(item.template) >= usageOf(highest.template) * (1 - familyGap)
      )
      if (familyCandidate) chosen = familyCandidate

      // Within the selected model group, prefer an open-source template only
      // when it is close in usage to that group's leading candidate.
      const openCandidate = remaining.find(item =>
        item.template.openSource === true &&
        (chosen === highest || sharesModel(chosen.template, item.template, match)) &&
        usageOf(item.template) >= usageOf(chosen.template) * (1 - openGap) &&
        (chosen === highest || usageOf(item.template) >= usageOf(highest.template) * (1 - familyGap))
      )
      if (openCandidate) chosen = openCandidate
    }

    result.push(chosen.template)
    remaining.splice(remaining.indexOf(chosen), 1)
  }
  return result
}
