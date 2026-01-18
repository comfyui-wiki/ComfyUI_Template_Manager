/**
 * Rate limiter for AI translation API
 */

import type { H3Event } from 'h3'
import { readFileSync } from 'fs'
import { join } from 'path'

interface I18nConfig {
  aiTranslation: {
    security: {
      rateLimit: {
        enabled: boolean
        maxRequestsPerMinute: number
      }
      originCheck: {
        enabled: boolean
        allowedOrigins: string[]
      }
      whitelist: {
        users: string[]
      }
    }
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
      console.log('[Rate Limiter] Server assets not available, using file system fallback')
    }

    // Fallback to file system (development)
    if (!i18nConfig) {
      try {
        const configPath = join(process.cwd(), 'config', 'i18n-config.json')
        const configContent = readFileSync(configPath, 'utf-8')
        i18nConfig = JSON.parse(configContent)
        console.log('[Rate Limiter] Loaded config from file system')
      } catch (error: any) {
        console.error('[Rate Limiter] Failed to load i18n config:', error.message)
        throw new Error('Failed to load rate limiter configuration')
      }
    }
  }
  return i18nConfig!
}

// Store request counts per user
// Format: { username: [timestamp1, timestamp2, ...] }
const requestLog = new Map<string, number[]>()

/**
 * Check if user is in whitelist
 */
export async function isWhitelisted(username: string): Promise<boolean> {
  const config = await loadI18nConfig()
  return config.aiTranslation.security.whitelist.users.includes(username)
}

/**
 * Check rate limit for a user
 * Returns true if allowed, false if rate limit exceeded
 */
export async function checkRateLimit(username: string): Promise<{ allowed: boolean; remaining?: number; resetAt?: Date }> {
  const config = await loadI18nConfig()

  // Check if rate limiting is enabled
  if (!config.aiTranslation.security.rateLimit.enabled) {
    return { allowed: true }
  }

  // Whitelist users bypass rate limits
  if (isWhitelisted(username)) {
    console.log(`[Rate Limiter] User ${username} is whitelisted, bypassing rate limit`)
    return { allowed: true }
  }

  const now = Date.now()
  const oneMinuteAgo = now - 60 * 1000
  const maxRequests = config.aiTranslation.security.rateLimit.maxRequestsPerMinute

  // Get user's request history
  let userRequests = requestLog.get(username) || []

  // Remove requests older than 1 minute
  userRequests = userRequests.filter(timestamp => timestamp > oneMinuteAgo)

  // Check if user exceeded rate limit
  if (userRequests.length >= maxRequests) {
    const oldestRequest = Math.min(...userRequests)
    const resetAt = new Date(oldestRequest + 60 * 1000)

    console.log(`[Rate Limiter] User ${username} exceeded rate limit (${userRequests.length}/${maxRequests})`)
    return {
      allowed: false,
      remaining: 0,
      resetAt
    }
  }

  // Add current request
  userRequests.push(now)
  requestLog.set(username, userRequests)

  const remaining = maxRequests - userRequests.length
  console.log(`[Rate Limiter] User ${username} request allowed (${userRequests.length}/${maxRequests}, ${remaining} remaining)`)

  return {
    allowed: true,
    remaining
  }
}

/**
 * Check Origin/Referer header
 */
export async function checkOrigin(event: H3Event): Promise<{ allowed: boolean; reason?: string }> {
  const config = await loadI18nConfig()
  const runtimeConfig = useRuntimeConfig()

  console.log('[Rate Limiter] Origin check config:', {
    enabled: config.aiTranslation.security.originCheck.enabled,
    allowedOrigins: config.aiTranslation.security.originCheck.allowedOrigins
  })

  // Check if origin check is enabled
  if (!config.aiTranslation.security.originCheck.enabled) {
    console.log('[Rate Limiter] Origin check is DISABLED, allowing request')
    return { allowed: true }
  }

  const origin = getHeader(event, 'origin')
  const referer = getHeader(event, 'referer')

  // Allow requests without origin/referer (server-side rendering)
  if (!origin && !referer) {
    console.log('[Rate Limiter] No origin/referer header (likely SSR), allowing request')
    return { allowed: true }
  }

  // Get allowed origins
  let allowedOrigins = config.aiTranslation.security.originCheck.allowedOrigins

  // If no allowed origins configured, use NEXTAUTH_URL from environment
  if (!allowedOrigins || allowedOrigins.length === 0) {
    const nextAuthUrl = runtimeConfig.authOrigin || process.env.NEXTAUTH_URL
    if (nextAuthUrl) {
      // Extract origin from NEXTAUTH_URL
      try {
        const url = new URL(nextAuthUrl)
        allowedOrigins = [url.origin]
        console.log('[Rate Limiter] Using NEXTAUTH_URL as allowed origin:', url.origin)
      } catch (e) {
        console.error('[Rate Limiter] Invalid NEXTAUTH_URL:', nextAuthUrl)
      }
    }
  }

  // If still no allowed origins, allow all (fallback)
  if (!allowedOrigins || allowedOrigins.length === 0) {
    console.log('[Rate Limiter] No allowed origins configured, allowing all requests')
    return { allowed: true }
  }

  // Extract request origin
  const requestOrigin = origin || (referer ? new URL(referer).origin : null)

  if (!requestOrigin) {
    console.warn('[Rate Limiter] Could not determine request origin')
    return {
      allowed: false,
      reason: 'Could not determine request origin'
    }
  }

  // Check if request origin is in allowed list
  const isAllowed = allowedOrigins.some(allowedOrigin => {
    // Normalize origins for comparison (remove trailing slash)
    const normalizedAllowed = allowedOrigin.replace(/\/$/, '')
    const normalizedRequest = requestOrigin.replace(/\/$/, '')
    return normalizedRequest === normalizedAllowed
  })

  if (isAllowed) {
    console.log(`[Rate Limiter] Origin check passed: ${requestOrigin}`)
    return { allowed: true }
  }

  console.warn(`[Rate Limiter] Origin check failed: ${requestOrigin} not in allowed list:`, allowedOrigins)
  return {
    allowed: false,
    reason: `Request origin '${requestOrigin}' is not allowed. Only requests from allowed domains are permitted.`
  }
}

/**
 * Clean up old request logs (run periodically)
 */
export function cleanupRequestLog() {
  const now = Date.now()
  const oneHourAgo = now - 60 * 60 * 1000

  for (const [username, timestamps] of requestLog.entries()) {
    const recentRequests = timestamps.filter(t => t > oneHourAgo)
    if (recentRequests.length === 0) {
      requestLog.delete(username)
    } else {
      requestLog.set(username, recentRequests)
    }
  }
}

// Cleanup every 10 minutes
setInterval(cleanupRequestLog, 10 * 60 * 1000)
