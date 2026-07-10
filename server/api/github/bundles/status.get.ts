/**
 * Bundle status for template assignment UI
 * GET /api/github/bundles/status?repo=owner/name&branch=main&templateName=optional
 */
import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import bundleMappingRules from '~/config/bundle-mapping-rules.json'
import { isLocalRepoMode, readRepoJson } from '~/server/utils/local-repo'
import {
  findTemplateBundle,
  formatBytes,
  getBundleLabel,
  getBundlePypiPackage,
  getBundleSizeLimitBytes,
  getFrozenBundleReason,
  getKnownBundleIds,
  getRecommendedAssetBundle,
  fetchPyPIWheelSizeBytes,
  isFrozenBundle,
  resolveTargetBundle
} from '~/server/utils/bundles'

async function readBundlesData(event: any, repo: string, branch: string): Promise<Record<string, string[]>> {
  if (isLocalRepoMode()) {
    try {
      return await readRepoJson<Record<string, string[]>>('bundles.json')
    } catch {
      return {}
    }
  }

  const session = await getServerSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized - Please sign in' })
  }

  const [owner, repoName] = repo.split('/')
  const octokit = new Octokit({ auth: session.accessToken })

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: 'bundles.json',
      ref: branch
    })
    if ('content' in data && data.content) {
      return JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'))
    }
  } catch (error: any) {
    if (error.status !== 404) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Failed to read bundles.json'
      })
    }
  }

  return {}
}

export default defineEventHandler(async (event) => {
  const localMode = isLocalRepoMode()

  if (!localMode) {
    const session = await getServerSession(event)
    if (!session?.accessToken) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized - Please sign in' })
    }
  }

  const query = getQuery(event)
  const repo = query.repo as string
  const branch = query.branch as string
  const templateName = query.templateName as string | undefined
  const category = query.category as string | undefined

  if (!repo || !branch) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters: repo, branch'
    })
  }

  const sizeLimitBytes = getBundleSizeLimitBytes()
  const bundlesData = await readBundlesData(event, repo, branch)
  const currentBundle = templateName ? findTemplateBundle(bundlesData, templateName) : null
  const suggestedBundle = category
    ? resolveTargetBundle(category, null, { currentBundle })
    : getRecommendedAssetBundle()

  const bundleIds = getKnownBundleIds()
  const bundles = await Promise.all(
    bundleIds.map(async (bundleId) => {
      const templates = Array.isArray(bundlesData[bundleId]) ? bundlesData[bundleId] : []
      const frozen = isFrozenBundle(bundleId)
      const pypiPackage = getBundlePypiPackage(bundleId)
      const publishedSizeBytes = pypiPackage ? await fetchPyPIWheelSizeBytes(pypiPackage) : null
      const usagePercent = publishedSizeBytes != null
        ? Math.round((publishedSizeBytes / sizeLimitBytes) * 100)
        : null
      const containsCurrentTemplate = templateName ? templates.includes(templateName) : false
      const selectable = !frozen || containsCurrentTemplate

      return {
        id: bundleId,
        label: getBundleLabel(bundleId),
        pypiPackage,
        templateCount: templates.length,
        publishedSizeBytes,
        publishedSizeLabel: formatBytes(publishedSizeBytes),
        sizeLimitBytes,
        sizeLimitLabel: formatBytes(sizeLimitBytes),
        usagePercent,
        isNearLimit: usagePercent != null && usagePercent >= 90,
        isOverLimit: usagePercent != null && usagePercent >= 100,
        containsCurrentTemplate,
        frozen,
        frozenReason: frozen ? getFrozenBundleReason(bundleId) : null,
        selectable
      }
    })
  )

  const visibleBundles = bundles.filter(bundle => bundle.selectable)

  return {
    success: true,
    sizeLimitBytes,
    sizeLimitLabel: formatBytes(sizeLimitBytes),
    currentBundle,
    suggestedBundle,
    recommendedAssetBundle: getRecommendedAssetBundle(),
    bundles: visibleBundles,
    legacyCurrentBundle: currentBundle && isFrozenBundle(currentBundle)
      ? bundles.find(b => b.id === currentBundle) || null
      : null
  }
})
