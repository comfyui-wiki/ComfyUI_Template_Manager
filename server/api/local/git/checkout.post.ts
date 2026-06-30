import { checkoutBranch, getCurrentBranch, isLocalRepoMode } from '~/server/utils/local-repo'

export default defineEventHandler(async (event) => {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Local repo mode is not enabled' })
  }

  const body = await readBody<{ branch: string }>(event)
  if (!body?.branch?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch name' })
  }

  await checkoutBranch(body.branch.trim())
  const current = await getCurrentBranch()

  return { success: true, branch: current }
})
