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

  const forceApi = useApi === 'true'
  const isUpstreamRepo = owner === 'Comfy-Org' && repo === 'workflow_templates'
  // Fork branches: prefer GitHub API when authenticated (raw CDN often times out)
  const preferApi = forceApi || (!isUpstreamRepo && Boolean(session?.accessToken))

  const fetchViaApi = async () => {
    console.log(`[templates API] 🔄 Using GitHub API: ${owner}/${repo}/${branch}`)
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/templates/index.json?ref=${branch}`
    const response = await fetch(apiUrl, { headers })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const apiData = await response.json()
    const content = Buffer.from(apiData.content, 'base64').toString('utf-8')
    const data = JSON.parse(content)
    console.log(`[templates API] ✅ Data fetched via API (SHA: ${apiData.sha.substring(0, 7)})`)
    return { data, method: 'api' as const }
  }

  const fetchViaCdn = async () => {
    console.log(`[templates API] ⚡ Using raw CDN: ${owner}/${repo}/${branch}`)
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/templates/index.json`
    const response = await fetch(rawUrl, { headers })

    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.status}`)
    }

    const data = await response.json()
    console.log('[templates API] ✅ Data fetched via CDN')
    return { data, method: 'cdn' as const }
  }

  try {
    let result: { data: any; method: 'api' | 'cdn' }

    if (preferApi) {
      result = await fetchViaApi()
    } else {
      try {
        result = await fetchViaCdn()
      } catch (cdnError) {
        if (session?.accessToken) {
          console.warn('[templates API] CDN failed, falling back to GitHub API:', cdnError)
          result = await fetchViaApi()
        } else {
          throw cdnError
        }
      }
    }

    return {
      success: true,
      categories: result.data,
      source: {
        owner,
        repo,
        branch,
        method: result.method
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
