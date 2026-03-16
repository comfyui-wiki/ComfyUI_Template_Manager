import { getServerSession } from '#auth'
import { checkRateLimit, checkOrigin } from '~/server/utils/rate-limiter'

interface RequestBody {
  context: {
    title?: string
    description?: string
    tags?: string[]
    models?: string[]
    category?: string
  }
  userInput?: string
  availableTags?: string[]
  availableModels?: string[]
  customSystemPrompt?: string
}

interface BatchSuggestion {
  title: string
  description: string
  tags: string[]
  models: string[]
}

interface PromptConfig {
  systemPrompt: string
  userPromptTemplate: string
}

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)
    if (!session?.accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Please sign in'
      })
    }

    const originCheck = checkOrigin(event)
    if (!originCheck.allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: originCheck.reason || 'Forbidden - Invalid origin'
      })
    }

    const username = (session.user as any)?.login || (session.user as any)?.name || 'unknown'
    const rateLimitCheck = checkRateLimit(username)
    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetAt?.toISOString() || 'unknown'
      throw createError({
        statusCode: 429,
        statusMessage: `Rate limit exceeded. Try again after ${resetTime}`
      })
    }

    const body = await readBody<RequestBody>(event)

    if (!body.context) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameter: context'
      })
    }

    console.log('[AI Assist Batch] Request:', {
      hasUserInput: !!body.userInput,
      hasCustomSystemPrompt: !!body.customSystemPrompt
    })

    const { readFile } = await import('fs/promises')
    const { join } = await import('path')

    let promptsConfig: Record<string, PromptConfig>
    try {
      const configPath = join(process.cwd(), 'config', 'ai-assistant-prompts.json')
      const configContent = await readFile(configPath, 'utf-8')
      promptsConfig = JSON.parse(configContent)
    } catch (error: any) {
      console.error('[AI Assist Batch] Failed to load prompt config:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to load prompt configuration'
      })
    }

    const promptConfig = promptsConfig.all
    if (!promptConfig) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Batch prompt configuration not found'
      })
    }

    let userPrompt = promptConfig.userPromptTemplate
      .replace('{title}', body.context.title || '(not provided)')
      .replace('{description}', body.context.description || '(not provided)')
      .replace('{tags}', body.context.tags?.join(', ') || '(none)')
      .replace('{models}', body.context.models?.join(', ') || '(none)')
      .replace('{category}', body.context.category || '(not provided)')
      .replace('{userInput}', body.userInput || '(Please analyze the workflow and generate metadata)')

    let systemPrompt = body.customSystemPrompt || promptConfig.systemPrompt

    if (body.availableTags && body.availableTags.length > 0) {
      const existingTagsPattern = /Existing Tags:[\s\S]*?(?=\n\n|$)/
      if (existingTagsPattern.test(systemPrompt)) {
        systemPrompt = systemPrompt.replace(
          existingTagsPattern,
          `Existing Tags:\n${body.availableTags.join(', ')}`
        )
      } else {
        systemPrompt += `\n\nExisting Tags (for reference):\n${body.availableTags.join(', ')}`
      }
    }

    const config = useRuntimeConfig()
    const apiKey = config.deepseekApiKey
    const apiEndpoint = config.deepseekApiEndpoint
    const model = config.deepseekModel

    if (!apiKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'AI translation service is not configured'
      })
    }

    const response = await fetch(apiEndpoint, {
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
        temperature: 0.7,
        max_tokens: 800
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[AI Assist Batch] API Error:', errorText)
      throw createError({
        statusCode: response.status,
        statusMessage: `AI API error: ${response.statusText}`
      })
    }

    const result = await response.json()
    const aiResponse = result.choices?.[0]?.message?.content

    if (!aiResponse) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No response from AI'
      })
    }

    let suggestion: BatchSuggestion

    try {
      const cleaned = aiResponse.trim()
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON object found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      suggestion = {
        title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
        description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.map((t: any) => String(t).trim()).filter((t: string) => t.length > 0)
          : [],
        models: Array.isArray(parsed.models)
          ? parsed.models.map((m: any) => String(m).trim()).filter((m: string) => m.length > 0)
          : []
      }
    } catch (err) {
      console.error('[AI Assist Batch] Failed to parse response:', err)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to parse AI response. Please try again.'
      })
    }

    console.log('[AI Assist Batch] Parsed suggestion:', suggestion)

    return {
      success: true,
      suggestion,
      usage: result.usage
    }
  } catch (error: any) {
    console.error('[AI Assist Batch] Error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to get AI suggestion'
    })
  }
})
