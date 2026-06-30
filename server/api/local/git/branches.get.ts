import { getCurrentBranch, getGitStatus, isLocalRepoMode, listLocalBranches } from '~/server/utils/local-repo'

export default defineEventHandler(async () => {
  if (!isLocalRepoMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Local repo mode is not enabled' })
  }

  const [branches, current, status] = await Promise.all([
    listLocalBranches(),
    getCurrentBranch(),
    getGitStatus()
  ])

  return {
    success: true,
    branches: branches.map(name => ({ name, current: name === current })),
    current,
    dirty: status.dirty,
    changedFiles: status.changedFiles
  }
})
