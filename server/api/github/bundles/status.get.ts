/**
 * Bundle status for template assignment UI
 * GET /api/github/bundles/status?repo=owner/name&branch=main&templateName=optional
 */
import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import bundleMappingRules from '~/config/bundle-mapping-rules.json'
import {
  findTemplateBundle,
  formatBytes,
  getBundleLabel,
  getBundlePypiPackage,
  getBundleSizeLimitBytes,
  getKnownBundleIds,
  fetchPyPIWheelSizeBytes,
  resolveTargetBundle
} from '~/server/utils/bundles'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized - Please sign in' })
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

  const [owner, repoName] = repo.split('/')
  const octokit = new Octokit({ auth: session.accessToken })
  const sizeLimitBytes = getBundleSizeLimitBytes()

  let bundlesData: Record<string, string[]> = {}
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: 'bundles.json',
      ref: branch
    })
    if ('content' in data && data.content) {
      bundlesData = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'))
    }
  } catch (error: any) {
    if (error.status !== 404) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Failed to read bundles.json'
      })
    }
  }

  const bundleIds = getKnownBundleIds()
  const currentBundle = templateName ? findTemplateBundle(bundlesData, templateName) : null
  const suggestedBundle = category ? resolveTargetBundle(category) : bundleMappingRules.defaultBundle

  const bundles = await Promise.all(
    bundleIds.map(async (bundleId) => {
      const templates = Array.isArray(bundlesData[bundleId]) ? bundlesData[bundleId] : []
      const pypiPackage = getBundlePypiPackage(bundleId)
      const publishedSizeBytes = pypiPackage ? await fetchPyPIWheelSizeBytes(pypiPackage) : null
      const usagePercent = publishedSizeBytes != null
        ? Math.round((publishedSizeBytes / sizeLimitBytes) * 100)
        : null

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
        containsCurrentTemplate: templateName ? templates.includes(templateName) : false
      }
    })
  )

  return {
    success: true,
    sizeLimitBytes,
    sizeLimitLabel: formatBytes(sizeLimitBytes),
    currentBundle,
    suggestedBundle,
    bundles
  }
})
