import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract all unique model URLs from workflow JSON
 */
export function extractModelUrlsFromWorkflow(workflowJson: string): string[] {
  try {
    const workflow = JSON.parse(workflowJson)
    const urlSet = new Set<string>()

    // Collect all nodes (main + subgraph)
    const nodes: any[] = []
    if (workflow.nodes && Array.isArray(workflow.nodes)) {
      nodes.push(...workflow.nodes)
    }
    if (workflow.definitions?.subgraphs) {
      for (const subgraph of workflow.definitions.subgraphs) {
        if (subgraph.nodes && Array.isArray(subgraph.nodes)) {
          nodes.push(...subgraph.nodes)
        }
      }
    }

    // Extract URLs from node properties
    for (const node of nodes) {
      if (!node.properties) continue

      // Check for models array (new format)
      if (node.properties.models && Array.isArray(node.properties.models)) {
        for (const model of node.properties.models) {
          if (model.url && typeof model.url === 'string') {
            urlSet.add(model.url)
          }
        }
      }

      // Check for model_url (legacy format)
      if (node.properties.model_url && typeof node.properties.model_url === 'string') {
        urlSet.add(node.properties.model_url)
      }

      // Check for model_urls array (legacy format)
      if (node.properties.model_urls && Array.isArray(node.properties.model_urls)) {
        for (const url of node.properties.model_urls) {
          if (url && typeof url === 'string') {
            urlSet.add(url)
          }
        }
      }
    }

    // Filter only HuggingFace URLs (we can only fetch size from HF)
    const hfUrls = Array.from(urlSet).filter(url => url.includes('huggingface.co'))
    return hfUrls
  } catch (error) {
    console.error('Failed to extract model URLs:', error)
    return []
  }
}

/**
 * Fetch file size from HuggingFace URL (in bytes)
 */
export async function fetchHuggingFaceFileSize(url: string): Promise<number | null> {
  try {
    // Validate HuggingFace URL
    if (!url.includes('huggingface.co')) {
      return null
    }

    // Use HEAD request to get Content-Length without downloading the file
    const response = await fetch(url, {
      method: 'HEAD',
      // Add no-cache to avoid cached redirects
      cache: 'no-cache'
    })

    if (!response.ok) {
      console.warn(`Failed to fetch size for ${url}: ${response.status}`)
      return null
    }

    const contentLength = response.headers.get('content-length')
    if (!contentLength) {
      console.warn(`No content-length header for ${url}`)
      return null
    }

    return parseInt(contentLength, 10)
  } catch (error) {
    console.error(`Error fetching size for ${url}:`, error)
    return null
  }
}

export interface ModelSizeDetail {
  filename: string
  url: string
  repoUrl: string // Repository URL (e.g., https://huggingface.co/owner/repo)
  sizeBytes: number | null
  sizeGB: number | null
  status: 'success' | 'failed'
}

/**
 * Calculate total model sizes from workflow JSON
 * Returns: { totalBytes, totalGB, successCount, failedUrls, models }
 */
export async function calculateWorkflowModelSizes(workflowJson: string): Promise<{
  totalBytes: number
  totalGB: number
  successCount: number
  failedUrls: string[]
  models: ModelSizeDetail[]
}> {
  const urls = extractModelUrlsFromWorkflow(workflowJson)

  if (urls.length === 0) {
    return {
      totalBytes: 0,
      totalGB: 0,
      successCount: 0,
      failedUrls: [],
      models: []
    }
  }

  console.log(`[Model Size Calculator] Found ${urls.length} unique HuggingFace model URLs`)

  const results = await Promise.all(
    urls.map(async (url) => {
      const size = await fetchHuggingFaceFileSize(url)
      return { url, size }
    })
  )

  let totalBytes = 0
  const failedUrls: string[] = []
  const modelsMap = new Map<string, ModelSizeDetail>() // Use Map to deduplicate by filename

  console.log(`[Model Size Calculator] Processing ${results.length} URLs`)

  for (const result of results) {
    // Extract filename from URL
    const filename = result.url.split('/').pop()?.split('?')[0] || result.url

    console.log(`[Model Size Calculator] Processing: ${filename} from ${result.url}`)

    // Skip if we already have this filename (deduplicate by filename)
    if (modelsMap.has(filename)) {
      console.log(`[Model Size Calculator] ⚠️ Skipping duplicate filename: ${filename}`)
      console.log(`[Model Size Calculator]   Already have: ${modelsMap.get(filename)?.url}`)
      console.log(`[Model Size Calculator]   Skipping URL: ${result.url}`)
      continue
    }

    // Extract repository URL (https://huggingface.co/owner/repo)
    // Example: https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors
    // -> https://huggingface.co/black-forest-labs/FLUX.1-dev
    const urlParts = result.url.split('/')
    const hfIndex = urlParts.findIndex(part => part === 'huggingface.co')
    let repoUrl = result.url
    if (hfIndex >= 0 && urlParts.length > hfIndex + 3) {
      repoUrl = `${urlParts.slice(0, hfIndex + 3).join('/')}`
    }

    if (result.size !== null) {
      totalBytes += result.size
      const sizeGB = Math.round((result.size / (1024 * 1024 * 1024)) * 1000) / 1000 // 3 decimals
      modelsMap.set(filename, {
        filename,
        url: result.url,
        repoUrl,
        sizeBytes: result.size,
        sizeGB,
        status: 'success'
      })
    } else {
      failedUrls.push(filename)
      modelsMap.set(filename, {
        filename,
        url: result.url,
        repoUrl,
        sizeBytes: null,
        sizeGB: null,
        status: 'failed'
      })
    }
  }

  const models = Array.from(modelsMap.values())

  const totalGB = totalBytes / (1024 * 1024 * 1024)

  console.log(`[Model Size Calculator] Deduplication: ${results.length} URLs → ${models.length} unique models`)
  console.log(`[Model Size Calculator] Total: ${totalGB.toFixed(3)} GB (${results.length - failedUrls.length}/${urls.length} successful)`)

  return {
    totalBytes,
    totalGB: Math.round(totalGB * 1000) / 1000, // Keep 3 decimals for display
    successCount: results.length - failedUrls.length,
    failedUrls,
    models
  }
}