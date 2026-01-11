/**
 * 从 GitHub 获取模板列表（公开访问，无需认证）
 * GET /api/templates
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  try {
    // 直接从 GitHub raw content 读取（公开文件，无需认证）
    const url = `https://raw.githubusercontent.com/${config.public.repoOwner}/${config.public.repoName}/main/templates/index.json`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    // data 已经是 JSON 对象（数组）
    return {
      success: true,
      data: {
        categories: data // templates/index.json 是分类数组
      }
    }
  } catch (error: any) {
    console.error('Failed to fetch templates:', error)

    return {
      success: false,
      error: error.message,
      // 返回空数据作为降级
      data: []
    }
  }
})
