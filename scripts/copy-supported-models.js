import { copyFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = '/Users/linmoumou/Documents/comfy/cloud/common/supported_models.json'
const dest = join(__dirname, '../config/supported_models.json')

if (!existsSync(src)) {
  console.warn(`⚠ supported_models.json not found at ${src}, skipping copy`)
  process.exit(0)
}

try {
  copyFileSync(src, dest)
  console.log('✓ Copied supported_models.json → config/supported_models.json')
} catch (e) {
  console.warn('⚠ Could not copy supported_models.json:', e.message)
}
