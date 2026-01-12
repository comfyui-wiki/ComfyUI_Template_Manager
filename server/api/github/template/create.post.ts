import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

interface CreateTemplateRequest {
  repo: string
  branch: string
  templateName: string
  metadata: {
    title: string
    description: string
    category: string
    thumbnailVariant?: string
    tags?: string[]
    models?: string[]
    tutorialUrl?: string
    comfyuiVersion?: string
    date?: string
    openSource?: boolean
  }
  templateOrder?: string[]  // Array of template names in desired order
  files: {
    workflow: {
      content: string // base64
    }
    thumbnails?: Array<{
      index: number
      content: string // base64
      filename: string
    }>
    inputFiles?: Array<{
      filename: string
      content: string // base64
    }>
  }
}

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)

    if (!session?.accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Please sign in'
      })
    }

    const body = await readBody<CreateTemplateRequest>(event)
    const { repo, branch, templateName, metadata, templateOrder, files } = body

    if (!repo || !branch || !templateName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      })
    }

    // Validate template name (alphanumeric, dashes, underscores only)
    if (!/^[a-zA-Z0-9_\-]+$/.test(templateName)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Template name must contain only letters, numbers, dashes, and underscores'
      })
    }

    if (!files?.workflow) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Workflow file is required'
      })
    }

    const [owner, repoName] = repo.split('/')
    const octokit = new Octokit({ auth: session.accessToken })

    // Get current commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`
    })
    const currentCommitSha = refData.object.sha

    // Get current tree
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo: repoName,
      commit_sha: currentCommitSha
    })
    const currentTreeSha = commitData.tree.sha

    // Prepare tree items (files to create)
    const tree: any[] = []

    // 1. Load and update index.json with new template
    const { data: indexFile } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: 'templates/index.json',
      ref: branch
    })

    if (!('content' in indexFile)) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Invalid index.json structure'
      })
    }

    const indexContent = Buffer.from(indexFile.content, 'base64').toString('utf-8')
    const indexData = JSON.parse(indexContent) // This is an array

    // Find the target category
    const targetCategoryIndex = indexData.findIndex((cat: any) => cat.title === metadata.category)
    if (targetCategoryIndex === -1) {
      throw createError({
        statusCode: 400,
        statusMessage: `Category "${metadata.category}" not found in index.json`
      })
    }

    // Check if template with this name already exists
    const templateExists = indexData.some((cat: any) =>
      cat.templates?.some((t: any) => t.name === templateName)
    )
    if (templateExists) {
      throw createError({
        statusCode: 409,
        statusMessage: `Template "${templateName}" already exists`
      })
    }

    // Determine mediaSubtype from thumbnails (default to webp)
    let mediaSubtype = 'webp'
    if (files.thumbnails && files.thumbnails.length > 0) {
      const firstFilename = files.thumbnails[0].filename
      const match = firstFilename.match(/\.([a-zA-Z0-9]+)$/)
      if (match) {
        mediaSubtype = match[1]
      }
    }

    // Create new template object
    const newTemplate: any = {
      name: templateName,
      title: metadata.title,
      description: metadata.description,
      mediaType: 'image', // default
      mediaSubtype
    }

    if (metadata.thumbnailVariant && metadata.thumbnailVariant !== 'none') {
      newTemplate.thumbnailVariant = metadata.thumbnailVariant
    }
    if (metadata.tags && metadata.tags.length > 0) {
      newTemplate.tags = metadata.tags
    }
    if (metadata.models && metadata.models.length > 0) {
      newTemplate.models = metadata.models
    }
    if (metadata.tutorialUrl) {
      newTemplate.tutorialUrl = metadata.tutorialUrl
    }
    if (metadata.comfyuiVersion) {
      newTemplate.comfyuiVersion = metadata.comfyuiVersion
    }
    if (metadata.date) {
      newTemplate.date = metadata.date
    }
    if (metadata.openSource !== undefined) {
      newTemplate.openSource = metadata.openSource
    }

    // Add template to category
    indexData[targetCategoryIndex].templates = indexData[targetCategoryIndex].templates || []
    indexData[targetCategoryIndex].templates.push(newTemplate)

    // If templateOrder is provided, reorder the templates array
    if (templateOrder && Array.isArray(templateOrder) && templateOrder.length > 0) {
      console.log('[Create Template] Reordering templates based on provided order:', templateOrder)

      const templates = indexData[targetCategoryIndex].templates
      const orderedTemplates: any[] = []
      const templatesMap = new Map(templates.map((t: any) => [t.name, t]))

      // Add templates in the specified order
      for (const name of templateOrder) {
        if (templatesMap.has(name)) {
          orderedTemplates.push(templatesMap.get(name))
          templatesMap.delete(name)
        }
      }

      // Add any remaining templates that weren't in the order (shouldn't happen in normal flow)
      for (const template of templatesMap.values()) {
        orderedTemplates.push(template)
      }

      indexData[targetCategoryIndex].templates = orderedTemplates
      console.log('[Create Template] Templates reordered successfully')
    }

    // Add updated index.json to tree
    tree.push({
      path: 'templates/index.json',
      mode: '100644' as const,
      type: 'blob' as const,
      content: JSON.stringify(indexData, null, 2)
    })

    // 2. Add workflow.json
    tree.push({
      path: `templates/${templateName}.json`,
      mode: '100644' as const,
      type: 'blob' as const,
      content: Buffer.from(files.workflow.content, 'base64').toString('utf-8')
    })

    // 3. Add thumbnails
    if (files.thumbnails && files.thumbnails.length > 0) {
      for (const thumbnail of files.thumbnails) {
        // Create blob for binary image content
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: thumbnail.content,
          encoding: 'base64'
        })

        tree.push({
          path: `templates/${thumbnail.filename}`,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha
        })
      }
    }

    // 4. Add input files
    if (files.inputFiles && files.inputFiles.length > 0) {
      console.log(`[Create Template] Uploading ${files.inputFiles.length} input file(s)`)
      for (const inputFile of files.inputFiles) {
        // Create blob for input file content
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: inputFile.content,
          encoding: 'base64'
        })

        tree.push({
          path: `input/${inputFile.filename}`,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha
        })

        console.log(`[Create Template] Added input file: ${inputFile.filename}`)
      }
    }

    // Create new tree
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree,
      base_tree: currentTreeSha
    })

    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: `Create template: ${templateName}\n\nCreated via ComfyUI Template Manager`,
      tree: newTree.sha,
      parents: [currentCommitSha]
    })

    // Update branch reference
    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    })

    return {
      success: true,
      message: 'Template created successfully',
      templateName,
      commit: {
        sha: newCommit.sha,
        url: `https://github.com/${owner}/${repoName}/commit/${newCommit.sha}`
      }
    }

  } catch (error: any) {
    console.error('Error creating template:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to create template'
    })
  }
})
