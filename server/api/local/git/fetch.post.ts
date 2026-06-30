import { compareWithCompareRef, fetchCompareRemote, isLocalRepoMode } from '~/server/utils/local-repo'

export default defineEventHandler(async () => {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Local repo mode is not enabled' })
  }

  const fetchResult = await fetchCompareRemote()
  if (!fetchResult.success) {
    throw createError({
      statusCode: 500,
      statusMessage: fetchResult.message
    })
  }

  const comparison = await compareWithCompareRef()

  return {
    success: true,
    message: fetchResult.message,
    comparison
  }
})
