import { getServerSession } from '#auth'
import { translateText } from '~/server/utils/ai-translator'
import { checkRateLimit, checkOrigin } from '~/server/utils/rate-limiter'
import i18nConfigImport from '~/config/i18n-config.json'

interface BatchItem {
  key: string
  text: string
}

interface RequestBody {
  items: BatchItem[]
  sourceLang: string
  targetLang: string
  systemPrompt?: string
  batchPromptTemplate?: string
}

interface I18nConfig {
  aiTranslation: {
    systemPrompt: string
    singleTranslationTemplate: string
    batchTranslationTemplate: string
    batchSize: number
    maxConcurrent: number
    requestTimeout: number
    retryAttempts: number
  }
}

// Use directly imported config (works in both dev and production/Vercel)
function getI18nConfig(): I18nConfig {
  return i18nConfigImport as I18nConfig
}

// Language name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  zh: 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  ru: 'Russian (Русский)',
  tr: 'Turkish (Türkçe)',
  ar: 'Arabic (العربية)',
  'pt-BR': 'Brazilian Portuguese (Português do Brasil)',
  fa: 'Persian (فارسی)'
}

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code
}

/**
 * Extract a top-level JSON array from text, respecting string boundaries (greedy `\[[\s\S]*\]`
 * often grabs the wrong bracket when translations contain `"` or `]`).
 */
function extractTopLevelJsonArray(text: string): string | null {
  const start = text.indexOf('[')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString && c === '\\') {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Parse AI batch response — multiple strategies; callers log raw text on failure.
 */
function parseBatchTranslationResponse(text: string): Array<{ key: string; translation: string }> {
  const trimmed = text.trim()

  const tryNormalize = (
    parsed: unknown
  ): Array<{ key: string; translation: string }> => {
    if (Array.isArray(parsed)) return parsed as Array<{ key: string; translation: string }>
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).translations)) {
      return (parsed as any).translations
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).results)) {
      return (parsed as any).results
    }
    throw new Error('not-array')
  }

  const attempts: string[] = [trimmed]

  const md = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (md) attempts.push(md[1].trim())

  const balanced = extractTopLevelJsonArray(trimmed)
  if (balanced) attempts.push(balanced)

  for (const candidate of attempts) {
    try {
      return tryNormalize(JSON.parse(candidate))
    } catch {}

    try {
      // Trailing commas
      const relaxed = candidate.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}')
      return tryNormalize(JSON.parse(relaxed))
    } catch {}
  }

  throw new Error('Failed to parse JSON response from AI')
}

export default defineEventHandler(async (event) => {
  try {
    // Check authentication
    const session = await getServerSession(event)
    if (!session?.accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Please sign in'
      })
    }

    // Check origin/referer
    const originCheck = checkOrigin(event)
    if (!originCheck.allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: originCheck.reason || 'Forbidden - Invalid origin'
      })
    }

    // Check rate limit
    const username = (session.user as any)?.login || (session.user as any)?.name || 'unknown'
    const rateLimitCheck = checkRateLimit(username)
    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetAt?.toISOString() || 'unknown'
      throw createError({
        statusCode: 429,
        statusMessage: `Rate limit exceeded. Try again after ${resetTime}`
      })
    }

    // Parse request body
    const body = await readBody<RequestBody>(event)

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameter: items (non-empty array)'
      })
    }

    if (!body.targetLang) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameter: targetLang'
      })
    }

    const sourceLang = body.sourceLang || 'en'

    // Load config first — enforces max items per HTTP request (matches client chunking)
    const i18nCfg = getI18nConfig()
    const maxPerRequest = Math.max(1, Number(i18nCfg.aiTranslation?.batchSize) || 30)
    if (body.items.length > maxPerRequest) {
      throw createError({
        statusCode: 400,
        statusMessage:
          `Too many items (${body.items.length}) in one batch request. Maximum is ${maxPerRequest}. Translate in smaller chunks or redeploy an updated Translation Manager UI.`
      })
    }

    console.log('[AI Batch Translate] Request:', {
      itemCount: body.items.length,
      from: sourceLang,
      to: body.targetLang
    })

    const jsonArray = JSON.stringify(body.items, null, 2)

    let userPrompt = body.batchPromptTemplate || i18nCfg.aiTranslation.batchTranslationTemplate
    userPrompt = userPrompt
      .replace('{sourceLang}', getLanguageName(sourceLang))
      .replace('{targetLang}', getLanguageName(body.targetLang))
      .replace('{jsonArray}', jsonArray)

    // Call AI with batch request
    const result = await translateText({
      sourceText: userPrompt,
      sourceLang,
      targetLang: body.targetLang,
      systemPrompt: body.systemPrompt,
      userPromptTemplate: '{sourceText}', // Use the prompt as-is
      glossarySourceText: body.items.map(i => i.text).join('\n'),
      maxCompletionTokens: 8192
    })

    if (!result.success || !result.translation) {
      throw createError({
        statusCode: 500,
        statusMessage: result.error || 'Batch translation failed'
      })
    }

    // Parse the response
    let translations: Array<{ key: string; translation: string }>
    try {
      translations = parseBatchTranslationResponse(result.translation)
    } catch (error: any) {
      const raw = result.translation
      const sample =
        typeof raw === 'string'
          ? `${raw.slice(0, 500)}${raw.length > 500 ? '…' : ''} (length ${raw.length})`
          : ''
      console.error('[AI Batch Translate] Failed to parse response:', sample)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to parse AI response: ${error.message}`
      })
    }

    translations = translations.filter(
      (t): t is { key: string; translation: string } =>
        typeof t?.key === 'string' &&
        typeof t?.translation === 'string' &&
        t.key.length > 0
    )

    // Validate response structure
    if (!Array.isArray(translations)) {
      throw createError({
        statusCode: 500,
        statusMessage: 'AI returned invalid format (expected array)'
      })
    }

    // Match results with original items
    const results: Array<{ key: string; translation: string }> = []
    const failed: Array<{ key: string; error: string }> = []

    for (const item of body.items) {
      const match = translations.find(t => t.key === item.key)
      if (match && match.translation) {
        results.push({
          key: item.key,
          translation: match.translation
        })
      } else {
        failed.push({
          key: item.key,
          error: 'Translation not found in response'
        })
      }
    }

    console.log('[AI Batch Translate] Completed:', {
      total: body.items.length,
      succeeded: results.length,
      failed: failed.length,
      usage: result.usage
    })

    return {
      success: true,
      results,
      failed,
      usage: result.usage
    }
  } catch (error: any) {
    console.error('[AI Batch Translate] Error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to translate batch'
    })
  }
})
