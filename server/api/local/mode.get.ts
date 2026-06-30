import { getGitStatus, getLocalRepoDisplayName, getLocalRepoRoot, gitExec, isLocalRepoMode, getCompareRef } from '~/server/utils/local-repo'

export default defineEventHandler(async () => {
  if (!isLocalRepoMode()) {
    return {
      mode: 'github' as const,
      localRepoMode: false
    }
  }

  const [status, commitSha] = await Promise.all([
    getGitStatus(),
    gitExec(['rev-parse', 'HEAD']).catch(() => '')
  ])

  return {
    mode: 'local' as const,
    localRepoMode: true,
    repoPath: getLocalRepoRoot(),
    displayName: getLocalRepoDisplayName(),
    compareRef: getCompareRef(),
    branch: status.branch,
    commitSha: commitSha || undefined,
    dirty: status.dirty,
    changedFiles: status.changedFiles
  }
})
