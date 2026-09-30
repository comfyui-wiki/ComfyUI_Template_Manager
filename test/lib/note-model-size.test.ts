import { describe, expect, it } from 'vitest'
import {
  applyModelSizeLabels,
  fileSizeFromHeaderDump,
  findMissingModelSizes,
  findNoteSizeGaps,
} from '../../lib/note-model-size'

const modelUrl = 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/vae/qwen_image_2.1_vae_bf16.safetensors'
const repoUrl = 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1'

describe('note model sizes', () => {
  it('finds model download links that have no file size and ignores repo pages', () => {
    const note = [
      '## Model Links',
      '',
      `- [Hugging Face:Comfy-Org/Qwen-Image-2.1](${repoUrl})`,
      '',
      `- [qwen_image_2.1_vae_bf16.safetensors](${modelUrl})`,
      `- [already.safetensors](${modelUrl.replace('vae', 'done')}) (242.1 MB)`,
    ].join('\n')

    expect(findMissingModelSizes(note)).toEqual([
      { label: 'qwen_image_2.1_vae_bf16.safetensors', url: modelUrl }
    ])
  })

  it('writes the size after the matching link only', () => {
    const note = `- [vae.safetensors](${modelUrl})\n- [Hugging Face:Comfy-Org/Qwen-Image-2.1](${repoUrl})`
    const labels = { [modelUrl]: '242.1 MB' }
    expect(applyModelSizeLabels(note, labels)).toEqual({
      text: `- [vae.safetensors](${modelUrl}) (242.1 MB)\n- [Hugging Face:Comfy-Org/Qwen-Image-2.1](${repoUrl})`,
      applied: 1
    })
    expect(applyModelSizeLabels(applyModelSizeLabels(note, labels).text, labels).applied).toBe(0)
  })

  it('reports the MarkdownNote that is missing sizes', () => {
    const gaps = findNoteSizeGaps({
      nodes: [
        {
          id: 82,
          type: 'MarkdownNote',
          widgets_values: [`- [vae.safetensors](${modelUrl})`],
          widgets_values_named: { text: `- [vae.safetensors](${modelUrl})` }
        },
        {
          id: 9,
          type: 'CLIPTextEncode',
          widgets_values: [`- [vae.safetensors](${modelUrl})`]
        }
      ]
    })
    expect(gaps).toEqual([
      { nodeId: '82', missing: [{ label: 'vae.safetensors', url: modelUrl }] }
    ])
  })

  it('reads the linked file size instead of the redirect body', () => {
    const dump = [
      'HTTP/2 302',
      'content-type: text/plain; charset=utf-8',
      'content-length: 1102',
      'x-linked-size: 856505640',
      '',
      'HTTP/2 200',
      'content-type: application/octet-stream',
      'content-length: 856505640',
    ].join('\n')
    expect(fileSizeFromHeaderDump(dump)).toBe(856505640)
  })
})
