import { describe, expect, it } from 'vitest'
import { applyMinComfyUIVersion, readMinComfyUIVersion } from '../../lib/template-comfyui-version'

describe('template-comfyui-version', () => {
  it('prefers minComfyUIVersion over the legacy comfyuiVersion key', () => {
    expect(readMinComfyUIVersion({
      minComfyUIVersion: '0.28.0',
      comfyuiVersion: '0.3.26'
    })).toBe('0.28.0')
  })

  it('falls back to legacy comfyuiVersion', () => {
    expect(readMinComfyUIVersion({ comfyuiVersion: '0.34.5' })).toBe('0.34.5')
    expect(readMinComfyUIVersion({})).toBe('')
  })

  it('writes minComfyUIVersion and drops the legacy key', () => {
    const template = { name: 'demo', comfyuiVersion: '0.3.26' }
    applyMinComfyUIVersion(template, '0.28.0')
    expect(template).toEqual({ name: 'demo', minComfyUIVersion: '0.28.0' })
  })
})
