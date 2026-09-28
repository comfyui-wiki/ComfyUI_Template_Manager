import { describe, expect, it, vi } from 'vitest'
import {
  formatModelFileSize,
  isAllowedModelDownloadUrl,
  modelDownloadMarkdown,
  readModelFileSize,
} from '../../lib/model-file-size'

function response(status: number, headers: Record<string, string>, location?: string) {
  const all = location ? { ...headers, location } : headers
  return {
    status,
    headers: { get: (name: string) => all[name.toLowerCase()] ?? null },
    body: { cancel: vi.fn() },
  }
}

describe('model file size', () => {
  it('formats model weights in GB or MB', () => {
    expect(formatModelFileSize(5 * 1024 ** 3)).toBe('5 GB')
    expect(formatModelFileSize(4.656 * 1024 ** 3)).toBe('4.66 GB')
    expect(formatModelFileSize(242.5 * 1024 ** 2)).toBe('242.5 MB')
    expect(formatModelFileSize(0)).toBeNull()
  })

  it('appends a size only when one was read', () => {
    const url = 'https://huggingface.co/Comfy-Org/MoGe/resolve/main/model.safetensors'
    expect(modelDownloadMarkdown('model.safetensors', url, 5 * 1024 ** 3)).toBe(
      `- [model.safetensors](${url}) (5 GB)`
    )
    expect(modelDownloadMarkdown('model.safetensors', url, null)).toBe(`- [model.safetensors](${url})`)
  })

  it('accepts public model hosts and rejects everything else', () => {
    expect(isAllowedModelDownloadUrl('https://cdn-lfs.huggingface.co/repos/a/b')).toBe(true)
    expect(isAllowedModelDownloadUrl('https://cas-bridge.xethub.hf.co/xet/a')).toBe(true)
    expect(isAllowedModelDownloadUrl('https://us.aws.cdn.hf.co/xet-bridge-us/file')).toBe(true)
    expect(isAllowedModelDownloadUrl('https://www.modelscope.cn/models/a/b/resolve/master/m.safetensors')).toBe(true)
    expect(isAllowedModelDownloadUrl('http://huggingface.co/a/b')).toBe(false)
    expect(isAllowedModelDownloadUrl('https://user:pass@huggingface.co/a/b')).toBe(false)
    expect(isAllowedModelDownloadUrl('https://127.0.0.1/secret')).toBe(false)
    expect(isAllowedModelDownloadUrl('https://evilhuggingface.co/a')).toBe(false)
  })

  it('prefers the linked file size over a redirect body length', async () => {
    const fetchImpl = vi.fn(async () => response(302, {
      'x-linked-size': '856505640',
      'content-length': '1100',
      'content-type': 'text/plain',
    }))
    await expect(
      readModelFileSize('https://huggingface.co/org/repo/resolve/main/model.safetensors', fetchImpl as unknown as typeof fetch)
    ).resolves.toBe(856505640)
  })

  it('reads content-length from the file response and ignores other hosts', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return response(200, { 'content-type': 'application/octet-stream' })
      return response(206, { 'content-range': 'bytes 0-0/2048', 'content-type': 'application/octet-stream' })
    })
    await expect(
      readModelFileSize('https://huggingface.co/org/repo/resolve/main/model.safetensors', fetchImpl as unknown as typeof fetch)
    ).resolves.toBe(2048)

    const blocked = vi.fn()
    await expect(readModelFileSize('https://127.0.0.1/secret', blocked as unknown as typeof fetch)).resolves.toBeNull()
    expect(blocked).not.toHaveBeenCalled()
  })
})
