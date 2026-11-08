import { describe, it, expect } from 'vitest'
import {
  diffWorkflowAssetShas,
  getWorkflowAssetShas,
  templateNamesFromChangedFiles,
  type TemplateManifest
} from '~/lib/template-content-diff'

const manifest = (templates: TemplateManifest['templates']): TemplateManifest => ({ templates })

describe('templateNamesFromChangedFiles', () => {
  it('extracts template names from templates/*.json paths', () => {
    expect(templateNamesFromChangedFiles([
      'templates/api_nano_banana_2_1_t2i.json',
      'templates/image_z_image_turbo.json'
    ])).toEqual(['api_nano_banana_2_1_t2i', 'image_z_image_turbo'])
  })

  it('ignores index.json, non-json assets and paths outside templates/', () => {
    expect(templateNamesFromChangedFiles([
      'templates/index.json',
      'templates/index.mcp.json',
      'templates/api_x-1.webp',
      'packages/core/src/comfyui_workflow_templates_core/manifest.json',
      'templates/nested/thing.json',
      '',
      '  '
    ])).toEqual([])
  })

  it('dedupes and normalizes leading ./', () => {
    expect(templateNamesFromChangedFiles([
      './templates/a.json',
      'templates/a.json',
      'templates/b.json'
    ])).toEqual(['a', 'b'])
  })
})

describe('getWorkflowAssetShas', () => {
  it('maps id -> sha256 of the matching .json asset', () => {
    const shas = getWorkflowAssetShas(manifest([
      {
        id: 'a',
        assets: [
          { filename: 'a.json', sha256: 'sha-a' },
          { filename: 'a-1.webp', sha256: 'sha-webp' }
        ]
      }
    ]))
    expect(shas.get('a')).toBe('sha-a')
  })

  it('skips templates without a workflow json asset and survives missing fields', () => {
    const shas = getWorkflowAssetShas(manifest([
      { id: 'no-assets' },
      { id: 'webp-only', assets: [{ filename: 'x.webp', sha256: 'y' }] },
      { assets: [{ filename: 'unnamed.json', sha256: 'sha-unnamed' }] }
    ]))
    expect(shas.has('no-assets')).toBe(false)
    expect(shas.has('webp-only')).toBe(false)
    expect(shas.get('unnamed')).toBe('sha-unnamed')
  })

  it('tolerates null/undefined manifests', () => {
    expect(getWorkflowAssetShas(null).size).toBe(0)
    expect(getWorkflowAssetShas(undefined).size).toBe(0)
    expect(getWorkflowAssetShas({}).size).toBe(0)
  })
})

describe('diffWorkflowAssetShas', () => {
  const base = manifest([
    { id: 'unchanged', assets: [{ filename: 'unchanged.json', sha256: 's1' }] },
    { id: 'body-edit', assets: [{ filename: 'body-edit.json', sha256: 's2' }] },
    { id: 'thumb-only', assets: [
      { filename: 'thumb-only.json', sha256: 's3' },
      { filename: 'thumb-only-1.webp', sha256: 'w-old' }
    ] }
  ])

  const current = manifest([
    { id: 'unchanged', assets: [{ filename: 'unchanged.json', sha256: 's1' }] },
    { id: 'body-edit', assets: [{ filename: 'body-edit.json', sha256: 's2-changed' }] },
    { id: 'thumb-only', assets: [
      { filename: 'thumb-only.json', sha256: 's3' },
      { filename: 'thumb-only-1.webp', sha256: 'w-new' }
    ] },
    { id: 'brand-new', assets: [{ filename: 'brand-new.json', sha256: 's4' }] }
  ])

  it('detects workflow json sha changes only', () => {
    expect(diffWorkflowAssetShas(current, base)).toEqual(['body-edit'])
  })

  it('returns nothing for identical manifests', () => {
    expect(diffWorkflowAssetShas(base, base)).toEqual([])
  })

  it('skips templates absent from either manifest (unreferenced files)', () => {
    const withUnreferenced = manifest([
      { id: 'unchanged', assets: [{ filename: 'unchanged.json', sha256: 's1' }] },
      { id: 'not-in-base', assets: [{ filename: 'not-in-base.json', sha256: 'x' }] }
    ])
    expect(diffWorkflowAssetShas(withUnreferenced, base)).toEqual([])
  })
})
