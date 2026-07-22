import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSpecsFromObjectInfo } from '../../lib/node-compat/registry'
import { scanWorkflowJson, summarizeTemplateCompat } from '../../lib/node-compat/workflow'

const DEPTH_FIXTURE = resolve(__dirname, '../fixtures/depth-anything3-workflow.json')

describe('node-compat', () => {
  it('does not flag missing nodes when only checking deprecated', () => {
    const json = readFileSync(DEPTH_FIXTURE, 'utf-8')
    const data = JSON.parse(json)
    const issues = scanWorkflowJson('depth-anything3', data, new Map())
    const summary = summarizeTemplateCompat(issues)
    expect(summary.status).toBe('ok')
    expect(issues).toHaveLength(0)
  })

  it('detects deprecated nodes from object_info', () => {
    const specs = buildSpecsFromObjectInfo({
      KSampler: {
        display_name: 'KSampler (DEPRECATED)',
        deprecated: true,
        input: { required: {}, optional: {} },
        input_order: { required: [], optional: [], hidden: [] }
      }
    })

    const issues = scanWorkflowJson('test', {
      nodes: [{
        id: 1,
        type: 'KSampler',
        inputs: [],
        widgets_values: []
      }]
    }, specs)

    expect(issues).toHaveLength(1)
    expect(issues[0]?.kind).toBe('deprecated_node')
    expect(issues[0]?.severity).toBe('warning')
  })

  it('ignores widget and combo mismatches', () => {
    const json = readFileSync(
      '/Users/linmoumou/Documents/comfy/workflow_templates/templates/api_openai_gpt_image_2_image_edit.json',
      'utf-8'
    )
    const specs = buildSpecsFromObjectInfo({
      OpenAIGPTImageNodeV2: {
        display_name: 'OpenAI GPT Image 2',
        api_node: true,
        input: {
          required: {
            prompt: ['STRING', { multiline: true }],
            model: ['COMFY_DYNAMICCOMBO_V3', { options: [{ key: 'gpt-image-2', inputs: { required: { size: [['auto', '1024x1024'], {}], custom_width: ['INT', {}], custom_height: ['INT', {}], background: [['auto', 'transparent'], {}], quality: [['low', 'medium'], {}], images: ['COMFY_AUTOGROW_V3', {}], mask: ['MASK', {}] } } }] }],
            n: ['INT', { default: 1 }],
            seed: ['INT', { default: 0, control_after_generate: true }]
          },
          optional: {}
        },
        input_order: {
          required: ['prompt', 'model', 'n', 'seed'],
          optional: [],
          hidden: ['auth_token_comfy_org']
        }
      },
      LoadImage: { display_name: 'Load Image', input: { required: {}, optional: {} }, input_order: { required: [], optional: [], hidden: [] } },
      SaveImage: { display_name: 'Save Image', input: { required: {}, optional: {} }, input_order: { required: [], optional: [], hidden: [] } }
    })
    const issues = scanWorkflowJson('api_openai_gpt_image_2_image_edit', JSON.parse(json), specs)
    expect(issues).toHaveLength(0)
  })
})
