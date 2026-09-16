import { describe, expect, it } from 'vitest'
import { analyzeWorkflowModelLinks, normalizeWhitelist } from '../../lib/model-link-scan/analyze'

const SG_ID = '11111111-1111-1111-1111-111111111111'
const whitelist = normalizeWhitelist()

function staleSubgraphWorkflow() {
  return {
    nodes: [
      {
        id: 12,
        type: SG_ID,
        widgets_values: ['used_on_instance.safetensors'],
        properties: {}
      }
    ],
    definitions: {
      subgraphs: [
        {
          id: SG_ID,
          inputs: [
            {
              name: 'unet_name',
              type: 'COMBO',
              linkIds: [53]
            }
          ],
          nodes: [
            {
              id: 1,
              type: 'UNETLoader',
              inputs: [
                { name: 'unet_name', type: 'COMBO', link: 53 }
              ],
              properties: {
                models: [
                  {
                    name: 'leftover_old.safetensors',
                    url: 'https://example.com/leftover_old.safetensors',
                    directory: 'diffusion_models'
                  }
                ]
              },
              widgets_values: ['leftover_old.safetensors']
            }
          ]
        }
      ]
    }
  }
}

function matchedSubgraphWorkflow() {
  const data = staleSubgraphWorkflow()
  const inner = data.definitions.subgraphs[0].nodes[0]
  inner.widgets_values = ['used_on_instance.safetensors']
  inner.properties.models[0] = {
    name: 'used_on_instance.safetensors',
    url: 'https://example.com/used_on_instance.safetensors',
    directory: 'diffusion_models'
  }
  return data
}

describe('model-link-scan', () => {
  it('fails when instance model and inner definition disagree', () => {
    const result = analyzeWorkflowModelLinks('stale', staleSubgraphWorkflow(), whitelist)
    expect(result.status).toBe('error')
    expect(result.issues.some(issue =>
      issue.kind === 'subgraph_missing_urls'
      && issue.models?.[0] === 'used_on_instance.safetensors'
    )).toBe(true)
    expect(result.issues.some(issue =>
      issue.kind === 'subgraph_stale_definition'
      && issue.models?.[0] === 'used_on_instance.safetensors'
    )).toBe(true)
  })

  it('passes when inner loader documents the instance model', () => {
    const result = analyzeWorkflowModelLinks('ok', matchedSubgraphWorkflow(), whitelist)
    expect(result.status).toBe('ok')
    expect(result.issues).toHaveLength(0)
  })

  it('lets an instance-owned URL cover a multi-instance override', () => {
    const data = staleSubgraphWorkflow()
    data.nodes[0].properties = {
      models: [
        {
          name: 'used_on_instance.safetensors',
          url: 'https://example.com/used_on_instance.safetensors',
          directory: 'diffusion_models'
        }
      ]
    }
    const result = analyzeWorkflowModelLinks('multi', data, whitelist)
    expect(result.issues.filter(issue =>
      issue.kind === 'subgraph_missing_urls' || issue.kind === 'subgraph_stale_definition'
    )).toHaveLength(0)
  })

  it('skips ignored inner loaders such as SeedVR2', () => {
    const data = staleSubgraphWorkflow()
    data.definitions.subgraphs[0].nodes[0].type = 'SeedVR2LoadDiTModel'
    const result = analyzeWorkflowModelLinks('seedvr2', data, whitelist)
    expect(result.issues.filter(issue =>
      issue.kind === 'subgraph_missing_urls' || issue.kind === 'subgraph_stale_definition'
    )).toHaveLength(0)
  })

  it('flags top-level loaders missing properties.models', () => {
    const result = analyzeWorkflowModelLinks('missing', {
      nodes: [{
        id: 3,
        type: 'UNETLoader',
        widgets_values: ['model.safetensors'],
        properties: {}
      }]
    }, whitelist)
    expect(result.issues.some(issue => issue.kind === 'missing_properties')).toBe(true)
  })

  it('flags same-node widget and properties.models mismatch', () => {
    const result = analyzeWorkflowModelLinks('mismatch', {
      nodes: [{
        id: 3,
        type: 'UNETLoader',
        widgets_values: ['new.safetensors'],
        properties: {
          models: [{
            name: 'old.safetensors',
            url: 'https://example.com/old.safetensors'
          }]
        }
      }]
    }, whitelist)
    expect(result.issues.some(issue => issue.kind === 'widget_property_mismatch')).toBe(true)
  })
})
