import { getServerSession } from '#auth'
import { translateWithRetry } from '~/server/utils/ai-translator'
import { checkRateLimit, checkOrigin } from '~/server/utils/rate-limiter'

interface RequestBody {
  sourceText: string
  sourceLang: string
  targetLang: string
  systemPrompt?: string
  userPromptTemplate?: string
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

    if (!body.sourceText || !body.targetLang) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: sourceText, targetLang'
      })
    }

    // Default source language to English
    const sourceLang = body.sourceLang || 'en'

    console.log('[AI Translate Single] Request:', {
      from: sourceLang,
      to: body.targetLang,
      textLength: body.sourceText.length,
      hasCustomPrompts: !!(body.systemPrompt || body.userPromptTemplate)
    })

    // Translate with retry
    const result = await translateWithRetry({
      sourceText: body.sourceText,
      sourceLang,
      targetLang: body.targetLang,
      systemPrompt: body.systemPrompt,
      userPromptTemplate: body.userPromptTemplate
    })

    if (!result.success) {
      throw createError({
        statusCode: 500,
        statusMessage: result.error || 'Translation failed'
      })
    }

    return {
      success: true,
      translation: result.translation,
      usage: result.usage
    }
  } catch (error: any) {
    console.error('[AI Translate Single] Error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to translate text'
    })
  }
})
