import { getCompareRef, isLocalRepoMode, readRepoJson, readJsonAtRef } from '~/server/utils/local-repo'

export default defineEventHandler(async () => {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Local repo mode is not enabled' })
  }

  const compareRef = getCompareRef()
  const [current, base] = await Promise.all([
    readRepoJson<Record<string, string[]>>('bundles.json').catch(() => ({})),
    readJsonAtRef<Record<string, string[]>>(compareRef, 'bundles.json').catch(() => ({}))
  ])

  return {
    success: true,
    current: current || {},
    base: base || {},
    compareRef
  }
})
