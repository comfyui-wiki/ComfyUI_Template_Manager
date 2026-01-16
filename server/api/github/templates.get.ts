/**
 * Fetch templates index.json from a specific repository and branch
 * GET /api/github/templates
 * Query: { owner, repo, branch, useApi }
 *
 * - useApi=false (default): Uses raw.githubusercontent.com (fast, CDN cached)
 * - useApi=true: Uses GitHub API (bypasses CDN, always fresh data)
 */
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const { owner, repo, branch = 'main', useApi = 'false' } = getQuery(event)

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: 'Owner and repo are required'
    })
  }

  // Try to get user session for authenticated requests
  const session = await getServerSession(event)

  const headers: Record<string, string> = {
    'User-Agent': 'ComfyUI-Template-CMS',
    'Accept': 'application/vnd.github.v3+json'
  }

  // Add authorization if user is authenticated
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
  }

  const shouldUseApi = useApi === 'true'

  try {
    let data: any

    if (shouldUseApi) {
      // Use GitHub API - bypasses CDN, always returns fresh data
      console.log(`[templates API] 🔄 Using GitHub API (fresh data): ${owner}/${repo}/${branch}`)
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/templates/index.json?ref=${branch}`

      const response = await fetch(apiUrl, { headers })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const apiData = await response.json()

      // Decode base64 content
      const content = Buffer.from(apiData.content, 'base64').toString('utf-8')
      data = JSON.parse(content)

      console.log(`[templates API] ✅ Fresh data fetched via API (SHA: ${apiData.sha.substring(0, 7)})`)
    } else {
      // Use raw.githubusercontent.com - fast but may be CDN cached
      console.log(`[templates API] ⚡ Using raw CDN (fast): ${owner}/${repo}/${branch}`)
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/templates/index.json`

      const response = await fetch(rawUrl, { headers })

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status}`)
      }

      data = await response.json()
      console.log(`[templates API] ✅ Data fetched via CDN`)
    }

    return {
      success: true,
      categories: data,
      source: {
        owner,
        repo,
        branch,
        method: shouldUseApi ? 'api' : 'cdn'
      }
    }
  } catch (error: any) {
    console.error('[templates API] ❌ Failed to fetch templates:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch templates'
    })
  }
})
