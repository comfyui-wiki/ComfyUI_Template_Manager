import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Editor from '../../components/ThumbnailSplitEditor.vue'
afterEach(() => { vi.unstubAllGlobals() })
describe('split editor', () => {
  it('exports both selected sources and invalidates output when composition changes', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const encoder = { writeFile: vi.fn(), exec: vi.fn().mockResolvedValue(0), readFile: vi.fn().mockResolvedValue(new Uint8Array([1])), deleteFile: vi.fn().mockResolvedValue(undefined) }
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]
    const wrapper = mount(Editor, { props: { files, native: false, ready: true, ffmpeg: encoder as any }, global: { stubs: { ThumbnailOverlayEditor: defineComponent({ setup(_, { expose }) { expose({ exportPng: async () => new Blob(['png'], { type: 'image/png' }) }); return () => null } }) } } })
    await wrapper.findAll('button').find(b => b.text().includes('Export split'))!.trigger('click')
    await flushPromises()
    expect(encoder.writeFile).toHaveBeenCalledTimes(3)
    expect(encoder.exec.mock.calls[0][0].join(' ')).toContain('hstack=inputs=2')
    expect(encoder.exec.mock.calls[0][0].join(' ')).toContain('[base][2:v]overlay=0:0')
    await wrapper.findAll('button').find(b => b.text() === 'Use this thumbnail')!.trigger('click')
    expect(wrapper.emitted('converted')?.[0][0]).toBeInstanceOf(File)
    await wrapper.findAll('button').find(b => b.text() === 'Reverse order')!.trigger('click')
    expect(wrapper.find('a[download]').exists()).toBe(false)
    wrapper.unmount()
  })
})
