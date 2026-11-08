import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: class {} }))
vi.mock('@ffmpeg/util', () => ({ fetchFile: vi.fn() }))
import Converter from '../../components/ThumbnailConverter.vue'
afterEach(() => { vi.unstubAllGlobals() })
describe('thumbnail multi-source entry', () => {
  it('returns to one source after deletion and preserves overlays and playback settings', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { workflowTemplatesMode: 'local' } }))
    vi.stubGlobal('Image', class {
      width = 400; height = 400; onload: (() => void) | null = null
      set src(value: string) { this.onload?.() }
    })
    const files = [new File(['a'], 'first.webp', { type: 'image/webp' }), new File(['b'], 'second.mp4', { type: 'video/mp4' })]
    const wrapper = mount(Converter, { props: { initialFiles: files }, global: { stubs: { ThumbnailSplitEditor: true, ThumbnailOverlayEditor: true } } })
    const split = wrapper.findComponent({ name: 'ThumbnailSplitEditor' })
    split.vm.$emit('update:speed', 2)
    split.vm.$emit('update:quality', 70)
    const overlays = (wrapper.vm as any).$.provides['thumbnail-overlay-items']
    overlays.value.push({ id: 1, url: URL.createObjectURL(new Blob(['overlay'])) })
    split.vm.$emit('sources', [files[0]])
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ThumbnailSplitEditor' }).exists()).toBe(false)
    expect(wrapper.get('[aria-label="Source assets"]').text()).toContain('first.webp')
    expect(wrapper.get('[aria-label="Source assets"]').text()).not.toContain('second.mp4')
    expect(wrapper.text()).toContain('Quality (70%)')
    expect(overlays.value).toHaveLength(1)
    wrapper.unmount()
  })
  it('opens the preview directly and switches sidebar modes without replacing sources', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { workflowTemplatesMode: 'local' } }))
    const files = [new File(['a'], 'first.webp', { type: 'image/webp' }), new File(['b'], 'second.mp4', { type: 'video/mp4' })]
    const wrapper = mount(Converter, { props: { initialFiles: files }, global: { stubs: { ThumbnailSplitEditor: true } } })
    expect(wrapper.text()).not.toContain('Choose how to combine your sources')
    const split = wrapper.findComponent({ name: 'ThumbnailSplitEditor' })
    expect(split.props('files')).toEqual(files)
    expect(split.props('mode')).toBe('horizontal')
    split.vm.$emit('mode', 'vertical')
    await wrapper.vm.$nextTick()
    expect(split.props('mode')).toBe('vertical')
    expect(split.props('files')).toEqual(files)
    expect(wrapper.findComponent({ name: 'ThumbnailSplitEditor' }).vm).toBe(split.vm)
    wrapper.unmount()
  })
})
