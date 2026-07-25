import { describe, expect, it } from 'vitest'
import { normalizeTemplateSearchQuery, templateMatchesSearch } from '../../lib/template-search'

describe('template-search', () => {
  it('normalizes workflow filenames', () => {
    expect(normalizeTemplateSearchQuery('video_capybara_v0_1_image_to_video.json')).toBe('video_capybara_v0_1_image_to_video')
    expect(normalizeTemplateSearchQuery('templates/video_ltx2_i2v_lora.json')).toBe('video_ltx2_i2v_lora')
  })

  it('matches templates by filename', () => {
    const tpl = {
      name: 'video_capybara_v0_1_image_to_video',
      title: 'Capybara: Image to Video',
      description: 'Upload an image'
    }
    expect(templateMatchesSearch(tpl, 'video_capybara_v0_1_image_to_video')).toBe(true)
    expect(templateMatchesSearch(tpl, 'video_capybara_v0_1_image_to_video.json')).toBe(true)
    expect(templateMatchesSearch(tpl, 'capybara')).toBe(true)
  })
})
