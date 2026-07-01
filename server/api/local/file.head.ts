import { serveLocalRepoFile } from '~/server/utils/serve-local-repo-file'

export default defineEventHandler((event) => serveLocalRepoFile(event, { headOnly: true }))
