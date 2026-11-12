import i18nConfig from '~/config/i18n-config.json'

/** templates/index*.json filenames, including English index.json. */
export const localeIndexFiles: string[] = i18nConfig.supportedLocales.map(
  (locale) => locale.indexFile
)

/** index filename → locale code, e.g. index.it.json → it */
export const localeCodeByIndexFile: Record<string, string> = Object.fromEntries(
  i18nConfig.supportedLocales.map((locale) => [locale.indexFile, locale.code])
)

/** Repo paths for every locale index. */
export const templateIndexPaths: string[] = localeIndexFiles.map(
  (file) => `templates/${file}`
)
