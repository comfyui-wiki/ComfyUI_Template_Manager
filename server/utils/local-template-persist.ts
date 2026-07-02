import type { Octokit } from '@octokit/rest'
import { formatTemplateJson } from '~/server/utils/json-formatter'
import {
  deleteRepoFile,
  gitAdd,
  gitCommit,
  isLocalRepoMode,
  readRepoJson,
  readRepoText,
  repoFileExists,
  writeRepoBuffer,
  writeRepoText
} from '~/server/utils/local-repo'

export interface LocalTreeItem {
  path: string
  content?: string
  sha?: string | null
}

const pendingLocalBlobs = new Map<string, Buffer>()

/** Minimal Octokit shim so existing handlers can read/write via the local clone */
export function createLocalOctokit(): Octokit {
  pendingLocalBlobs.clear()

  return {
    repos: {
      getContent: async ({ path }: { path: string }) => {
        try {
          const text = await readRepoText(path)
          return {
            data: {
              content: Buffer.from(text, 'utf-8').toString('base64'),
              sha: `local:${path}`,
              type: 'file' as const,
              encoding: 'base64'
            }
          }
        } catch {
          const err = new Error('Not Found') as Error & { status: number }
          err.status = 404
          throw err
        }
      }
    },
    git: {
      getRef: async () => ({ data: { object: { sha: 'local' } } }),
      getCommit: async () => ({ data: { tree: { sha: 'local' } } }),
      getBlob: async ({ file_sha }: { file_sha: string }) => {
        if (file_sha.startsWith('local-blob-')) {
          const buf = pendingLocalBlobs.get(file_sha)
          if (!buf) throw new Error(`Local blob not found: ${file_sha}`)
          return {
            data: {
              content: buf.toString('base64'),
              encoding: 'base64'
            }
          }
        }
        if (file_sha.startsWith('local:')) {
          const relativePath = file_sha.slice('local:'.length)
          const text = await readRepoText(relativePath)
          return {
            data: {
              content: Buffer.from(text, 'utf-8').toString('base64'),
              encoding: 'base64'
            }
          }
        }
        throw new Error(`Local mode: unknown blob sha ${file_sha}`)
      },
      createBlob: async ({ content, encoding }: { content: string; encoding?: string }) => {
        const sha = `local-blob-${pendingLocalBlobs.size + 1}`
        const buf = encoding === 'base64'
          ? Buffer.from(content, 'base64')
          : Buffer.from(content, 'utf-8')
        pendingLocalBlobs.set(sha, buf)
        return { data: { sha } }
      },
      createTree: async () => ({ data: { sha: 'local' } }),
      createCommit: async () => ({ data: { sha: 'local' } }),
      updateRef: async () => ({ data: {} })
    }
  } as unknown as Octokit
}

export async function writeLocalTree(items: LocalTreeItem[]): Promise<string[]> {
  const changedPaths: string[] = []

  for (const item of items) {
    if (item.sha === null) {
      await deleteRepoFile(item.path)
      changedPaths.push(item.path)
      continue
    }

    const blobSha = item.sha ? String(item.sha) : ''
    if (blobSha.startsWith('local-blob-')) {
      const buf = pendingLocalBlobs.get(blobSha)
      if (buf) {
        await writeRepoBuffer(item.path, buf)
        changedPaths.push(item.path)
      }
      continue
    }

    if (item.content != null) {
      await writeRepoText(item.path, item.content)
      changedPaths.push(item.path)
    }
  }

  pendingLocalBlobs.clear()
  return changedPaths
}

export async function writeLocalTreeAndCommit(
  items: LocalTreeItem[],
  commitMessage: string
): Promise<{ sha: string; changedPaths: string[] }> {
  const changedPaths = await writeLocalTree(items)
  if (changedPaths.length > 0) {
    await gitAdd(changedPaths)
  }
  const sha = await gitCommit(commitMessage)
  return { sha, changedPaths }
}

export async function readLocalIndex(): Promise<any[]> {
  return readRepoJson<any[]>('templates/index.json')
}

export async function readLocalBundles(): Promise<Record<string, string[]>> {
  try {
    return await readRepoJson<Record<string, string[]>>('bundles.json')
  } catch {
    return {}
  }
}

export function formatIndexForWrite(indexData: any[]): string {
  return formatTemplateJson(indexData)
}

export async function localFileExists(repoRelativePath: string): Promise<boolean> {
  return repoFileExists(repoRelativePath)
}

export function isLocalModeEnabled(): boolean {
  return isLocalRepoMode()
}

export async function writeBase64File(repoRelativePath: string, base64: string): Promise<void> {
  await writeRepoBuffer(repoRelativePath, Buffer.from(base64, 'base64'))
}
