# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Nuxt 3-based admin interface for managing ComfyUI workflow templates with GitHub integration. Templates include workflow JSON files, thumbnails, metadata, and embedded model references. The system supports forking, branch management, and PR creation workflows.

## Common Commands

### Development
```bash
npm run dev              # Start development server on localhost:3000
npm run build            # Build for production
npm run preview          # Preview production build
npm run generate         # Generate static site
```

### Code Quality
```bash
npm run type-check       # Run TypeScript type checking
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint errors
npm run test             # Run Vitest tests
npm run test -- --watch  # Run tests in watch mode
```

### GitHub Integration
```bash
npm run setup:github     # Setup GitHub OAuth and API integration
npm run deploy:vercel    # Deploy to Vercel
```

## Architecture Overview

### Core Composables (Global State Management)

The application uses Vue composables with **global state** (refs defined outside function scope) to share state across all components:

**`composables/useGitHubRepo.ts`** - GitHub repository and branch management
- Manages selected repository, branch, fork status, permissions
- Global state ensures all components see the same selection
- Key functions: `initialize()`, `checkForkExists()`, `createBranch()`, `loadBranches()`

**`composables/useTemplateDiff.ts`** - Branch comparison system
- Compares current branch templates against main branch
- Assigns diff status: NEW, MODIFIED, DELETED, UNCHANGED
- Uses content hashing (ohash) to detect changes
- Returns enriched template data with `diffStatus` property

**`composables/useTemplateData.ts`** - Template metadata aggregation
- Fetches and parses template data from GitHub
- Provides autocomplete suggestions (tags, models, naming patterns)
- Used by forms for consistency and validation

### API Layer (`server/api/`)

**Template Management:**
- `templates.post.ts` - Create new templates (handles file uploads, model embedding, updates index.json/bundles.json)
- `templates-data.get.ts` - Fetch template metadata for autocomplete
- `templates/index.get.ts` - List all templates

**GitHub Integration:**
- `github/templates.get.ts` - Fetch templates from GitHub repo
- `github/branches.get.ts` - List repository branches
- `github/branch/create.post.ts` - Create new branch
- `github/fork/create.post.ts` - Fork repository
- `github/fork/check.get.ts` - Check if user has forked
- `github/fork/compare.get.ts` - Compare fork with upstream
- `github/fork/sync.post.ts` - Sync fork with upstream
- `github/permission.get.ts` - Check repo write access
- `github/branch-permission.get.ts` - Check branch-level permissions

**Authentication:**
- `auth/[...].ts` - NextAuth.js handler for GitHub OAuth

### Page Structure

**`pages/index.vue`** - Main template browser
- Uses `useTemplateDiff()` for branch comparison
- Displays templates with diff badges (NEW/MODIFIED/DELETED)
- Filter by category, model, tag, type, and diff status
- Shows diff statistics in header

**`pages/admin/new.vue`** - Create template form
- Dynamic thumbnail upload based on variant (1-2 images)
- Auto-detects media type/subtype from uploaded files
- Model embedding into workflow JSON
- Validates filename uniqueness
- Uses `useTemplateData()` for autocomplete suggestions

**`pages/admin/edit/[name].vue`** - Edit template metadata
- Loads template from current branch
- Preview changes in real-time
- Links to GitHub editor for direct editing
- Save functionality currently redirects to GitHub

### Key Features

**Branch Comparison System** (see `docs/branch-comparison.md`)
- Fetches index.json from both current and main branch in parallel
- Creates Map for O(1) lookups when comparing
- Hashes template content to detect modifications
- Enriches template objects with `diffStatus` property
- Filter dropdown to show only NEW, MODIFIED, DELETED, or UNCHANGED templates

**Model Embedding**
- Models are embedded into workflow JSON nodes
- System finds nodes with matching widget_values (model filenames)
- Adds `properties.models` array to nodes with metadata:
  - `name`: model filename
  - `url`: download URL
  - `directory`: target directory (checkpoints, loras, etc.)
  - `hash` & `hash_type`: SHA256 (optional)
- Processes both top-level nodes and subgraph nodes

**Thumbnail Variants**
- `none`: Single thumbnail
- `hoverDissolve`: 2 images (base + hover overlay)
- `compareSlider`: 2 images (before/after slider)
- `zoomHover`: Single image with zoom effect
- Form dynamically shows correct number of upload inputs

**GitHub Workflow**
1. User signs in with GitHub OAuth
2. System checks for fork and repo access
3. User selects repo (main or fork) and branch
4. Create/edit templates with real-time preview
5. Changes saved to selected branch
6. Can create PR through GitHub UI

## Important Implementation Details

### Global State Pattern
Composables use refs **outside** the function scope to ensure global state:
```typescript
// CORRECT: Global state shared across all components
const selectedBranch = ref('main')

export const useGitHubRepo = () => {
  // Function body
  return { selectedBranch }
}
```

Without this pattern, each component gets its own state copy and branch switching breaks.

### Template Data Structure
Templates are organized in `templates/index.json`:
```json
{
  "categories": [
    {
      "moduleName": "media-image",
      "title": "Media Image",
      "type": "image",
      "templates": [
        {
          "name": "templates-basic_image",
          "title": "Basic Image Generation",
          "description": "...",
          "mediaType": "image",
          "mediaSubtype": "webp",
          "thumbnailVariant": "none",
          "tags": ["API", "Basic"],
          "models": ["FLUX", "SD1.5"],
          "tutorialUrl": "https://...",
          "comfyuiVersion": "0.3.26",
          "date": "2024-01-15",
          "size": 1048576
        }
      ]
    }
  ]
}
```

### File Naming Convention
- Template name: `category_subcategory_description` (lowercase, underscores only)
- Workflow: `{template-name}/workflow.json`
- Thumbnails: `{template-name}-1.{ext}`, `{template-name}-2.{ext}`, etc.

### Authentication & Permissions
- Uses NextAuth.js with GitHub provider
- Requires GitHub OAuth app credentials in `.env`
- `GITHUB_TOKEN` needed for repo operations (read templates, create branches)
- Permission checks at both repo-level and branch-level
- Protected branches (like main) prevent direct pushes even with write access

## Environment Variables

Required for full functionality:
```env
NEXTAUTH_SECRET=random-secret-string
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=oauth-app-client-id
GITHUB_CLIENT_SECRET=oauth-app-secret
GITHUB_TOKEN=personal-access-token
GITHUB_OWNER=Comfy-Org
GITHUB_REPO=workflow_templates
```

## Common Tasks

### Adding a New Thumbnail Variant
1. Update `Select` options in `pages/admin/new.vue` and `pages/admin/edit/[name].vue`
2. Update `thumbnailUploadCount` computed property logic
3. Add description text in `getThumbnailDescription()`
4. Update `getThumbnailLabel()` for custom labels

### Modifying Template Validation
Edit `validateFilename()` and `validateForm()` in `pages/admin/new.vue`

### Adding New Model Directories
Update the `Select` options in the model section of `pages/admin/new.vue` (lines ~374-387)

### Extending API Endpoints
Add new files to `server/api/` directory. Nuxt auto-registers them based on file path:
- `server/api/foo.get.ts` → GET `/api/foo`
- `server/api/bar.post.ts` → POST `/api/bar`
- `server/api/nested/path.get.ts` → GET `/api/nested/path`

## Debugging Tips

### Branch Switching Not Working
Check if composable state is global (defined outside function). Look for this pattern in `composables/useGitHubRepo.ts` and `composables/useTemplateDiff.ts`.

### Templates Not Loading
1. Check browser console for CORS errors
2. Verify GitHub token has repo access
3. Check network tab for 404s on raw.githubusercontent.com
4. Ensure repository/branch exists

### Diff Badges Not Showing
1. Verify `useTemplateDiff.loadCurrentTemplates()` is called with correct repo/branch
2. Check that `compareTemplates` computed is running
3. Ensure TemplateCard receives `diffStatus` prop

### Model Embedding Not Working
1. Verify model names match exactly with workflow widget_values
2. Check workflow JSON structure (nodes array exists)
3. Look for console logs: "Embedded X model(s) into node Y"
4. Ensure workflow.json is valid JSON

## Testing Strategy

Tests are located in `test/` directory. Key areas to test:
- Template validation (filename format, uniqueness)
- Model embedding logic (node traversal, metadata format)
- Branch comparison (hash calculation, status assignment)
- File upload handling (base64 encoding, MIME type detection)

Run tests with `npm run test` before creating PRs.
