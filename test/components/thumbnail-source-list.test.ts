import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import List from '../../components/ThumbnailSourceList.vue'
describe('source asset list', () => {
  it('lists every asset and supports remove, reorder, replace and append', async () => {
    const files = [new File(['a'], 'first.png', { type: 'image/png' }), new File(['b'], 'second.mp4', { type: 'video/mp4' })]
    const wrapper = mount(List, { props: { files } })
    expect(wrapper.text()).toContain('first.png')
    expect(wrapper.text()).toContain('second.mp4')
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('video').exists()).toBe(true)
    await wrapper.get('[aria-label="Move source 2 earlier"]').trigger('click')
    expect(wrapper.emitted('move')?.[0]).toEqual([1, -1])
    await wrapper.get('[aria-label="Remove source 1"]').trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual([0])
    const replacement = new File(['c'], 'replacement.png', { type: 'image/png' })
    const input = wrapper.get('[aria-label="Replace source 1"]')
    Object.defineProperty(input.element, 'files', { value: [replacement], configurable: true })
    await input.trigger('change')
    expect(wrapper.emitted('replace')?.[0]).toEqual([0, replacement])
    const add = wrapper.get('[aria-label="Add source files"]')
    Object.defineProperty(add.element, 'files', { value: [replacement], configurable: true })
    await add.trigger('change')
    expect(wrapper.emitted('add')?.[0]).toEqual([[replacement]])
    await wrapper.setProps({ files: [files[1]] })
    expect(wrapper.text()).not.toContain('first.png')
    expect(wrapper.text()).toContain('second.mp4')
    wrapper.unmount()
  })
})
