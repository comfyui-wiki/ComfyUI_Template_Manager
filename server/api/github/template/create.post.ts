import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { formatTemplateJson } from '~/server/utils/json-formatter'

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
      content: formatTemplateJson(indexData)
    })

    // Update bundles.json to include the new template
    try {
      console.log('[Create Template] Checking bundles.json...')

      let bundlesData: any = {}
      let bundlesFileExists = false

      // Try to get current bundles.json
      try {
        const { data: bundlesFile } = await octokit.repos.getContent({
          owner,
          repo: repoName,
          path: 'bundles.json',
          ref: branch
        })

        if ('content' in bundlesFile) {
          const bundlesContent = Buffer.from(bundlesFile.content, 'base64').toString('utf-8')
          bundlesData = JSON.parse(bundlesContent)
          bundlesFileExists = true
          console.log('[Create Template] bundles.json found and loaded')
        }
      } catch (error: any) {
        if (error.status === 404) {
          console.log('[Create Template] bundles.json not found in branch, will create new one')
          bundlesData = {}
        } else {
          console.error('[Create Template] Error reading bundles.json:', error.message)
          throw error
        }
      }

      // Load bundle mapping rules
      const configPath = resolve(process.cwd(), 'config/bundle-mapping-rules.json')
      console.log('[Create Template] Loading bundle mapping rules from:', configPath)
      const bundleMappingRules = JSON.parse(await readFile(configPath, 'utf-8'))

      // Determine which bundle to add the template to based on category
      const targetBundle = bundleMappingRules.categoryMapping[metadata.category] || bundleMappingRules.defaultBundle

      console.log(`[Create Template] Category "${metadata.category}" maps to bundle "${targetBundle}"`)

      // Ensure bundle exists
      if (!bundlesData[targetBundle]) {
        bundlesData[targetBundle] = []
        console.log(`[Create Template] Created new bundle "${targetBundle}"`)
      }

      // Add template to bundle (avoid duplicates)
      if (!bundlesData[targetBundle].includes(templateName)) {
        bundlesData[targetBundle].push(templateName)
        console.log(`[Create Template] Added "${templateName}" to bundle "${targetBundle}"`)

        // Add updated bundles.json to tree
        // Keep bundles.json in standard format for better readability
        tree.push({
          path: 'bundles.json',
          mode: '100644' as const,
          type: 'blob' as const,
          content: JSON.stringify(bundlesData, null, 2)
        })

        console.log('[Create Template] bundles.json update queued for commit')
      } else {
        console.log(`[Create Template] Template "${templateName}" already exists in bundle "${targetBundle}"`)
      }
    } catch (error: any) {
      console.error('[Create Template] Failed to update bundles.json:', error)
      console.error('[Create Template] Error details:', {
        message: error.message,
        status: error.status,
        stack: error.stack
      })
      // Don't fail the entire operation if bundles.json update fails
    }

    // 2. Check for input file conflicts and prepare filename mapping
    const filenameMapping = new Map<string, string>() // originalName -> actualName (with prefix if conflict)

    if (files.inputFiles && files.inputFiles.length > 0) {
      console.log(`[Create Template] Checking for input file conflicts...`)

      for (const inputFile of files.inputFiles) {
        const originalFilename = inputFile.filename

        // Check if file already exists in repo
        try {
          await octokit.repos.getContent({
            owner,
            repo: repoName,
            path: `input/${originalFilename}`,
            ref: branch
          })

          // File exists - potential conflict, use prefixed name
          const prefixedFilename = `${templateName}_${originalFilename}`
          filenameMapping.set(originalFilename, prefixedFilename)
          console.log(`[Create Template] Conflict detected for ${originalFilename}, will use ${prefixedFilename}`)
        } catch (error: any) {
          if (error.status === 404) {
            // File doesn't exist - no conflict, use original name
            filenameMapping.set(originalFilename, originalFilename)
            console.log(`[Create Template] No conflict for ${originalFilename}, using original name`)
          } else {
            // API error, default to prefixed name for safety
            const prefixedFilename = `${templateName}_${originalFilename}`
            filenameMapping.set(originalFilename, prefixedFilename)
            console.warn(`[Create Template] Error checking ${originalFilename}, using prefixed name for safety`)
          }
        }
      }
    }

    // 3. Add workflow.json (with input file name updates if needed)
    let workflowContent = Buffer.from(files.workflow.content, 'base64').toString('utf-8')

    // Update workflow JSON with actual filenames (prefixed if conflict)
    if (filenameMapping.size > 0) {
      try {
        const workflow = JSON.parse(workflowContent)

        // Update node widgets_values to use actual filenames
        if (workflow.nodes) {
          for (const node of workflow.nodes) {
            if (node.widgets_values && Array.isArray(node.widgets_values)) {
              for (let i = 0; i < node.widgets_values.length; i++) {
                const originalName = node.widgets_values[i]
                if (filenameMapping.has(originalName)) {
                  const actualName = filenameMapping.get(originalName)!
                  if (actualName !== originalName) {
                    console.log(`[Create Template] Updating workflow reference: ${originalName} → ${actualName}`)
                  }
                  node.widgets_values[i] = actualName
                }
              }
            }
          }
        }

        workflowContent = JSON.stringify(workflow, null, 2)
      } catch (error) {
        console.error('[Create Template] Failed to update workflow JSON:', error)
      }
    }

    tree.push({
      path: `templates/${templateName}.json`,
      mode: '100644' as const,
      type: 'blob' as const,
      content: workflowContent
    })

    // 4. Add thumbnails
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

    // 5. Add input files (using actual filenames from mapping)
    if (files.inputFiles && files.inputFiles.length > 0) {
      console.log(`[Create Template] Uploading ${files.inputFiles.length} input file(s)`)
      for (const inputFile of files.inputFiles) {
        // Get actual filename (prefixed only if there was a conflict)
        const actualFilename = filenameMapping.get(inputFile.filename) || inputFile.filename

        // Create blob for input file content
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: inputFile.content,
          encoding: 'base64'
        })

        tree.push({
          path: `input/${actualFilename}`,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha
        })

        if (actualFilename !== inputFile.filename) {
          console.log(`[Create Template] Added input file: ${inputFile.filename} → ${actualFilename} (conflict resolved)`)
        } else {
          console.log(`[Create Template] Added input file: ${inputFile.filename}`)
        }
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
