import { getServerSession } from '#auth'
import { translateText } from '~/server/utils/ai-translator'
import { checkRateLimit, checkOrigin } from '~/server/utils/rate-limiter'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

// Load i18n config
let i18nConfig: I18nConfig | null = null
function loadI18nConfig(): I18nConfig {
  if (!i18nConfig) {
    try {
      const configPath = resolve(process.cwd(), 'config/i18n-config.json')
      const configContent = readFileSync(configPath, 'utf-8')
      i18nConfig = JSON.parse(configContent)
    } catch (error: any) {
      console.error('[AI Batch Translate] Failed to load i18n config:', error.message)
      throw new Error('Failed to load AI translation configuration')
    }
  }
  return i18nConfig!
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
  'pt-BR': 'Brazilian Portuguese (Português do Brasil)'
}

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code
}

/**
 * Parse AI response - handle various formats
 */
function parseAIResponse(text: string): any {
  // 1. Try direct JSON parse
  try {
    return JSON.parse(text)
  } catch {}

  // 2. Extract JSON from markdown code blocks
  const markdownMatch = text.match(/```json\s*\n([\s\S]*?)\n```/)
  if (markdownMatch) {
    try {
      return JSON.parse(markdownMatch[1])
    } catch {}
  }

  // 3. Extract JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0])
    } catch {}
  }

  // 4. Extract JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0])
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

    console.log('[AI Batch Translate] Request:', {
      itemCount: body.items.length,
      from: sourceLang,
      to: body.targetLang
    })

    // Load config and build batch prompt
    const i18nCfg = loadI18nConfig()
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
      userPromptTemplate: '{sourceText}' // Use the prompt as-is
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
      translations = parseAIResponse(result.translation)
    } catch (error: any) {
      console.error('[AI Batch Translate] Failed to parse response:', result.translation)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to parse AI response: ${error.message}`
      })
    }

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
