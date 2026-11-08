import { describe, expect, it } from 'vitest'
import { smartTemplateOrder } from './smart-template-order'

const options = { familyGapPercent: 25, openSourceGapPercent: 10 }

describe('smartTemplateOrder', () => {
  it('keeps the highest usage first and groups a close model ahead of an unrelated one', () => {
    const templates = [
      { name: 'other', usage: 90, models: ['Other'] },
      { name: 'family', usage: 80, models: ['Wan'] },
      { name: 'top', usage: 100, models: ['Wan'] }
    ]
    expect(smartTemplateOrder(templates, options).map(t => t.name)).toEqual(['top', 'family', 'other'])
  })

  it('splits a model when usage is too far apart', () => {
    const templates = [
      { name: 'low-family', usage: 40, models: ['Wan'] },
      { name: 'other', usage: 80, models: ['Other'] },
      { name: 'top', usage: 100, models: ['Wan'] }
    ]
    expect(smartTemplateOrder(templates, options).map(t => t.name)).toEqual(['top', 'other', 'low-family'])
  })

  it('prefers open source when usage is close, including with model grouping disabled', () => {
    const templates = [
      { name: 'open', usage: 82, openSource: true },
      { name: 'closed', usage: 85, openSource: false },
      { name: 'top', usage: 100, openSource: false }
    ]
    expect(smartTemplateOrder(templates, { familyGapPercent: 0, openSourceGapPercent: 10 }).map(t => t.name))
      .toEqual(['top', 'open', 'closed'])
  })

  it('can group model versions in broad family mode', () => {
    const templates = [
      { name: 'wan22', usage: 80, models: ['Wan2.2'] },
      { name: 'other', usage: 90, models: ['Flux.1'] },
      { name: 'wan21', usage: 100, models: ['Wan2.1'] }
    ]
    expect(smartTemplateOrder(templates, { ...options, modelMatch: 'family' }).map(t => t.name))
      .toEqual(['wan21', 'wan22', 'other'])
    expect(smartTemplateOrder(templates, { ...options, modelMatch: 'exact' }).map(t => t.name))
      .toEqual(['wan21', 'other', 'wan22'])
  })
})
