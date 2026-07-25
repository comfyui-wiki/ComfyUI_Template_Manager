import { describe, expect, it } from 'vitest'
import { parseWorkflowFilename } from '../../lib/workflow-filename'

describe('parseWorkflowFilename', () => {
  it('parses standard workflow filenames', () => {
    expect(parseWorkflowFilename('video_ltx2_i2v_lora.json')).toEqual({
      templateName: 'video_ltx2_i2v_lora',
      repoPath: 'templates/video_ltx2_i2v_lora.json'
    })
  })

  it('parses app workflow filenames', () => {
    expect(parseWorkflowFilename('template_contact_sheet-step_1.app.json')).toEqual({
      templateName: 'template_contact_sheet-step_1.app',
      repoPath: 'templates/template_contact_sheet-step_1.app.app.json'
    })
  })

  it('strips directory prefixes', () => {
    expect(parseWorkflowFilename('/Users/me/Downloads/video_foo.json')?.templateName).toBe('video_foo')
  })
})
