import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractWorkflowSummary } from '../../lib/workflow-summary'

const SAMPLE_PATH = resolve(
  '/Users/linmoumou/Downloads/utility_depth_anything3_image_depth_estimation.json'
)

describe('extractWorkflowSummary', () => {
  it('builds unified context with IO counts, parameters, and purpose', () => {
    const json = readFileSync(SAMPLE_PATH, 'utf-8')
    const summary = extractWorkflowSummary(json)

    expect(summary).not.toBeNull()
    expect(summary!.estimatedTokens).toBeLessThan(900)

    const { text, structured } = summary!

    // Overview
    expect(text).toContain('Workflow Overview')
    expect(text).toContain('Purpose:')
    expect(structured.purpose).toContain('Depth')
    expect(text).toContain('1 input image')
    expect(structured.io.inputImages).toBe(1)
    expect(structured.io.outputImages).toBe(1)
    expect(structured.io.outputComparisons).toBe(1)

    // Parameters
    expect(text).toContain('Key Parameters')
    expect(text).toContain('resolution=504')
    expect(text).toContain('output=depth')

    // Use cases
    expect(text).toContain('Use Cases')
    expect(text).toContain('Suitable for:')
    expect(structured.useCases.length).toBeGreaterThan(0)
    expect(structured.useCases.some(uc => /3D|VFX|AR/i.test(uc))).toBe(true)

    expect(structured.parameters.some(p => p.node.includes('DA3'))).toBe(true)

    // Annotations & flow
    expect(text).toContain('View 1')
    expect(text).toContain('DA3-SMALL')
    expect(text).toContain('Main Flow')
    expect(structured.techniques).toContain('Depth estimation')
  })

  it('returns null for invalid JSON', () => {
    expect(extractWorkflowSummary('not json')).toBeNull()
    expect(extractWorkflowSummary('')).toBeNull()
  })
})
