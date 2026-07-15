#!/usr/bin/env node
/**
 * Sync glossary/frontend/{lang}.json from ComfyUI_frontend locales.
 *
 * Writes ONLY the frontend layer (wholesale rebuild). Hand overrides in
 * config/glossary/overrides/ are never modified.
 *
 * Path resolution (first hit wins):
 *   1. --frontend <path>
 *   2. FRONTEND_LOCALES_PATH (from environment, .env, or .env.local)
 *
 * Usage:
 *   node scripts/sync-glossary.mjs
 *   node scripts/sync-glossary.mjs --lang zh
 *   node scripts/sync-glossary.mjs --dry-run
 *   node scripts/sync-glossary.mjs --frontend /path/to/ComfyUI_frontend/src/locales
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const FRONTEND_OUT = join(REPO_ROOT, 'config', 'glossary', 'frontend')
const I18N_CONFIG_PATH = join(REPO_ROOT, 'config', 'i18n-config.json')

const SOURCE_FILES = ['main.json', 'nodeDefs.json', 'settings.json', 'commands.json']

const STOPWORDS =
  'a an the of to in on off or and for with you your we our us i me my is are be am ' +
  'was were it its this that these those at by as from into onto over under up down ' +
  'out yes no ok per via not do does done'

const COMMON_WORDS =
  'all none any some each work works working here there now then add added adding ' +
  'use used using run running runs new old other others name names type types mode ' +
  'modes core share shared small large big more less most least set sets get got ' +
  'make made show shows hide open close save load help back next prev also only just ' +
  'very much many few same change changed changes edit view item items value values ' +
  'text default enable enabled disable disabled allow allowed title additional'

const BLOCKLIST = new Set(`${STOPWORDS} ${COMMON_WORDS}`.split(/\s+/))

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

/** Load repo .env / .env.local into process.env without overriding existing vars. */
function loadEnvFiles() {
  for (const name of ['.env', '.env.local']) {
    const envPath = join(REPO_ROOT, name)
    if (!existsSync(envPath)) continue
    for (const raw of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  }
}

function flagValue(name) {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}

function loadI18nConfig() {
  try {
    return JSON.parse(readFileSync(I18N_CONFIG_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function defaultLangs(config) {
  return (config.supportedLocales || [])
    .filter(l => l.code && l.code !== 'en' && !l.isDefault)
    .map(l => ({ code: l.code, name: l.name || l.code }))
}

function parseLangArg(languages) {
  const code = flagValue('--lang')
  if (!code) return languages
  const match = languages.find(l => l.code === code)
  if (!match) {
    throw new Error(`Unknown --lang ${code}. Available: ${languages.map(l => l.code).join(', ')}`)
  }
  return [match]
}

function resolveFrontendPath() {
  const candidates = [
    flagValue('--frontend'),
    process.env.FRONTEND_LOCALES_PATH
  ].filter(Boolean)

  for (const c of candidates) {
    const abs = resolve(
      c.startsWith('/') || /^[A-Za-z]:[\\/]/.test(c) ? c : join(REPO_ROOT, c)
    )
    if (existsSync(join(abs, 'en', 'main.json'))) return abs
  }
  return null
}

function flatten(obj, out = {}, prefix = '') {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else if (v && typeof v === 'object') flatten(v, out, key)
  }
  return out
}

function flattenNodeDefs(defs) {
  const out = {}
  for (const k of Object.keys(defs)) {
    const d = defs[k]?.display_name
    if (typeof d === 'string') out[`node.${k}`] = d
  }
  return out
}

function flattenFile(name, obj) {
  return name === 'nodeDefs.json' ? flattenNodeDefs(obj) : flatten(obj)
}

function cleanTerm(s) {
  return s.replace(/\s*\((?:DEPRECATED|BETA|EXPERIMENTAL|LEGACY)\)\s*$/i, '').trim()
}

function isTermLike(en) {
  const w = en.trim()
  if (w.length < 3) return false
  const words = w.split(/\s+/)
  if (words.length > 5) return false
  if (/[.!?:]/.test(w)) return false
  if (/\{.*?\}/.test(w)) return false
  if (words.length === 1 && BLOCKLIST.has(w.toLowerCase())) return false
  if (words.every(x => BLOCKLIST.has(x.toLowerCase()))) return false
  return true
}

function extractTerms(frontend, langCode) {
  const enFlat = {}
  const tFlat = {}

  for (const file of SOURCE_FILES) {
    const enPath = join(frontend, 'en', file)
    if (!existsSync(enPath)) continue
    Object.assign(enFlat, flattenFile(file, JSON.parse(readFileSync(enPath, 'utf-8'))))

    const tPath = join(frontend, langCode, file)
    if (existsSync(tPath)) {
      Object.assign(tFlat, flattenFile(file, JSON.parse(readFileSync(tPath, 'utf-8'))))
    }
  }

  const terms = {}
  for (const [key, enRaw] of Object.entries(enFlat)) {
    const en = cleanTerm(enRaw)
    if (!isTermLike(en)) continue
    const tRaw = tFlat[key]
    if (typeof tRaw !== 'string') continue
    const t = cleanTerm(tRaw)
    if (!t || t === en) continue
    const k = en.toLowerCase()
    if (!(k in terms)) terms[k] = t
  }
  return terms
}

function serialize(obj) {
  const sorted = {}
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k]
  return `${JSON.stringify(sorted, null, 2)}\n`
}

function main() {
  loadEnvFiles()

  const config = loadI18nConfig()
  const frontend = resolveFrontendPath()

  if (!frontend) {
    console.error(
      'Frontend locales not found.\n' +
        '  Set FRONTEND_LOCALES_PATH in .env, or pass --frontend <path>.\n' +
        '  Expected: <path>/en/main.json\n' +
        '  Example: FRONTEND_LOCALES_PATH=/Users/you/Documents/comfy/ComfyUI_frontend/src/locales'
    )
    process.exit(1)
  }

  console.log(`Frontend locales: ${frontend}`)

  let selectedLangs
  try {
    selectedLangs = parseLangArg(defaultLangs(config))
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  if (!selectedLangs.length) {
    console.error('No target languages found in config/i18n-config.json supportedLocales')
    process.exit(1)
  }

  if (!dryRun) mkdirSync(FRONTEND_OUT, { recursive: true })

  let totalWritten = 0
  for (const lang of selectedLangs) {
    const langDir = join(frontend, lang.code)
    if (!existsSync(join(langDir, 'main.json'))) {
      console.log(`[${lang.code}] skipped (no frontend locale at ${langDir})`)
      continue
    }

    const terms = extractTerms(frontend, lang.code)
    const total = Object.keys(terms).length
    console.log(`[${lang.code}] ${total} terms mirrored from frontend`)

    if (dryRun) continue
    writeFileSync(join(FRONTEND_OUT, `${lang.code}.json`), serialize(terms))
    totalWritten++
  }

  if (dryRun) console.log('\n(dry-run: no files written)')
  else console.log(`\nWrote ${totalWritten} file(s) to ${FRONTEND_OUT}`)
}

main()
