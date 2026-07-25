export interface ParsedWorkflowFilename {
  templateName: string
  repoPath: string
}

/** Map a dropped workflow filename to template name + repo-relative path. */
export function parseWorkflowFilename(filename: string): ParsedWorkflowFilename | null {
  const base = filename.split(/[/\\]/).pop()?.trim() || ''
  const lower = base.toLowerCase()
  if (!lower.endsWith('.json')) return null

  if (lower.endsWith('.app.json')) {
    const stem = base.slice(0, -'.app.json'.length)
    if (!stem) return null
    const templateName = `${stem}.app`
    return {
      templateName,
      repoPath: `templates/${templateName}.app.json`
    }
  }

  const templateName = base.slice(0, -'.json'.length)
  if (!templateName) return null
  return {
    templateName,
    repoPath: `templates/${templateName}.json`
  }
}
