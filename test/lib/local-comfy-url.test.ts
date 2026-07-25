import { describe, expect, it } from 'vitest'
import { buildLocalComfyTemplateUrl, normalizeLocalComfyBaseUrl } from '../../lib/local-comfy-url'

describe('local-comfy-url', () => {
  it('normalizes base URL trailing slashes', () => {
    expect(normalizeLocalComfyBaseUrl('http://127.0.0.1:8188/')).toBe('http://127.0.0.1:8188')
    expect(normalizeLocalComfyBaseUrl('http://127.0.0.1:8188///')).toBe('http://127.0.0.1:8188')
  })

  it('builds ComfyUI template URLs with path slash before query', () => {
    expect(buildLocalComfyTemplateUrl('http://127.0.0.1:8188', 'video_ltx2_i2v_lora'))
      .toBe('http://127.0.0.1:8188/?template=video_ltx2_i2v_lora')
    expect(buildLocalComfyTemplateUrl('http://127.0.0.1:8188/', 'video_ltx2_i2v_lora'))
      .toBe('http://127.0.0.1:8188/?template=video_ltx2_i2v_lora')
  })
})
