# ComfyUI Template Admin - Project Documentation

## Project Overview

This is a Nuxt 3-based admin interface for managing ComfyUI workflow templates. It provides a web UI to edit template metadata, upload thumbnails, manage workflow files, and publish changes to a GitHub repository.

**Repository**: `comfyui-wiki/workflow_templates` (default)
**Tech Stack**: Nuxt 3, Vue 3, TypeScript, TailwindCSS, shadcn-vue, NextAuth.js

---

## Key Features

### 1. Template Management
- Browse templates by category
- Edit template metadata (title, description, tags, models, etc.)
- Reorder templates within categories via drag-and-drop
- Live preview of changes

### 2. Thumbnail Management
- Upload and convert images/videos to WebP format
- Variants: None, Hover Dissolve, Compare Slider, Zoom Hover
- Automatic format detection and converter
- FFmpeg.wasm integration for video conversion
- Quality optimization with size warnings (Images <100KB, Videos <1MB optimal)
- High-quality scaling with before/after comparison

### 3. Workflow & Input File Management
- Upload/download workflow.json with validation
- **Automatic Input File Verification**: Parses workflow to detect LoadImage/LoadAudio/LoadVideo nodes
- **Smart Warnings**: Shows missing files from `input/` folder with visual indicators
- **Direct Upload**: Upload missing input files with format conversion support
- **File Preview**: Image previews for uploaded files

### 4. GitHub Integration
- OAuth authentication via GitHub
- Direct commits to selected branch
- Branch selection support
- Atomic updates with git tree API

### 5. Multi-language (i18n) Synchronization
- **Automatic sync across 11 languages**: en, zh, zh-TW, ja, ko, es, fr, ru, tr, ar, pt-BR
- **Create mode**: New templates sync to all locale files with English placeholders
- **Update mode**: Technical fields sync while preserving existing translations
- **Outdated Tracking**: Automatically marks templates when English content changes
- **i18n.json Integration**: Updates translation database for manual translation
- **2-stage workflow**: Stage 1 (Auto sync) → Stage 2 (Manual translation via `sync_data.py`)

**See**: `docs/i18n-outdated-translations.md` for detailed guide

### 6. AI Translation (Optional Feature)
- **DeepSeek API Integration**: AI-powered translation for template metadata
- **Translation Modes**:
  - Single Cell: Translate individual fields
  - Batch Single Language: Multiple items → 1 target language
  - Multi-Language: 1 item → all 10 languages (1 API call)
  - Batch All Languages: Multiple items → all languages (default)
- **Security**: Rate limiting, origin verification, whitelist support
- **Configuration**: `config/i18n-config.json` for prompts and security settings
- **Enable**: Set `DEEPSEEK_API_KEY` environment variable

---

## File Structure

```
/pages
  /admin
    /edit/[name].vue          # Template edit page
    index.vue                 # Template list/home page

/components
  ThumbnailConverter.vue      # Image/video to WebP converter (for thumbnails)
  InputAssetConverter.vue     # Flexible converter for input assets
  ThumbnailPreview.vue        # Preview component with variants
  TemplateCardPreview.vue     # Template card preview
  WorkflowFileManager.vue     # Workflow and input files manager
  WorkflowModelLinksEditor.vue # Model links editor
  TranslationManager.vue      # i18n translation manager with AI support

/server/api
  /config
    [name].ts                 # Config file API endpoint (serves config files)
  /github
    /template
      create.post.ts          # Create template endpoint (with i18n sync)
      update.post.ts          # Update template endpoint (with i18n sync)
  /ai
    /translate
      single.post.ts          # Single field AI translation endpoint
      batch.post.ts           # Batch AI translation endpoint

/server/utils
  json-formatter.ts           # JSON formatting utilities
  i18n-sync.ts                # Multi-language synchronization utilities
  ai-translator.ts            # AI translation with DeepSeek API
  rate-limiter.ts             # Rate limiting and security checks

/config
  template-naming-rules.json  # Template naming conventions
  workflow-model-config.json  # Workflow model configuration
  bundle-mapping-rules.json   # Bundle mapping configuration
  i18n-config.json            # i18n configuration (11 languages)

/docs
  i18n-outdated-translations.md # i18n outdated translations guide

/composables
  useGitHubRepo.ts            # GitHub repo state management

nuxt.config.ts                # Nuxt configuration
package.json                  # Dependencies
```

---

## Configuration

### Environment Variables

```bash
# GitHub OAuth (required)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# NextAuth (required)
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000/api/auth

# AI Translation (optional - enables AI-powered translation feature)
DEEPSEEK_API_KEY=sk-xxxxx                                    # Your DeepSeek API key
DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions  # Optional, defaults to DeepSeek
DEEPSEEK_MODEL=deepseek-chat                                 # Optional, defaults to deepseek-chat
```

**Note on AI Translation:**
- If `DEEPSEEK_API_KEY` is not set, the AI translation feature will be disabled
- The system automatically uses `NEXTAUTH_URL` domain for origin verification
- Configure security settings (rate limits, whitelist) in `config/i18n-config.json`
- See `SECURITY-QUICKSTART.md` for quick setup guide

### nuxt.config.ts

Key settings:
- **SSR enabled** (kept enabled for optimal SEO and initial page load, despite minor hydration warnings)
- Auth: `@sidebase/nuxt-auth` with GitHub provider
- FFmpeg excluded from Vite optimization
- Default repo: `Comfy-Org/workflow_templates`
- **AI Translation config**:
  - `deepseekApiKey` - Server-side API key (from environment)
  - `deepseekApiEndpoint` - API endpoint (defaults to DeepSeek)
  - `deepseekModel` - Model name (defaults to `deepseek-chat`)
  - `public.aiTranslationEnabled` - Client-side feature flag (auto-set based on API key presence)

### Configuration Files

All configuration files are stored in `/config/` and served via the API endpoint `/api/config/[name].json`:

**`/config/template-naming-rules.json`**:
- Template naming conventions (snake_case with type prefixes)
- Category-specific prefix rules
- Best practices and examples
- Used by: `WorkflowFileManager` component

**`/config/workflow-model-config.json`**:
- Workflow model type definitions
- URL patterns for model validation
- Used by: `WorkflowModelLinksEditor` component and edit page

---

## Architecture Notes

### Key Implementation Details

**Multi-language Synchronization**:
- Templates automatically sync to 11 languages (en, zh, zh-TW, ja, ko, es, fr, ru, tr, ar, pt-BR)
- Outdated translations tracked in `i18n.json` when English content changes
- Compatible with existing Python `sync_data.py` workflow

**AI Translation**:
- Optional DeepSeek API integration for bulk translation
- Supports single-cell, batch single-language, and multi-language modes
- Security: rate limiting, origin verification, whitelist support

**File Management**:
- Automatic workflow input file verification (LoadImage/LoadAudio/LoadVideo nodes)
- Smart format detection for thumbnails and input files
- Conversion tools: `ThumbnailConverter.vue` (WebP), `InputAssetConverter.vue` (flexible formats)
- Size warnings: Images >2MB, Videos >4MB

**GitHub Integration**:
- Direct commits to selected branch
- Dual-mode data fetching (CDN cached vs fresh API)
- User's OAuth token for all operations (5000 req/hour)

**Configuration System**:
- All config files in `/config/` directory
- Served via API endpoint with whitelist security
- Template naming rules with category-specific prefixes

---

## API Endpoints

### GET `/api/config/[name].json`
Serves configuration files from `/config/` directory with whitelist security and 60s cache.

**Allowed Configs**: `template-naming-rules.json`, `workflow-model-config.json`

---

### POST `/api/github/template/update`
Updates template metadata and files (workflow, thumbnails, input files) via GitHub API.

**Key Parameters**:
- `repo`, `branch`, `templateName`
- `metadata`: title, description, category, tags, models, etc.
- `files`: workflow (base64), thumbnails (base64), inputFiles (base64)

**Response**: `{ success, message, commit: { sha, url } }`

---

### POST `/api/ai/translate/multi-lang`
Translates text to multiple languages in one API call (AI Translation feature).

**Request**: `{ sourceText, sourceLang, targetLangs[] }`

**Response**: `{ success, translations: { lang: text }, failed[], usage }`

**Security**: Requires authentication, origin verification, rate limiting

---

## Key Components

### ThumbnailConverter.vue
Converts images/videos to WebP format for thumbnails (400x400 or 350x350).

**Props**: `initialFile?: File`
**Emits**: `converted: File`

### InputAssetConverter.vue
Flexible converter for input assets with multiple format/resize options.

**Props**: `initialFile?: File, targetFilename?: string`
**Emits**: `converted: File`
**Formats**: WebP, JPEG, PNG | **Resize**: None, %, dimensions, max dimension

### ThumbnailPreview.vue
Preview component supporting variants: none, hoverDissolve, compareSlider, zoomHover.

**Props**: `variant: string, images: File[], className?: string, hoverZoom?: number`

### WorkflowFileManager.vue
Manages workflow JSON and input files with automatic file verification.

**Props**: `templateName, repo, branch, workflowContent?`
**Emits**: `workflowUpdated, inputFilesUpdated, openConverter`
**Exposed**: `handleConvertedFileReceived()`

---

## Known Issues & Limitations

1. **FFmpeg Loading**: ~31MB download on first use, can take 30s+ to initialize
2. **Browser Support**: FFmpeg requires modern browsers with WebAssembly support
3. **File Size**: Large videos may exceed browser memory limits
4. **Git Operations**: No conflict resolution, assumes linear history
5. **SSR Hydration Warnings**: Minor Vue SSR hydration warnings in browser console (non-critical)

---

## Development

```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### Authentication Flow
1. Sign in with GitHub → OAuth → Callback → Session with access token
2. Access token used for all GitHub API calls
3. Session stored in cookies

### Git Workflow
Each save creates one commit: `Update template: {templateName}`

Includes: `templates/index.json`, workflow JSON, thumbnails, input files

---

**Last Updated**: 2026-01-18
**Version**: 1.3.0
