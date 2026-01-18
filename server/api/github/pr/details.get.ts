import { Octokit } from '@octokit/rest'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)

    if (!session?.accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Please sign in'
      })
    }

    const query = getQuery(event)
    const { owner, repo, prNumber } = query

    if (!owner || !repo || !prNumber) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: owner, repo, prNumber'
      })
    }

    const octokit = new Octokit({ auth: session.accessToken })

    // Get PR details
    const { data: pr } = await octokit.pulls.get({
      owner: owner as string,
      repo: repo as string,
      pull_number: Number(prNumber)
    })

    // Get files changed in this PR
    const { data: files } = await octokit.pulls.listFiles({
      owner: owner as string,
      repo: repo as string,
      pull_number: Number(prNumber),
      per_page: 100
    })

    // Extract template names from changed files
    const changedTemplates = new Set<string>()
    const fileChanges: Record<string, { status: string, additions: number, deletions: number }> = {}

    files.forEach(file => {
      // Check if it's a template-related file
      // Pattern: templates/{name}/* or templates/index*.json
      const templateMatch = file.filename.match(/^templates\/([^\/]+)\//)
      if (templateMatch) {
        const templateName = templateMatch[1]
        changedTemplates.add(templateName)
      }

      // Track file status
      fileChanges[file.filename] = {
        status: file.status, // added, removed, modified, renamed
        additions: file.additions,
        deletions: file.deletions
      }
    })

    return {
      success: true,
      pr: {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        merged: pr.merged,
        url: pr.html_url,
        user: {
          login: pr.user?.login,
          avatar: pr.user?.avatar_url
        },
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha
        },
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files
      },
      files: {
        total: files.length,
        changes: fileChanges
      },
      templates: {
        changed: Array.from(changedTemplates).sort()
      }
    }

  } catch (error: any) {
    console.error('[PR Details] Error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || 'Failed to fetch PR details'
    })
  }
})
