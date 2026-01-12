import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

interface UpdateTemplateRequest {
  repo: string
  branch: string
  templateName: string
  metadata: {
    title?: string
    description?: string
    category?: string
    thumbnailVariant?: string
    tags?: string[]
    models?: string[]
    tutorialUrl?: string
    comfyuiVersion?: string
    date?: string
  }
  templateOrder?: string[]  // Array of template names in new order
  files?: {
    workflow?: {
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
      deleteOldFile?: string  // Old filename to delete if format changed
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

    const body = await readBody<UpdateTemplateRequest>(event)
    const { repo, branch, templateName, metadata, templateOrder, files } = body

    if (!repo || !branch || !templateName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
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

    // Prepare tree items (files to update)
    const tree: any[] = []

    // 1. Update index.json with new metadata
    const { data: indexFile } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: 'templates/index.json',
      ref: branch
    })

    if ('content' in indexFile) {
      const indexContent = Buffer.from(indexFile.content, 'base64').toString('utf-8')
      const indexData = JSON.parse(indexContent) // This is an array

      // Find the template in index.json
      let templateData: any = null
      let oldCategoryIndex = -1
      let oldTemplateIndex = -1

      for (let i = 0; i < indexData.length; i++) {
        const category = indexData[i]
        const templateIndex = category.templates.findIndex((t: any) => t.name === templateName)
        if (templateIndex >= 0) {
          templateData = { ...category.templates[templateIndex] }
          oldCategoryIndex = i
          oldTemplateIndex = templateIndex
          break
        }
      }

      if (!templateData) {
        throw createError({
          statusCode: 404,
          statusMessage: `Template ${templateName} not found in index.json`
        })
      }

      // Track old thumbnail variant to detect if we need to delete unused thumbnails
      const oldThumbnailVariant = templateData.thumbnailVariant || 'none'
      const oldRequiredCount = (oldThumbnailVariant === 'compareSlider' || oldThumbnailVariant === 'hoverDissolve') ? 2 : 1

      // Update template metadata
      if (metadata.title) templateData.title = metadata.title
      if (metadata.description) templateData.description = metadata.description
      if (metadata.thumbnailVariant !== undefined) {
        if (metadata.thumbnailVariant === 'none') {
          delete templateData.thumbnailVariant
        } else {
          templateData.thumbnailVariant = metadata.thumbnailVariant
        }
      }
      if (metadata.tags) templateData.tags = metadata.tags
      if (metadata.models) templateData.models = metadata.models
      if (metadata.tutorialUrl) templateData.tutorialUrl = metadata.tutorialUrl
      if (metadata.comfyuiVersion) templateData.comfyuiVersion = metadata.comfyuiVersion
      if (metadata.date) templateData.date = metadata.date

      // Calculate new required thumbnail count
      const newThumbnailVariant = templateData.thumbnailVariant || 'none'
      const newRequiredCount = (newThumbnailVariant === 'compareSlider' || newThumbnailVariant === 'hoverDissolve') ? 2 : 1

      console.log('[Update Template] Thumbnail variant changed:', {
        oldVariant: oldThumbnailVariant,
        newVariant: newThumbnailVariant,
        oldCount: oldRequiredCount,
        newCount: newRequiredCount
      })

      // Check if category changed (use title as identifier since moduleName is not unique)
      const currentCategoryTitle = indexData[oldCategoryIndex].title
      const categoryChanged = metadata.category && metadata.category !== currentCategoryTitle

      console.log('[Update Template] Category check:', {
        currentCategory: currentCategoryTitle,
        newCategory: metadata.category,
        categoryChanged
      })

      if (categoryChanged) {
        // Find the new category by title
        const newCategoryIndex = indexData.findIndex((cat: any) => cat.title === metadata.category)
        if (newCategoryIndex === -1) {
          throw createError({
            statusCode: 400,
            statusMessage: `Target category "${metadata.category}" not found in index.json`
          })
        }

        console.log('[Update Template] Moving template from', currentCategoryTitle, 'to', metadata.category)

        // Remove template from old category
        indexData[oldCategoryIndex].templates.splice(oldTemplateIndex, 1)

        // Add template to new category
        indexData[newCategoryIndex].templates.push(templateData)
      } else {
        // Update template in the same category
        indexData[oldCategoryIndex].templates[oldTemplateIndex] = templateData
      }

      // Reorder templates if templateOrder is provided
      if (templateOrder && Array.isArray(templateOrder)) {
        console.log('[Update Template] Reordering templates in category:', {
          category: indexData[oldCategoryIndex].title,
          oldOrder: indexData[oldCategoryIndex].templates.map((t: any) => t.name),
          newOrder: templateOrder
        })

        // Create a map of templates by name for quick lookup
        const templatesMap = new Map()
        indexData[oldCategoryIndex].templates.forEach((t: any) => {
          templatesMap.set(t.name, t)
        })

        // Reorder templates array based on templateOrder
        const reorderedTemplates = []
        for (const name of templateOrder) {
          if (templatesMap.has(name)) {
            reorderedTemplates.push(templatesMap.get(name))
          }
        }

        // Update the category with reordered templates
        indexData[oldCategoryIndex].templates = reorderedTemplates
        console.log('[Update Template] Templates reordered successfully')
      }

      // Delete unused thumbnails if variant changed to require fewer thumbnails
      if (oldRequiredCount > newRequiredCount) {
        console.log('[Update Template] Deleting unused thumbnails:', {
          oldCount: oldRequiredCount,
          newCount: newRequiredCount
        })

        // Get the media subtype (default to webp)
        const mediaSubtype = templateData.mediaSubtype || 'webp'

        // Delete thumbnails that are no longer needed (e.g., thumbnail 2)
        for (let i = newRequiredCount + 1; i <= oldRequiredCount; i++) {
          const filename = `${templateName}-${i}.${mediaSubtype}`
          console.log(`[Update Template] Marking ${filename} for deletion`)

          // To delete a file in Git, we set sha to null
          tree.push({
            path: `templates/${filename}`,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: null as any // null sha means delete
          })
        }
      }

      // Add updated index.json to tree
      tree.push({
        path: 'templates/index.json',
        mode: '100644' as const,
        type: 'blob' as const,
        content: JSON.stringify(indexData, null, 2)
      })
    }

    // 2. Update workflow.json if provided
    if (files?.workflow?.content) {
      tree.push({
        path: `templates/${templateName}.json`,
        mode: '100644' as const,
        type: 'blob' as const,
        content: Buffer.from(files.workflow.content, 'base64').toString('utf-8')
      })
    }

    // 3. Update thumbnails if provided
    if (files?.thumbnails && files.thumbnails.length > 0) {
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

    // 4. Update input files if provided
    if (files?.inputFiles && files.inputFiles.length > 0) {
      console.log(`[Update Template] Uploading ${files.inputFiles.length} input file(s)`)
      for (const inputFile of files.inputFiles) {
        // If format changed, delete old file first
        if (inputFile.deleteOldFile) {
          console.log(`[Update Template] Deleting old file: ${inputFile.deleteOldFile}`)
          tree.push({
            path: `input/${inputFile.deleteOldFile}`,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: null as any // null sha means delete
          })
        }

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

        console.log(`[Update Template] Added input file: ${inputFile.filename}`)
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
      message: `Update template: ${templateName}\n\nUpdated via ComfyUI Template Manager`,
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
      message: 'Template updated successfully',
      commit: {
        sha: newCommit.sha,
        url: `https://github.com/${owner}/${repoName}/commit/${newCommit.sha}`
      }
    }

  } catch (error: any) {
    console.error('Error updating template:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update template'
    })
  }
})
