import { scanNoteModelSizes } from '~/server/utils/note-model-size'

export default defineEventHandler(async () => {
  try {
    return await scanNoteModelSizes()
  } catch (error) {
    console.warn('[note-model-sizes] scan failed:', error)
    return { available: false, checkedWorkflows: 0, missingTemplates: 0, templates: [] }
  }
})
