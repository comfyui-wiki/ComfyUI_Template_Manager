export interface ResolveAssetOptions {
  cacheBust?: boolean
  commitSha?: string
  compareRef?: boolean
}

export const useRepoAssets = () => {
  const { isLocalMode } = useRepoMode()

  const buildCacheQuery = (options?: ResolveAssetOptions) => {
    if (options?.commitSha) {
      return `?sha=${options.commitSha.substring(0, 8)}`
    }
    if (options?.cacheBust) {
      return `?t=${Date.now()}`
    }
    return ''
  }

  const resolveRepoFileUrl = (
    owner: string,
    repo: string,
    branch: string,
    relativePath: string,
    options?: ResolveAssetOptions
  ) => {
    const cleanPath = relativePath.replace(/^\//, '')

    if (isLocalMode.value) {
      const params = new URLSearchParams({ path: cleanPath })
      if (options?.compareRef) {
        params.set('ref', 'compare')
      }
      if (options?.commitSha) {
        params.set('sha', options.commitSha.substring(0, 8))
      } else if (options?.cacheBust) {
        params.set('t', String(Date.now()))
      }
      return `/api/local/file?${params.toString()}`
    }

    const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}`
    return `${base}${buildCacheQuery(options)}`
  }

  return {
    resolveRepoFileUrl,
    isLocalMode
  }
}
