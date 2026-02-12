import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { formatTemplateJson } from '~/server/utils/json-formatter'
import { syncTemplateToAllLocales, updateI18nJson } from '~/server/utils/i18n-sync'

interface CreateTemplateRequest {
  repo: string
  branch: string
  templateName: string
  metadata: {
    title: string
    description: string
    category: string
    thumbnailVariant?: string
    mediaType?: string
    mediaSubtype?: string
    tags?: string[]
    models?: string[]
    logos?: Array<{
      provider: string | string[]
      label?: string
      gap?: number
      position?: string
      opacity?: number
    }>
    requiresCustomNodes?: string[]
    tutorialUrl?: string
    comfyuiVersion?: string
    date?: string
    openSource?: boolean
    includeOnDistributions?: string[]
    size?: number
    vram?: number
    usage?: number
    searchRank?: number
    io?: {
      inputs?: Array<{
        nodeId: number
        nodeType: string
        file: string
        mediaType: string
      }>
      outputs?: Array<{
        nodeId: number
        nodeType: string
        file: string
        mediaType: string
      }>
    }
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
    outputFiles?: Array<{
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
      mediaType: metadata.mediaType || 'image', // Use provided value or default to 'image'
      mediaSubtype: metadata.mediaSubtype || mediaSubtype // Use provided value or detected from thumbnail
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
    if (metadata.logos && metadata.logos.length > 0) {
      newTemplate.logos = metadata.logos
    }
    if (metadata.requiresCustomNodes && metadata.requiresCustomNodes.length > 0) {
      newTemplate.requiresCustomNodes = metadata.requiresCustomNodes
    }
    if (metadata.tutorialUrl) {
      newTemplate.tutorialUrl = metadata.tutorialUrl
    }
    if (metadata.comfyuiVersion) {
      newTemplate.comfyuiVersion = metadata.comfyuiVersion
    }
    // Set date: use provided date or default to current date (YYYY-MM-DD)
    newTemplate.date = metadata.date || new Date().toISOString().split('T')[0]
    if (metadata.openSource !== undefined) {
      newTemplate.openSource = metadata.openSource
    }
    if (metadata.includeOnDistributions && metadata.includeOnDistributions.length > 0) {
      newTemplate.includeOnDistributions = metadata.includeOnDistributions
    }
    // Add size, vram, usage, searchRank (support 0 values)
    if (metadata.size !== undefined) {
      newTemplate.size = metadata.size
    }
    if (metadata.vram !== undefined) {
      newTemplate.vram = metadata.vram
    }
    if (metadata.usage !== undefined) {
      newTemplate.usage = metadata.usage
    }
    if (metadata.searchRank !== undefined) {
      newTemplate.searchRank = metadata.searchRank
    }
    // Add io field if provided
    if (metadata.io !== undefined) {
      if (metadata.io && ((metadata.io.inputs?.length || 0) > 0 || (metadata.io.outputs?.length || 0) > 0)) {
        newTemplate.io = metadata.io
        console.log('[Create Template] Added io field:', {
          inputs: metadata.io.inputs?.length || 0,
          outputs: metadata.io.outputs?.length || 0
        })
      }
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

    // 2. Sync template to all locale files (i18n)
    try {
      console.log('[Create Template] Syncing template to all locale files...')

      // Sync template to all locale index files
      const localeFileUpdates = await syncTemplateToAllLocales(
        octokit,
        repo,
        branch,
        targetCategoryIndex,
        newTemplate,
        templateOrder
      )

      // Add locale file updates to tree
      for (const update of localeFileUpdates) {
        tree.push({
          path: update.path,
          mode: '100644' as const,
          type: 'blob' as const,
          content: update.content
        })
      }

      console.log(`[Create Template] Synced template to ${localeFileUpdates.length} locale file(s)`)

      // Update i18n.json with new template translations
      const i18nUpdate = await updateI18nJson(
        octokit,
        repo,
        branch,
        templateName,
        {
          title: metadata.title,
          description: metadata.description,
          category: metadata.category,
          tags: metadata.tags
        }
      )

      // Add i18n.json update to tree
      tree.push({
        path: i18nUpdate.path,
        mode: '100644' as const,
        type: 'blob' as const,
        content: i18nUpdate.content
      })

      console.log('[Create Template] Updated i18n.json with translation placeholders')

    } catch (error: any) {
      console.error('[Create Template] Failed to sync i18n files:', error)
      console.error('[Create Template] Error details:', {
        message: error.message,
        status: error.status,
        stack: error.stack
      })
      // Don't fail the entire operation if i18n sync fails
    }

    // 3. Check for input file conflicts and prepare filename mapping
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

    // 4. Add workflow.json (with input file name updates if needed)
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

    // 5. Add thumbnails
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

    // 6. Add input files (using actual filenames from mapping)
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

    // 7. Add output files if provided
    if (files.outputFiles && files.outputFiles.length > 0) {
      console.log(`[Create Template] Uploading ${files.outputFiles.length} output file(s)`)
      for (const outputFile of files.outputFiles) {
        // Output files don't need conflict resolution like input files
        // They are stored directly in output/ folder

        // Create blob for output file content
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: outputFile.content,
          encoding: 'base64'
        })

        tree.push({
          path: `output/${outputFile.filename}`,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha
        })

        console.log(`[Create Template] Added output file: ${outputFile.filename}`)
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
