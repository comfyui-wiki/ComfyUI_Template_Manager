/**
 * GET /api/glossary/maps
 * Returns glossary maps for Translation Manager mismatch checks.
 *
 * Query:
 *   layer=overrides (default) — curated preferred terms only (low noise)
 *   layer=effective — frontend mirror + overrides (same as AI injection)
 *   langs=zh,ja,ko — optional subset; default = all non-en supported locales
 */
import i18nConfig from '~/config/i18n-config.json'
import { loadGlossary } from '~/server/utils/glossary'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function loadOverridesOnly(langCode: string): Record<string, string> {
  const path = join(process.cwd(), 'config', 'glossary', 'overrides', `${langCode}.json`)
  if (!existsSync(path)) return {}
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
      terms?: Record<string, string>
      ignore?: string[]
    }
    const ignore = new Set((raw.ignore ?? []).map(t => String(t).toLowerCase()))
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw.terms ?? {})) {
      if (typeof v !== 'string' || !v.trim()) continue
      const key = k.toLowerCase()
      if (ignore.has(key)) continue
      out[key] = v
    }
    return out
  } catch {
    return {}
  }
}

function mapToRecord(map: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of map) out[k] = v
  return out
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const layer = (query.layer as string) === 'effective' ? 'effective' : 'overrides'

  const supported = (i18nConfig.supportedLocales || [])
    .map(l => l.code)
    .filter(code => code && code !== 'en')

  const langFilter = typeof query.langs === 'string' && query.langs.trim()
    ? query.langs.split(',').map(s => s.trim()).filter(Boolean)
    : supported

  const langs = langFilter.filter(code => supported.includes(code))
  const glossaries: Record<string, Record<string, string>> = {}

  for (const code of langs) {
    if (layer === 'effective') {
      glossaries[code] = mapToRecord(loadGlossary(code))
    } else {
      glossaries[code] = loadOverridesOnly(code)
    }
  }

  return {
    success: true,
    layer,
    langs,
    glossaries,
    termCounts: Object.fromEntries(
      Object.entries(glossaries).map(([code, map]) => [code, Object.keys(map).length])
    )
  }
})
