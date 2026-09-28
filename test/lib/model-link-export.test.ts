import { describe, expect, it } from 'vitest'
import { exportModelLinks, formatModelLinksJson } from '../../lib/model-link-export'

describe('model link export', () => {
  it('builds the Add models list and drops duplicate urls', () => {
    const models = exportModelLinks({
      nodes: [
        {
          properties: {
            models: [
              {
                name: 'qwen_image_edit_2509_int8_convrot.safetensors',
                url: 'https://huggingface.co/Comfy-Org/marigold-v2-0/resolve/main/diffusion_models/qwen_image_edit_2509_int8_convrot.safetensors',
                directory: 'diffusion_models'
              },
              {
                name: 'same.safetensors',
                url: 'https://huggingface.co/Comfy-Org/marigold-v2-0/resolve/main/diffusion_models/qwen_image_edit_2509_int8_convrot.safetensors',
                directory: 'loras'
              }
            ]
          }
        }
      ],
      definitions: {
        subgraphs: [
          {
            nodes: [
              {
                properties: {
                  models: [
                    {
                      name: 'marigold_v2_depth_log_stage2.safetensors',
                      url: 'https://huggingface.co/Comfy-Org/marigold-v2-0/resolve/main/loras/marigold_v2_depth_log_stage2.safetensors',
                      directory: 'loras'
                    },
                    { name: 'missing-url.safetensors', directory: 'vae' }
                  ]
                }
              }
            ]
          }
        ]
      }
    })

    expect(models).toEqual([
      {
        model_name: 'qwen_image_edit_2509_int8_convrot.safetensors',
        url: 'https://huggingface.co/Comfy-Org/marigold-v2-0/resolve/main/diffusion_models/qwen_image_edit_2509_int8_convrot.safetensors',
        directory: 'diffusion_models'
      },
      {
        model_name: 'marigold_v2_depth_log_stage2.safetensors',
        url: 'https://huggingface.co/Comfy-Org/marigold-v2-0/resolve/main/loras/marigold_v2_depth_log_stage2.safetensors',
        directory: 'loras'
      }
    ])
    expect(JSON.parse(formatModelLinksJson(models))).toEqual({ models })
  })

  it('uses the url filename when the model name is blank', () => {
    expect(exportModelLinks({
      nodes: [{
        properties: {
          models: [{
            url: 'https://civitai.com/api/download/models/123?type=Model&format=SafeTensor',
            directory: 'checkpoints'
          }]
        }
      }]
    })).toEqual([{
      model_name: '123',
      url: 'https://civitai.com/api/download/models/123?type=Model&format=SafeTensor',
      directory: 'checkpoints'
    }])
  })
})
