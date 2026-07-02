import { createBranch, getCurrentBranch, isLocalRepoMode } from '~/server/utils/local-repo'

export default defineEventHandler(async (event) => {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Local repo mode is not enabled' })
  }

  const body = await readBody<{ name: string; from?: string }>(event)
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch name' })
  }

  await createBranch(body.name.trim(), body.from?.trim())
  const current = await getCurrentBranch()

  return { success: true, branch: current }
})
