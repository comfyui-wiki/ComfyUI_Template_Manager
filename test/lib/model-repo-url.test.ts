import { describe, expect, it } from 'vitest'
import { isHttpUrl, repoLinkLabel, repoUrlFromDownloadUrl, uniqueRepoMarkdownLinks } from '../../lib/model-repo-url'

describe('model repo url', () => {
  it('strips Hugging Face resolve/blob paths down to the repo page', () => {
    expect(
      repoUrlFromDownloadUrl(
        'https://huggingface.co/Comfy-Org/Wan-Animate-2/resolve/main/vae/Wan2_1_VAE_bf16.safetensors'
      )
    ).toBe('https://huggingface.co/Comfy-Org/Wan-Animate-2')
    expect(
      repoUrlFromDownloadUrl(
        'https://huggingface.co/bfl/FLUX.1/blob/main/flux1-canny-dev.safetensors?download=true'
      )
    ).toBe('https://huggingface.co/bfl/FLUX.1')
  })

  it('keeps ModelScope and GitHub hosts as repository pages', () => {
    expect(
      repoUrlFromDownloadUrl(
        'https://www.modelscope.cn/models/Comfy-Org/Wan-Animate-2/resolve/master/file.safetensors'
      )
    ).toBe('https://www.modelscope.cn/models/Comfy-Org/Wan-Animate-2')
    expect(
      repoUrlFromDownloadUrl(
        'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
      )
    ).toBe('https://github.com/xinntao/Real-ESRGAN')
  })

  it('labels known hosts for markdown notes', () => {
    expect(repoLinkLabel('https://huggingface.co/Comfy-Org/MoGe')).toBe('Hugging Face:Comfy-Org/MoGe')
    expect(isHttpUrl('https://huggingface.co/Comfy-Org/MoGe')).toBe(true)
    expect(isHttpUrl('not a url')).toBe(false)
  })

  it('lists unique repo pages once for the generated note', () => {
    expect(
      uniqueRepoMarkdownLinks([
        'https://huggingface.co/Comfy-Org/MoGe/resolve/main/geometry_estimation/moge_3_vitg_fp16.safetensors',
        'https://huggingface.co/Comfy-Org/MoGe/resolve/main/geometry_estimation/moge_3_vitl_fp16.safetensors',
        'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors'
      ])
    ).toEqual([
      '[Hugging Face:Comfy-Org/MoGe](https://huggingface.co/Comfy-Org/MoGe)',
      '[Hugging Face:Comfy-Org/Wan_2.2_ComfyUI_Repackaged](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged)'
    ])
  })
})
