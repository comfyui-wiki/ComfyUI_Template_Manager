/**
 * AI Translation utility using DeepSeek API
 */

import { readFileSync } from 'fs'
import { join } from 'path'

interface TranslationRequest {
  sourceText: string
  sourceLang: string
  targetLang: string
  systemPrompt?: string
  userPromptTemplate?: string
}

interface TranslationResponse {
  success: boolean
  translation?: string
  error?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
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
async function loadI18nConfig(): Promise<I18nConfig> {
  // In development, always reload config to pick up changes
  const isDev = process.env.NODE_ENV === 'development'

  if (!i18nConfig || isDev) {
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
      console.log('[AI Translator] Server assets not available, using file system fallback')
    }

    // Fallback to file system (development)
    if (!i18nConfig) {
      try {
        const configPath = join(process.cwd(), 'config', 'i18n-config.json')
        const configContent = readFileSync(configPath, 'utf-8')
        i18nConfig = JSON.parse(configContent)
        console.log('[AI Translator] Loaded config from file system')
      } catch (error: any) {
        console.error('[AI Translator] Failed to load i18n config:', error.message)
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
 * Translate text using DeepSeek API
 */
export async function translateText(request: TranslationRequest): Promise<TranslationResponse> {
  const config = useRuntimeConfig()
  const i18nCfg = await loadI18nConfig()

  const apiKey = config.deepseekApiKey
  const endpoint = config.deepseekApiEndpoint || 'https://api.deepseek.com/v1/chat/completions'
  const model = config.deepseekModel || 'deepseek-chat'

  if (!apiKey) {
    return {
      success: false,
      error: 'DeepSeek API key not configured. Please set DEEPSEEK_API_KEY environment variable.'
    }
  }

  // Build prompts from config
  const systemPrompt = request.systemPrompt || i18nCfg.aiTranslation.systemPrompt

  let userPrompt = request.userPromptTemplate || i18nCfg.aiTranslation.singleTranslationTemplate
  userPrompt = userPrompt
    .replace('{sourceLang}', getLanguageName(request.sourceLang))
    .replace('{targetLang}', getLanguageName(request.targetLang))
    .replace('{sourceText}', request.sourceText)

  console.log('[AI Translator] Translating:', {
    from: request.sourceLang,
    to: request.targetLang,
    textLength: request.sourceText.length,
    model
  })

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,  // Lower temperature for more consistent translations
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[AI Translator] API error:', response.status, errorData)
      return {
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}`
      }
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[AI Translator] Invalid response structure:', data)
      return {
        success: false,
        error: 'Invalid response from API'
      }
    }

    const translation = data.choices[0].message.content.trim()

    console.log('[AI Translator] Translation successful:', {
      originalLength: request.sourceText.length,
      translatedLength: translation.length,
      usage: data.usage
    })

    return {
      success: true,
      translation,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    }
  } catch (error: any) {
    console.error('[AI Translator] Request failed:', error)
    return {
      success: false,
      error: error.message || 'Translation request failed'
    }
  }
}

/**
 * Translate text with retry logic
 */
export async function translateWithRetry(
  request: TranslationRequest,
  maxRetries?: number
): Promise<TranslationResponse> {
  const i18nCfg = await loadI18nConfig()
  const retries = maxRetries ?? i18nCfg.aiTranslation.retryAttempts
  let lastError: string = ''

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`[AI Translator] Retry attempt ${attempt}/${retries}`)
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
    }

    const result = await translateText(request)

    if (result.success) {
      return result
    }

    lastError = result.error || 'Unknown error'
  }

  return {
    success: false,
    error: `Translation failed after ${retries + 1} attempts. Last error: ${lastError}`
  }
}
