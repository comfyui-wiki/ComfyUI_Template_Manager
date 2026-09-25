import type { H3Event } from 'h3'
import { getServerSession } from '#auth'
import { isLocalRepoMode } from '~/server/utils/local-repo'
import { checkOrigin, checkRateLimit } from '~/server/utils/rate-limiter'

/** GitHub login is only required outside local clone mode. Origin and rate limits still apply. */
export async function authorizeAiRequest(event: H3Event) {
  const localMode = isLocalRepoMode()
  const session = await getServerSession(event)

  if (!localMode && !session?.accessToken) {
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

  const username =
    (session?.user as { login?: string; name?: string } | undefined)?.login
    || (session?.user as { login?: string; name?: string } | undefined)?.name
    || (localMode ? 'local' : 'unknown')

  const rateLimitCheck = checkRateLimit(username)
  if (!rateLimitCheck.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limit exceeded. Try again after ${rateLimitCheck.resetAt?.toISOString() || 'unknown'}`
    })
  }

  return { session, localMode, username }
}
