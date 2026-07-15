/**
 * Client-safe glossary matching / mismatch detection (no fs).
 * Used by Translation Manager UI, server glossary injection, and unit tests.
 */

export interface GlossaryHit {
  en: string
  t: string
}

export interface GlossaryMismatch {
  en: string
  preferred: string
}

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g
const MAX_TERMS = 25

function escapeRegExp(s: string): string {
  return s.replace(REGEX_SPECIALS, '\\$&')
}

function findMatchSpans(haystack: string, needle: string): Array<[number, number]> {
  if (!needle) return []
  const re = new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'g')
  const spans: Array<[number, number]> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(haystack)) !== null) {
    spans.push([m.index, m.index + needle.length])
    if (m[0].length === 0) re.lastIndex++
  }
  return spans
}

function spanFullyCovered(start: number, end: number, claimed: boolean[]): boolean {
  for (let i = start; i < end; i++) {
    if (!claimed[i]) return false
  }
  return true
}

function claimSpan(start: number, end: number, claimed: boolean[]): void {
  for (let i = start; i < end; i++) claimed[i] = true
}

/**
 * Select glossary terms that appear in `enText`.
 * Whole-word, case-insensitive; longest matches first.
 * Shorter hits whose every occurrence is fully covered by a longer kept hit are dropped.
 */
export function selectGlossaryHits(
  enText: string,
  glossaryEntries: Iterable<[string, string]>,
  max = MAX_TERMS
): GlossaryHit[] {
  if (!enText) return []

  const lower = enText.toLowerCase()
  const candidates: Array<GlossaryHit & { _len: number; spans: Array<[number, number]> }> = []

  for (const [enLower, target] of glossaryEntries) {
    if (!target || !enLower || !lower.includes(enLower)) continue
    const spans = findMatchSpans(lower, enLower)
    if (!spans.length) continue
    candidates.push({ en: enLower, t: target, _len: enLower.length, spans })
  }

  candidates.sort((a, b) => b._len - a._len || a.en.localeCompare(b.en))

  const claimed = new Array<boolean>(lower.length).fill(false)
  const kept: GlossaryHit[] = []

  for (const hit of candidates) {
    if (kept.length >= max) break

    const hasUncovered = hit.spans.some(([start, end]) => !spanFullyCovered(start, end, claimed))
    if (!hasUncovered) continue

    kept.push({ en: hit.en, t: hit.t })
    for (const [start, end] of hit.spans) {
      claimSpan(start, end, claimed)
    }
  }

  return kept
}

export function selectGlossaryForTextFromRecord(
  enText: string,
  glossary: Record<string, string>,
  max = MAX_TERMS
): GlossaryHit[] {
  if (!glossary || !Object.keys(glossary).length) return []
  return selectGlossaryHits(enText, Object.entries(glossary), max)
}

/**
 * Terms present in English whose preferred translation is missing from `translated`.
 * Skips brand-style rows where preferred === English (keep-as-English).
 * Empty translations are skipped (handled by the untranslated filter).
 */
export function findGlossaryMismatches(
  enText: string,
  translated: string | undefined | null,
  glossary: Record<string, string>
): GlossaryMismatch[] {
  const text = (translated || '').trim()
  if (!enText?.trim() || !text) return []

  const hits = selectGlossaryForTextFromRecord(enText, glossary)
  if (!hits.length) return []

  const lowerTranslated = text.toLowerCase()
  const mismatches: GlossaryMismatch[] = []

  for (const { en, t } of hits) {
    // Preferred form is still English → brand/preserve term; no mismatch check
    if (t.trim().toLowerCase() === en.toLowerCase()) continue
    if (!lowerTranslated.includes(t.toLowerCase())) {
      mismatches.push({ en, preferred: t })
    }
  }

  return mismatches
}

export function formatGlossaryMismatchTitle(mismatches: GlossaryMismatch[]): string {
  if (!mismatches.length) return ''
  return mismatches
    .map(m => `${m.en} → ${m.preferred}`)
    .join('\n')
}
