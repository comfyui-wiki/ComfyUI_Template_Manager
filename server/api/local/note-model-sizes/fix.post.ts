import { fixNoteModelSizes } from '~/server/utils/note-model-size'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: unknown }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing template name' })
  }
  return await fixNoteModelSizes(name)
})
