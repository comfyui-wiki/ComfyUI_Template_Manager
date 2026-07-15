/**
 * Glossary loading + per-text term selection + prompt injection.
 *
 * Mirrors the docs i18n glossary design:
 *   config/glossary/frontend/{lang}.json  Optional machine mirror (UI locale terms)
 *   config/glossary/overrides/{lang}.json Hand-maintained preferred terms
 *
 * Resolution: frontend minus ignore, then apply override terms.
 * Injection is advisory ("preferred, not mandatory") so natural phrasing wins.
 *
 * Term selection (shared with lib/glossary-check): whole-word, longest-first,
 * nested shorter hits suppressed when covered by a longer match.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  selectGlossaryHits,
  type GlossaryHit
} from '~/lib/glossary-check'

export type { GlossaryHit }

interface GlossaryOverrideFile {
  terms?: Record<string, string>
  ignore?: string[]
}

/** Max terms injected per request (longest-first, nested shorts suppressed). */
const MAX_TERMS_PER_TEXT = 25

const glossaryCache = new Map<string, Map<string, string>>()

function glossaryRoot(): string {
  return join(process.cwd(), 'config', 'glossary')
}

function readJsonOr<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function loadFrontendLayer(langCode: string): Record<string, string> {
  const raw = readJsonOr<Record<string, string>>(
    join(glossaryRoot(), 'frontend', `${langCode}.json`),
    {}
  )
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) out[k.toLowerCase()] = v
  }
  return out
}

function loadOverrideLayer(langCode: string): {
  terms: Record<string, string>
  ignore: Set<string>
} {
  const raw = readJsonOr<GlossaryOverrideFile>(
    join(glossaryRoot(), 'overrides', `${langCode}.json`),
    {}
  )
  const terms: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw.terms ?? {})) {
    if (typeof v === 'string' && v.trim()) terms[k.toLowerCase()] = v
  }
  const ignore = new Set((raw.ignore ?? []).map(t => String(t).toLowerCase()))
  return { terms, ignore }
}

/**
 * Resolve effective glossary for a language: frontend mirror − ignore + overrides.
 */
export function loadGlossary(langCode: string): Map<string, string> {
  const cached = glossaryCache.get(langCode)
  if (cached) return cached

  const frontend = loadFrontendLayer(langCode)
  const { terms, ignore } = loadOverrideLayer(langCode)

  const map = new Map<string, string>()
  for (const [k, v] of Object.entries(frontend)) {
    if (ignore.has(k)) continue
    map.set(k, v)
  }
  for (const [k, v] of Object.entries(terms)) {
    if (ignore.has(k)) continue
    map.set(k, v)
  }

  glossaryCache.set(langCode, map)
  return map
}

/** Clear in-memory cache (useful after hot-editing glossary files in dev). */
export function clearGlossaryCache(): void {
  glossaryCache.clear()
}

/**
 * Select glossary terms that appear in `enText`.
 * Whole-word, case-insensitive; longest matches first; nested shorts dropped; capped.
 */
export function selectGlossaryForText(
  enText: string,
  glossary: Map<string, string>,
  max = MAX_TERMS_PER_TEXT
): GlossaryHit[] {
  if (!glossary.size || !enText) return []
  return selectGlossaryHits(enText, glossary.entries(), max)
}

/**
 * Render selected terms as a prompt block. Returns "" when nothing matched.
 */
export function buildGlossaryPrompt(terms: GlossaryHit[], langName: string): string {
  if (!terms.length) return ''

  const lines = terms.map(({ en, t }) => `${en} → ${t}`)
  return [
    `=== Preferred ${langName} terminology ===`,
    'Use these translations for the listed terms to keep wording consistent.',
    'They are preferred, not mandatory: if a literal substitution would read unnaturally in context, prefer natural phrasing.',
    'Match case and grammar to the sentence; the arrow shows the base form only.',
    ...lines
  ].join('\n')
}

/**
 * Convenience: load → select → build for one language.
 */
export function glossaryBlockFor(
  enText: string,
  langCode: string,
  langName: string
): string {
  const glossary = loadGlossary(langCode)
  const hits = selectGlossaryForText(enText, glossary)
  return buildGlossaryPrompt(hits, langName)
}

/**
 * Build glossary blocks for multiple target languages (multi-lang translate).
 */
export function multiLangGlossaryBlockFor(
  enText: string,
  langCodes: string[],
  getLangName: (code: string) => string
): string {
  const blocks = langCodes
    .map(code => glossaryBlockFor(enText, code, getLangName(code)))
    .filter(Boolean)

  if (!blocks.length) return ''
  return [
    '=== Terminology reference by language ===',
    'When translating into each language, prefer the matching terms below when they appear in the source.',
    ...blocks
  ].join('\n\n')
}
