import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractWorkflowSummary } from '../../lib/workflow-summary'

const DEPTH_FIXTURE = resolve(__dirname, '../fixtures/depth-anything3-workflow.json')
const BERNINI_FIXTURE = '/Users/linmoumou/Downloads/video_bernini_r_image_editing.json'

describe('extractWorkflowSummary', () => {
  it('extracts MarkdownNote content for depth workflow', () => {
    const json = readFileSync(DEPTH_FIXTURE, 'utf-8')
    const summary = extractWorkflowSummary(json)!

    expect(summary.structured.notes).toHaveLength(1)
    expect(summary.structured.notes[0].kind).toBe('markdown_note')
    expect(summary.structured.notes[0].title).toBe('About: Depth Anything 3')
    expect(summary.text).toContain('Depth Anything 3')
    expect(summary.text).toContain('DA3-SMALL')
    expect(summary.text).not.toContain('Author notes')
    expect(summary.text.indexOf('Technical Details')).toBeGreaterThan(0)
    expect(summary.structured.purpose).toBe('About: Depth Anything 3')
    expect(summary.structured.io.inputImages).toBe(1)
    expect(summary.structured.mainNodes.some(n => n.label === 'View 1')).toBe(true)
  })

  it('ignores groups and node title hints', () => {
    const json = readFileSync(DEPTH_FIXTURE, 'utf-8')
    const summary = extractWorkflowSummary(json)!

    expect(summary.structured.notes.every(n => n.kind === 'markdown_note')).toBe(true)
    expect(summary.structured.notes.some(n => n.content.includes('Load DA3 Model'))).toBe(false)
  })

  it('extracts MarkdownNote content for Bernini workflow', () => {
    try {
      readFileSync(BERNINI_FIXTURE, 'utf-8')
    } catch {
      return // skip if fixture not on disk
    }

    const json = readFileSync(BERNINI_FIXTURE, 'utf-8')
    const summary = extractWorkflowSummary(json)!

    expect(summary.structured.notes.filter(n => n.kind === 'markdown_note').length).toBeGreaterThan(0)
    expect(summary.text).toContain('Bernini')
    expect(summary.text).toMatch(/Built for|Image Editing/i)
    expect(summary.text).not.toMatch(/this workflow performs lora/i)
    expect(summary.structured.io.inputImages).toBe(2)
  })

  it('returns null for invalid JSON', () => {
    expect(extractWorkflowSummary('not json')).toBeNull()
    expect(extractWorkflowSummary('')).toBeNull()
  })
})
