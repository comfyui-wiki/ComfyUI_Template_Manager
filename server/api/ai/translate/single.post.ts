import { authorizeAiRequest } from '~/server/utils/ai-auth'
import { translateWithRetry } from '~/server/utils/ai-translator'

interface RequestBody {
  sourceText: string
  sourceLang: string
  targetLang: string
  systemPrompt?: string
  userPromptTemplate?: string
}

export default defineEventHandler(async (event) => {
  try {
    await authorizeAiRequest(event)

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
