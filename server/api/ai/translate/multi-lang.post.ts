import { getServerSession } from '#auth'
import { translateText } from '~/server/utils/ai-translator'
import { checkRateLimit, checkOrigin } from '~/server/utils/rate-limiter'
import { readFileSync } from 'fs'
import { join } from 'path'

interface RequestBody {
  sourceText: string
  sourceLang: string
  targetLangs: string[]
  systemPrompt?: string
}

interface I18nConfig {
  aiTranslation: {
    systemPrompt: string
    singleTranslationTemplate: string
    batchTranslationTemplate: string
  }
}

// Load i18n config
let i18nConfig: I18nConfig | null = null
async function loadI18nConfig(): Promise<I18nConfig> {
  if (!i18nConfig) {
    try {
      // Try to read from server assets (production)
      const storage = useStorage('assets:config')
      const configContent = await storage.getItem('i18n-config.json')

      if (configContent) {
        i18nConfig = typeof configContent === 'string'
          ? JSON.parse(configContent)
          : configContent as I18nConfig
      }
    } catch (error: any) {
      console.log('[AI Multi-Lang Translate] Server assets not available, using file system fallback')
    }

    // Fallback to file system (development)
    if (!i18nConfig) {
      try {
        const configPath = join(process.cwd(), 'config', 'i18n-config.json')
        const configContent = readFileSync(configPath, 'utf-8')
        i18nConfig = JSON.parse(configContent)
        console.log('[AI Multi-Lang Translate] Loaded config from file system')
      } catch (error: any) {
        console.error('[AI Multi-Lang Translate] Failed to load i18n config:', error.message)
        throw new Error('Failed to load AI translation configuration')
      }
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

  // 3. Extract JSON object
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
    const originCheck = await checkOrigin(event)
    if (!originCheck.allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: originCheck.reason || 'Forbidden - Invalid origin'
      })
    }

    // Check rate limit
    const username = (session.user as any)?.login || (session.user as any)?.name || 'unknown'
    const rateLimitCheck = await checkRateLimit(username)
    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetAt?.toISOString() || 'unknown'
      throw createError({
        statusCode: 429,
        statusMessage: `Rate limit exceeded. Try again after ${resetTime}`
      })
    }

    // Parse request body
    const body = await readBody<RequestBody>(event)

    if (!body.sourceText || !body.targetLangs || body.targetLangs.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: sourceText, targetLangs'
      })
    }

    const sourceLang = body.sourceLang || 'en'

    console.log('[AI Multi-Lang Translate] Request:', {
      from: sourceLang,
      targetLangs: body.targetLangs,
      textLength: body.sourceText.length
    })

    // Load config and build multi-language prompt
    const i18nCfg = await loadI18nConfig()

    // Build language list for prompt
    const langList = body.targetLangs
      .map(code => `- ${code}: ${getLanguageName(code)}`)
      .join('\n')

    // Build multi-language translation prompt
    const userPrompt = `Translate the following text from ${getLanguageName(sourceLang)} to multiple languages.
Return a valid JSON object with language codes as keys and translations as values.

CRITICAL: Return ONLY the JSON object, no markdown code blocks, no explanations.

Format:
{
  "zh": "translated text",
  "zh-TW": "translated text",
  "ja": "translated text",
  ...
}

Target languages:
${langList}

Text to translate: "${body.sourceText}"

Return only the JSON object with translations.`

    // Call AI with multi-language request
    const result = await translateText({
      sourceText: userPrompt,
      sourceLang,
      targetLang: body.targetLangs[0], // Use first target lang as hint
      systemPrompt: body.systemPrompt || i18nCfg.aiTranslation.systemPrompt,
      userPromptTemplate: '{sourceText}' // Use the prompt as-is
    })

    if (!result.success || !result.translation) {
      throw createError({
        statusCode: 500,
        statusMessage: result.error || 'Multi-language translation failed'
      })
    }

    // Parse the response
    let translations: Record<string, string>
    try {
      translations = parseAIResponse(result.translation)
    } catch (error: any) {
      console.error('[AI Multi-Lang Translate] Failed to parse response:', result.translation)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to parse AI response: ${error.message}`
      })
    }

    // Validate response structure
    if (typeof translations !== 'object' || Array.isArray(translations)) {
      throw createError({
        statusCode: 500,
        statusMessage: 'AI returned invalid format (expected object with language keys)'
      })
    }

    // Match results with requested languages
    const results: Record<string, string> = {}
    const failed: string[] = []

    for (const targetLang of body.targetLangs) {
      if (translations[targetLang]) {
        results[targetLang] = translations[targetLang]
      } else {
        failed.push(targetLang)
      }
    }

    console.log('[AI Multi-Lang Translate] Completed:', {
      requested: body.targetLangs.length,
      succeeded: Object.keys(results).length,
      failed: failed.length,
      usage: result.usage
    })

    return {
      success: true,
      translations: results,
      failed,
      usage: result.usage
    }
  } catch (error: any) {
    console.error('[AI Multi-Lang Translate] Error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to translate to multiple languages'
    })
  }
})
