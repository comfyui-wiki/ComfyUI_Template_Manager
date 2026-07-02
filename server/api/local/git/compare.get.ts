import { compareWithCompareRef, isLocalRepoMode } from '~/server/utils/local-repo'

export default defineEventHandler(async () => {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Local repo mode is not enabled' })
  }

  const comparison = await compareWithCompareRef()

  return {
    success: comparison.available,
    ...comparison
  }
})
