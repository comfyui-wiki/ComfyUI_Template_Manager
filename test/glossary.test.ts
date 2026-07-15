import { describe, expect, it } from 'vitest'
import {
  buildGlossaryPrompt,
  selectGlossaryForText
} from '../server/utils/glossary'
import { findGlossaryMismatches } from '../lib/glossary-check'

describe('glossary term selection', () => {
  const glossary = new Map<string, string>([
    ['node', '节点'],
    ['custom node', '自定义节点'],
    ['text-to-image', '文生图'],
    ['text to image', '文生图'],
    ['workflow', '工作流']
  ])

  it('prefers longer phrase matches and drops nested shorts', () => {
    const hits = selectGlossaryForText(
      'Add a custom node to this text-to-image workflow',
      glossary
    )
    const ens = hits.map(h => h.en)
    expect(ens).toContain('custom node')
    expect(ens).toContain('text-to-image')
    expect(ens).toContain('workflow')
    // "node" is covered by "custom node" → suppressed
    expect(ens).not.toContain('node')
    // longest first
    expect(hits[0].en.length).toBeGreaterThanOrEqual(hits[1]?.en.length ?? 0)
  })

  it('keeps a short term when it also appears outside a longer match', () => {
    const hits = selectGlossaryForText(
      'Use a custom node, then another node',
      glossary
    )
    const ens = hits.map(h => h.en)
    expect(ens).toContain('custom node')
    expect(ens).toContain('node')
  })

  it('uses whole-word matching', () => {
    const hits = selectGlossaryForText('nodeset configuration', glossary)
    expect(hits.find(h => h.en === 'node')).toBeUndefined()
  })

  it('builds an advisory prompt block', () => {
    const block = buildGlossaryPrompt(
      [{ en: 'custom node', t: '自定义节点' }],
      'Simplified Chinese'
    )
    expect(block).toContain('Preferred Simplified Chinese terminology')
    expect(block).toContain('custom node → 自定义节点')
    expect(block).toContain('preferred, not mandatory')
  })
})

describe('glossary mismatch detection', () => {
  const glossary = {
    'custom node': '自定义节点',
    node: '节点',
    workflow: '工作流',
    comfyui: 'ComfyUI'
  }

  it('flags when preferred term is missing from translation', () => {
    const mismatches = findGlossaryMismatches(
      'Run this workflow with a custom node',
      '用自定义节点跑这个流水线',
      glossary
    )
    // "node" nested under "custom node" is suppressed → only workflow mismatch
    expect(mismatches).toEqual([{ en: 'workflow', preferred: '工作流' }])
  })

  it('skips brand-style preferred === english', () => {
    const mismatches = findGlossaryMismatches(
      'Open ComfyUI settings',
      '打开 ComfyUI 设置',
      glossary
    )
    expect(mismatches).toEqual([])
  })

  it('skips empty translations', () => {
    expect(findGlossaryMismatches('workflow', '', glossary)).toEqual([])
  })
})
