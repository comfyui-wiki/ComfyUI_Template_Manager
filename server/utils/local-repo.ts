import { promises as fs } from 'fs'
import { dirname, normalize, resolve } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export function isLocalRepoMode(): boolean {
  const config = useRuntimeConfig()
  return config.workflowTemplatesMode === 'local' && Boolean(config.workflowTemplatesPath?.trim())
}

export function getLocalRepoRoot(): string {
  const config = useRuntimeConfig()
  const root = config.workflowTemplatesPath?.trim()
  if (config.workflowTemplatesMode !== 'local' || !root) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Local repo mode is not enabled (set WORKFLOW_TEMPLATES_MODE=local and WORKFLOW_TEMPLATES_PATH)'
    })
  }
  return resolve(root)
}

export function getCompareRef(): string {
  const config = useRuntimeConfig()
  return config.workflowTemplatesCompareRef?.trim() || 'upstream/main'
}

/** Resolve a repo-relative path and block path traversal */
export function resolveRepoPath(relativePath: string): string {
  const root = getLocalRepoRoot()
  const cleaned = relativePath.replace(/^\/+/, '')
  const full = resolve(root, normalize(cleaned))
  if (full !== root && !full.startsWith(root + '/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid repository path' })
  }
  return full
}

export async function readRepoText(relativePath: string): Promise<string> {
  return fs.readFile(resolveRepoPath(relativePath), 'utf-8')
}

export async function readRepoJson<T = unknown>(relativePath: string): Promise<T> {
  return JSON.parse(await readRepoText(relativePath))
}

export async function writeRepoText(relativePath: string, content: string): Promise<void> {
  const full = resolveRepoPath(relativePath)
  await fs.mkdir(dirname(full), { recursive: true })
  await fs.writeFile(full, content, 'utf-8')
}

export async function writeRepoBuffer(relativePath: string, content: Buffer): Promise<void> {
  const full = resolveRepoPath(relativePath)
  await fs.mkdir(dirname(full), { recursive: true })
  await fs.writeFile(full, content)
}

export async function repoFileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(resolveRepoPath(relativePath))
    return true
  } catch {
    return false
  }
}

export async function deleteRepoFile(relativePath: string): Promise<void> {
  try {
    await fs.unlink(resolveRepoPath(relativePath))
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error
  }
}

export async function gitExec(args: string[]): Promise<string> {
  const root = getLocalRepoRoot()
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024
  })
  return stdout.trim()
}

export async function readFileAtRef(ref: string, relativePath: string): Promise<string | null> {
  try {
    return await gitExec(['show', `${ref}:${relativePath}`])
  } catch {
    return null
  }
}

export async function readFileBufferAtRef(ref: string, relativePath: string): Promise<Buffer | null> {
  try {
    const root = getLocalRepoRoot()
    const { stdout } = await execFileAsync('git', ['show', `${ref}:${relativePath}`], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'buffer'
    })
    return stdout as Buffer
  } catch {
    return null
  }
}

export async function readJsonAtRef<T = unknown>(ref: string, relativePath: string): Promise<T | null> {
  const text = await readFileAtRef(ref, relativePath)
  if (!text) return null
  return JSON.parse(text)
}

export async function getCurrentBranch(): Promise<string> {
  return gitExec(['rev-parse', '--abbrev-ref', 'HEAD'])
}

export async function listLocalBranches(): Promise<string[]> {
  const stdout = await gitExec(['branch', '--format=%(refname:short)'])
  const branches = stdout.split('\n').map(b => b.trim()).filter(Boolean)
  return [...new Set(branches)]
}

export async function checkoutBranch(branch: string): Promise<void> {
  await gitExec(['checkout', branch])
}

export async function createBranch(name: string, startPoint?: string): Promise<void> {
  if (startPoint) {
    await gitExec(['checkout', '-b', name, startPoint])
  } else {
    await gitExec(['checkout', '-b', name])
  }
}

export async function gitAdd(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await gitExec(['add', '--', ...paths])
}

export async function gitCommit(message: string): Promise<string> {
  const status = await gitExec(['status', '--porcelain'])
  if (!status) {
    return await gitExec(['rev-parse', 'HEAD'])
  }
  await gitExec(['commit', '-m', message])
  return gitExec(['rev-parse', 'HEAD'])
}

export async function getGitStatus(): Promise<{ branch: string; dirty: boolean; changedFiles: string[] }> {
  const branch = await getCurrentBranch()
  const porcelain = await gitExec(['status', '--porcelain'])
  const changedFiles = porcelain
    .split('\n')
    .filter(Boolean)
    .map(line => line.slice(3).trim())
  return { branch, dirty: changedFiles.length > 0, changedFiles }
}

export function getLocalRepoDisplayName(): string {
  const root = getLocalRepoRoot()
  const parts = root.split(/[/\\]/)
  return `local/${parts[parts.length - 1] || 'workflow_templates'}`
}
