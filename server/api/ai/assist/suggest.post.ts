import { getServerSession } from '#auth'
import { checkRateLimit, checkOrigin } from '~/server/utils/rate-limiter'

interface RequestBody {
  fieldType: 'tags' | 'title' | 'description'
  context: {
    title?: string
    description?: string
    tags?: string[]
    models?: string[]
  }
  userInput?: string
  availableTags?: string[]
  customSystemPrompt?: string
  customContextText?: string
}

interface PromptConfig {
  systemPrompt: string
  userPromptTemplate: string
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

    if (!body.fieldType || !body.context) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: fieldType, context'
      })
    }

    console.log('[AI Assist] Request:', {
      fieldType: body.fieldType,
      hasUserInput: !!body.userInput,
      hasCustomSystemPrompt: !!body.customSystemPrompt,
      hasCustomContextText: !!body.customContextText,
      context: body.context
    })

    // Load prompt configuration
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')

    let promptsConfig: Record<string, PromptConfig>
    try {
      const configPath = join(process.cwd(), 'config', 'ai-assistant-prompts.json')
      const configContent = await readFile(configPath, 'utf-8')
      promptsConfig = JSON.parse(configContent)
    } catch (error: any) {
      console.error('[AI Assist] Failed to load prompt config:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to load prompt configuration'
      })
    }

    if (!promptsConfig || !promptsConfig[body.fieldType]) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Prompt configuration not found for field type'
      })
    }

    const promptConfig = promptsConfig[body.fieldType]

    // Build user prompt by replacing placeholders
    // Use custom context text if provided, otherwise use structured context
    let contextForPrompt: string
    if (body.customContextText) {
      contextForPrompt = body.customContextText
    } else {
      contextForPrompt = [
        `Title: ${body.context.title || '(not provided)'}`,
        `Description: ${body.context.description || '(not provided)'}`,
        `Tags: ${body.context.tags?.join(', ') || '(none)'}`,
        `Models: ${body.context.models?.join(', ') || '(none)'}`
      ].join('\n')
    }

    let userPrompt = promptConfig.userPromptTemplate
      .replace('{title}', body.context.title || '(not provided)')
      .replace('{description}', body.context.description || '(not provided)')
      .replace('{tags}', body.context.tags?.join(', ') || '(none)')
      .replace('{models}', body.context.models?.join(', ') || '(none)')
      .replace('{currentTags}', body.context.tags?.join(', ') || '(none)')
      .replace('{userInput}', body.userInput || '(none)')

    // If using custom context text, replace the template context section
    if (body.customContextText) {
      userPrompt = userPrompt.replace(
        /Template Title:.*?Template Description:.*?Tags:.*?Models Used:.*?(?=\n\nAdditional Context|$)/s,
        contextForPrompt
      )
    }

    // Use custom system prompt if provided, otherwise use default from config
    let systemPrompt = body.customSystemPrompt || promptConfig.systemPrompt

    // For tags field, update available tags list in system prompt
    if (body.fieldType === 'tags' && body.availableTags && body.availableTags.length > 0) {
      // Try to find and replace the existing tags list in the prompt
      const existingTagsPattern = /Existing Tags:[\s\S]*?(?=\n\n|$)/
      if (existingTagsPattern.test(systemPrompt)) {
        systemPrompt = systemPrompt.replace(
          existingTagsPattern,
          `Existing Tags:\n${body.availableTags.join(', ')}`
        )
      } else {
        // If no existing tags section, append it
        systemPrompt += `\n\nExisting Tags:\n${body.availableTags.join(', ')}`
      }
    }

    // Call DeepSeek API
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

    console.log('[AI Assist] Calling DeepSeek API:', {
      endpoint: apiEndpoint,
      model,
      fieldType: body.fieldType,
      usingCustomPrompt: !!body.customSystemPrompt,
      usingCustomContext: !!body.customContextText
    })

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[AI Assist] API Error:', errorText)
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

    console.log('[AI Assist] Raw AI Response:', aiResponse)

    // Parse response based on field type
    let suggestion: string | string[]

    if (body.fieldType === 'tags') {
      // Try to parse as JSON array
      try {
        const cleaned = aiResponse.trim()
        const jsonMatch = cleaned.match(/\[.*\]/s)
        if (jsonMatch) {
          suggestion = JSON.parse(jsonMatch[0])
        } else {
          // Fallback: split by comma
          suggestion = cleaned
            .split(',')
            .map((tag: string) => tag.trim().replace(/^["']|["']$/g, ''))
            .filter((tag: string) => tag.length > 0)
        }

        // Filter out tags that are already present
        const currentTags = body.context.tags || []
        suggestion = (suggestion as string[]).filter(
          tag => !currentTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
        )

        // Empty array is valid - means current tags are sufficient
        // No error thrown for empty suggestion array
      } catch (err) {
        console.error('[AI Assist] Failed to parse tags:', err)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to parse AI response for tags'
        })
      }
    } else {
      // For title and description, return the text directly
      suggestion = aiResponse.trim().replace(/^["']|["']$/g, '')
    }

    console.log('[AI Assist] Parsed suggestion:', suggestion)
    if (body.fieldType === 'tags' && Array.isArray(suggestion) && suggestion.length === 0) {
      console.log('[AI Assist] AI determined that current tags are sufficient - no new tags needed')
    }

    return {
      success: true,
      suggestion,
      usage: result.usage,
      prompts: {
        system: systemPrompt,
        user: userPrompt
      }
    }
  } catch (error: any) {
    console.error('[AI Assist] Error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to get AI suggestion'
    })
  }
})
