import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import Editor from '../../components/ThumbnailOverlayEditor.vue'

const ctx = { save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), clip: vi.fn(), drawImage: vi.fn(), stroke: vi.fn() }
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('Image', class { naturalWidth = 400; naturalHeight = 200; src = ''; decode = () => Promise.resolve() })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['png'], { type: 'image/png' })))
  wrapper = mount(Editor, { props: { src: 'base.png', video: false, size: 500, crop: null, start: 0, end: 3, speed: 1, disabled: false } })
})
afterEach(() => { wrapper.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks() })
async function upload() {
  const input = wrapper.get('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [new File(['a'], 'one.png'), new File(['b'], 'two.png')], configurable: true })
  await input.trigger('change'); await flushPromises()
}
function draw() { (wrapper.vm as any).drawOverlays(ctx, 500) }
describe('thumbnail overlay editor', () => {
  it('loads multiple images, exports shared geometry and applies adjustable styles', async () => {
    await upload()
    expect(wrapper.text()).toContain('one.png')
    expect(wrapper.text()).toContain('two.png')
    await wrapper.get('input[aria-label="White border width"]').setValue('10')
    await wrapper.get('input[aria-label="Corner radius"]').setValue('30')
    draw()
    expect(ctx.roundRect).toHaveBeenLastCalledWith(50, 50, 175, 87.5, 30)
    expect((ctx as any).lineWidth).toBe(20)
    expect(await (wrapper.vm as any).exportPng()).toBeInstanceOf(Blob)
    expect(wrapper.emitted('change')!.length).toBeGreaterThanOrEqual(4)
  })
  it('drags and resizes within the canvas while preserving the image ratio', async () => {
    await upload()
    const stage = wrapper.get('.touch-none')
    Object.defineProperty(stage.element, 'setPointerCapture', { value: vi.fn() })
    vi.spyOn(stage.element, 'getBoundingClientRect').mockReturnValue({ width: 500 } as DOMRect)
    const layer = wrapper.findAll('.cursor-move')[1]
    await layer.trigger('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 })
    await stage.trigger('pointermove', { clientX: 1000, clientY: 1000 })
    await stage.trigger('pointerup')
    draw()
    expect(ctx.roundRect).toHaveBeenLastCalledWith(325, 412.5, 175, 87.5, 12)
    await layer.trigger('pointerdown', { clientX: 1000, clientY: 1000, pointerId: 1 })
    await stage.trigger('pointermove', { clientX: 675, clientY: 587.5 })
    await stage.trigger('pointerup')
    await wrapper.get('[aria-label="Resize overlay"]').trigger('pointerdown', { clientX: 175, clientY: 87.5, pointerId: 1 })
    await stage.trigger('pointermove', { clientX: 350, clientY: 175 })
    await stage.trigger('pointerup')
    draw()
    expect(ctx.roundRect).toHaveBeenLastCalledWith(0, 0, 350, 175, 12)
  })
  it('removes overlays and clears them when the base changes', async () => {
    await upload()
    await wrapper.findAll('button').find(b => b.text() === 'Remove image')!.trigger('click')
    expect(wrapper.text()).not.toContain('two.png')
    await wrapper.setProps({ src: 'other.png' })
    expect(await (wrapper.vm as any).exportPng()).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})
