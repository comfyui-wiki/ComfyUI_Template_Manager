/**
 * Detect template workflow-content changes against the compare branch.
 *
 * templates/index.json only carries metadata (title, tags, models, ...), while the
 * actual workflow graph lives in templates/<name>.json and is checksummed in the
 * generated manifest (packages/core/src/comfyui_workflow_templates_core/manifest.json).
 * Comparing index.json alone therefore misses body-only edits such as MarkdownNote text.
 */

export interface ManifestAsset {
  filename?: string
  sha256?: string
}

export interface ManifestTemplate {
  id?: string
  assets?: ManifestAsset[]
}

export interface TemplateManifest {
  templates?: ManifestTemplate[]
}

const TEMPLATE_PREFIX = 'templates/'
const JSON_SUFFIX = '.json'

/** Map template name -> sha256 of its workflow JSON asset (templates/<name>.json). */
export function getWorkflowAssetShas(manifest: TemplateManifest | null | undefined): Map<string, string> {
  const shas = new Map<string, string>()
  for (const template of manifest?.templates ?? []) {
    const jsonAssets = (template.assets ?? []).filter(
      asset => typeof asset?.filename === 'string' && asset.filename.endsWith(JSON_SUFFIX) && typeof asset.sha256 === 'string'
    )
    if (jsonAssets.length === 0) continue

    const name = template.id?.trim() || (jsonAssets[0].filename as string).slice(0, -JSON_SUFFIX.length)
    if (!name) continue

    const match = jsonAssets.find(asset => asset.filename === `${name}${JSON_SUFFIX}`) ?? jsonAssets[0]
    shas.set(name, match.sha256 as string)
  }
  return shas
}

/**
 * Template names whose workflow JSON sha256 differs between the current and base manifest.
 * Templates missing from either manifest are skipped (new/deleted templates are resolved
 * from index.json instead).
 */
export function diffWorkflowAssetShas(
  current: TemplateManifest | null | undefined,
  base: TemplateManifest | null | undefined
): string[] {
  const currentShas = getWorkflowAssetShas(current)
  const baseShas = getWorkflowAssetShas(base)

  const changed: string[] = []
  for (const [name, sha] of currentShas) {
    const baseSha = baseShas.get(name)
    if (baseSha && baseSha !== sha) changed.push(name)
  }
  return changed.sort()
}

/** Extract template names from changed repo paths such as `git diff --name-only` output. */
export function templateNamesFromChangedFiles(paths: Iterable<string>): string[] {
  const names = new Set<string>()
  for (const raw of paths) {
    const path = (raw ?? '').trim().replace(/^\.\//, '')
    if (!path.startsWith(TEMPLATE_PREFIX) || !path.endsWith(JSON_SUFFIX)) continue
    const name = path.slice(TEMPLATE_PREFIX.length, -JSON_SUFFIX.length)
    // index.json / index.mcp.json are catalog metadata, not templates
    if (!name || name === 'index' || name.startsWith('index.') || name.includes('/')) continue
    names.add(name)
  }
  return [...names].sort()
}
