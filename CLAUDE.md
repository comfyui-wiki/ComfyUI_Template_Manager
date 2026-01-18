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
- Support for multiple thumbnail variants:
  - None (default)
  - Hover Dissolve (2 images)
  - Compare Slider (2 images)
  - Zoom Hover
- **Automatic format detection**: Non-WebP files auto-open converter
- FFmpeg.wasm integration for video conversion
- Quality optimization with size warnings:
  - Images: Target <100KB (optimal), 100-200KB (warning), >200KB (error)
  - Videos: Target <1MB (optimal), 1-4MB (warning), >4MB (error)

### 3. Thumbnail Converter Features
- Before/After side-by-side comparison (250x250 preview)
- Drag-to-reposition for Before preview
- Automatic size selection: 400x400 (images), 350x350 (videos)
- High-quality scaling: `imageSmoothingQuality: 'high'` for canvas, `flags=lanczos` for FFmpeg
- Default quality: 95 (0-100 range)
- Crop and Pad modes
- Real-time file size feedback

### 4. Workflow File Management
- Download existing workflow.json
- Re-upload new workflow files
- Validation of JSON format
- **Input File Verification**: Automatically parses workflow JSON to detect required input files
- **Smart Warnings**: Shows which input files are missing from the `input/` folder
- **Input File Upload**: Upload missing input files directly from the edit page
- **Node Types Supported**: LoadImage, LoadAudio, LoadVideo
- **Visual Indicators**: Green checkmarks for uploaded files, amber warnings for missing files
- **File Preview**: Displays image previews for uploaded input files

### 5. GitHub Integration
- OAuth authentication via GitHub
- Direct commits to repository
- Branch selection support
- Atomic updates with git tree API

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

/server/api
  /config
    [name].ts                 # Config file API endpoint (NEW)
  /github
    /template
      update.post.ts          # Update template endpoint

/config
  template-naming-rules.json  # Template naming conventions (NEW)
  workflow-model-config.json  # Workflow model configuration (NEW)

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
```

### nuxt.config.ts

Key settings:
- **SSR enabled** (kept enabled for optimal SEO and initial page load, despite minor hydration warnings)
- Auth: `@sidebase/nuxt-auth` with GitHub provider
- FFmpeg excluded from Vite optimization
- Default repo: `Comfy-Org/workflow_templates`

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

## Recent Implementations

### 1. Flat Template Grid for All Categories (2026-01-16)
**Problem**: In "All Templates" mode, templates were still grouped by category, preventing proper sorting
**Solution**:
- Changed display logic to always show flat grid regardless of category selection
- Removed category grouping in "All Templates" mode
- All sorting options (latest, oldest, name, default) now work correctly across all templates
- Category badge still shown on each template card for context

**Benefits**:
- ✅ Sorting by date/name works across ALL templates
- ✅ Better user experience for browsing large template sets
- ✅ Consistent UI behavior between "All" and specific category views
- ✅ Category information preserved via badge on each card

**Files**:
- Frontend: `pages/index.vue` (simplified template display logic)

### 2. GitHub API for Fresh Data (2026-01-16)
**Problem**: GitHub CDN caching prevented seeing latest data after fork sync
**Solution**:
- Added dual-mode data fetching in `/api/github/templates`:
  - Default: `raw.githubusercontent.com` (fast, CDN cached)
  - Refresh: `api.github.com` (bypasses CDN, always fresh)
- Implemented `useApi` query parameter to switch between modes
- Updated `fetchTemplates` to use API mode when force refreshing
- Added detailed console logging to show which method is used

**Technical Details**:
```typescript
// Default (fast): Uses CDN
query: { owner, repo, branch, useApi: 'false' }

// Refresh (fresh): Bypasses CDN
query: { owner, repo, branch, useApi: 'true' }
```

**Files**:
- API: `server/api/github/templates.get.ts` (dual-mode support)
- Composable: `composables/useTemplateDiff.ts` (useApi parameter)
- Frontend: `pages/index.vue` (refresh button)

### 3. Additional Template Metadata Fields (2026-01-16)
**Problem**: Templates had limited metadata fields; size/vram values were not user-friendly (stored in bytes)
**Solution**:
- Added support for 5 new metadata fields:
  - `requiresCustomNodes`: Array of required custom node packages
  - `size`: Model size in bytes (displayed as GB)
  - `vram`: VRAM requirement in bytes (displayed as GB)
  - `usage`: Usage count tracking
  - `searchRank`: Search visibility ranking
- Implemented automatic GB ↔ bytes conversion:
  - `bytesToGB()`: Converts bytes to GB with 1 decimal precision
  - `gbToBytes()`: Converts GB to bytes for storage
- Added custom nodes multi-select with autocomplete
- Updated both frontend form and backend API

**Files**:
- Frontend: `pages/admin/edit/[name].vue` (UI fields, conversion utilities, form data)
- Backend: `server/api/github/template/update.post.ts` (metadata save logic)

### 2. Fork Status Detection Fix (2026-01-16)
**Problem**: Fork sync warning showed even when viewing main repository
**Solution**:
- Added `isCurrentRepoFork` computed property to check if selected repo is user's fork
- Updated fork warning conditions to only show when current repo IS the fork
- Added cache busting for fork status checks after sync
- Implemented 2-second delay after sync before rechecking status
- Added manual refresh button for fork status
- Added no-cache headers to fork comparison API endpoint

**Technical Details**:
- Fork warnings now check: `isCurrentRepoFork && forkCompareStatus?.isBehind`
- Sync flow: Sync → Wait 2s → Check status with cache busting
- Manual refresh available via small refresh icon next to "up to date" message
- API headers: `Cache-Control: no-cache, no-store, must-revalidate`

**Files**:
- Component: `components/RepoAndBranchSwitcher.vue` (UI logic, refresh handler)
- Composable: `composables/useGitHubRepo.ts` (cache busting, delayed recheck)
- API: `server/api/github/fork/compare.get.ts` (no-cache headers)

### 3. Merged Upload/Convert Workflow
**Problem**: Users had to upload files twice (once to select, once in converter)
**Solution**:
- Added `initialFile` prop to ThumbnailConverter
- Auto-detect file format on upload
- If WebP → direct upload
- If not WebP → auto-open converter with file pre-loaded

**Files**: `pages/admin/edit/[name].vue:949-1011`, `components/ThumbnailConverter.vue:358-360`

### 2. Fixed Video Quality Parameter
**Problem**: Video quality was inverted (higher quality = smaller file)
**Solution**: Changed `const qualityValue = Math.round(100 - (quality.value * 0.9))` to `Math.round(quality.value)`

**Files**: `components/ThumbnailConverter.vue:822-824`

### 3. Image Quality Improvements
**Problem**: Canvas downscaling caused quality loss
**Solution**: Added `ctx.imageSmoothingQuality = 'high'` and FFmpeg `flags=lanczos`

**Files**: `components/ThumbnailConverter.vue:743-745`, `835`, `838`

### 4. Compare Slider Order Swap
**Problem**: Before/After thumbnails displayed in wrong order
**Solution**:
- Updated `thumbnailDisplayOrder` computed to return `[2, 1]` for compareSlider
- Updated labels: index 1 = "After Image", index 2 = "Before Image"
- Result: Left shows Before, Right shows After

**Files**: `pages/admin/edit/[name].vue:739-752`, `761-768`, `771-782`

### 5. Fixed Tags Input
**Problem**: Combobox component didn't capture input correctly
**Solution**: Replaced Combobox with plain Input + custom dropdown

**Files**: `pages/admin/edit/[name].vue:409-453`

### 6. Added Models Field
**Problem**: Models metadata existed in data but no UI to edit
**Solution**:
- Added models multi-select (identical to tags UI)
- Load/save models from/to `index.json`
- Auto-suggestions from existing templates
- Support for custom model names

**Files**:
- Frontend: `pages/admin/edit/[name].vue:452-522`, `628-646`, `688-710`
- Backend: `server/api/github/template/update.post.ts:14`, `125`

### 7. Download Local Converted Files
**Problem**: Downloading thumbnail before saving returned old file
**Solution**: Check `reuploadedThumbnails` Map first, download local file if exists

**Files**: `pages/admin/edit/[name].vue:870-913`

### 8. Workflow Input File Verification & Management
**Problem**: Users couldn't see which input files were required by workflows or upload missing files
**Solution**:
- Created `WorkflowFileManager.vue` component to handle workflow and input files
- Parses workflow JSON to extract references from LoadImage/LoadAudio/LoadVideo nodes
- Checks GitHub repo's `input/` folder for file existence
- Shows warnings for missing files with amber styling
- Allows direct upload of missing input files from edit page
- Displays file info (size, type, node ID) and image previews
- Backend API updated to handle input file uploads to `input/` folder

**Features**:
- Automatic workflow parsing on load/reupload
- Visual status indicators (green checkmark for uploaded, amber warning for missing)
- File download support for existing input files
- Upload/reupload functionality per file
- Image preview for uploaded files
- Real-time status updates
- **File size validation**: Warns if images > 2MB or videos > 4MB
- **Automatic format detection**: Detects non-WebP images and videos
- **Conversion support**: Offers "Convert" button to optimize files via ThumbnailConverter
- **Post-conversion size check**: Warns if converted file is still too large

**Files**:
- Component: `components/WorkflowFileManager.vue` (new)
- Frontend: `pages/admin/edit/[name].vue:151-161`, `638-640`, `953-959`, `1081-1095`
- Backend: `server/api/github/template/update.post.ts:29-32`, `268-289`

**Node Types Supported**: LoadImage, LoadAudio, LoadVideo (from Python script)

**Size Limits**:
- Images: Warning if > 2MB (recommended: < 2MB for server compatibility)
- Videos: Warning if > 4MB (recommended: < 4MB for server compatibility)

### 9. Input Asset Converter Component
**Problem**: ThumbnailConverter was designed for thumbnails (always WebP, fixed square sizes) but input assets need different settings
**Solution**:
- Created dedicated `InputAssetConverter.vue` component for input files
- Separate from ThumbnailConverter to avoid confusion and complexity
- **Auto-detects format from filename** (no manual selection needed)
- Custom resize options (keep original, percentage, specific dimensions, max dimension)
- Aspect ratio preservation
- Quality/compression control (60-100%)
- **Immediate before/after comparison** (like ThumbnailConverter)
- **Click to open in new tab** for full-size preview
- **Always available** - converts both new uploads and existing files

**Features**:
- **Format Auto-Detection**: Reads target filename extension (.webp/.jpg/.png)
- **Immediate Preview**: Shows before/after comparison automatically on load
- **Interactive Preview**: Click images to open in new tab for inspection
- **Resize Modes**:
  - Keep original size (compression only)
  - Resize by percentage (10-100%)
  - Specific dimensions (with aspect ratio lock option)
  - Max dimension (scale down if exceeds, maintains aspect ratio)
- **Quality Control**: 60-100% slider with real-time re-conversion
- **Before/After Comparison**: Side-by-side 250px height previews
- **Savings Indicator**: Shows file size reduction % (green if smaller, red if larger)
- **Smart Warnings**: Color-coded borders (red >2MB, amber >1MB, green <1MB)
- **High-Quality Scaling**: Uses `imageSmoothingQuality: 'high'` for canvas operations

**Files**:
- Component: `components/InputAssetConverter.vue` (new)
- Frontend: `pages/admin/edit/[name].vue:596-611`, `627`, `659`, `970-974`, `1122-1135`
- Manager: `components/WorkflowFileManager.vue:143-152`, `467-496`

**Usage**:
- "Convert" button always shown for all input files (uploaded or existing)
- Fetches existing files from GitHub if needed
- Opens dedicated dialog with InputAssetConverter
- Auto-converts on load to show immediate preview
- User adjusts settings and clicks "Use This Conversion"
- Passes converted file back to WorkflowFileManager for storage

### 10. Fixed InputAssetConverter Critical Issues
**Problem 1**: PNG→PNG conversion resulted in **larger file sizes** (35% bigger)
- Original: 2.33 MB → Converted: 3.16 MB
- Root cause: PNG is lossless format, canvas re-encoding loses original compression optimizations

**Problem 2**: Large files (>10MB, 4096px) failed to convert with "image not loaded yet" error
- Root cause: Race condition - Vue reactive variables not updated before handleConvert() called
- Async nature of Vue reactivity caused originalWidth/originalHeight to be 0

**Problem 3**: Alert popups disrupted workflow and were user-hostile

**Solution**:
- **PNG Warning System**: Added prominent amber warning box explaining PNG limitations
  - Explains that PNG→PNG may increase file size
  - Recommends changing filename extension to .webp or .jpg in workflow JSON
  - Quality slider disabled for PNG with explanation
- **Fixed Race Condition**:
  - handleConvert() now creates its own Image() and loads from sourceFile
  - No longer relies on potentially-unset reactive variables
  - Updates originalWidth/Height if not already set
  - Works reliably for any file size
- **Replaced Alerts with Inline Messages**:
  - Red error box shows detailed error info (stays on screen)
  - No more disruptive alert() popups
  - User can read error and decide next action
- **Removed Auto-Convert**:
  - No longer auto-converts on file load
  - User sees warnings first, then clicks "Refresh Preview"
  - Gives user control over conversion process
- **Improved URL Management**:
  - Proper cleanup of blob URLs in finally block
  - Prevents memory leaks with large files

**Files**:
- `components/InputAssetConverter.vue:155-173` (PNG warning)
- `components/InputAssetConverter.vue:370-489` (fixed race condition)
- `components/InputAssetConverter.vue:527-537` (removed auto-convert)
- `components/InputAssetConverter.vue:47-56` (better UI prompts)

**Key Insights**:
- **PNG is lossless**: Canvas re-encoding with quality parameter doesn't help, loses original optimizations
- **Don't trust reactive timing**: Always reload data in critical async functions
- **User education > forced restrictions**: Show clear warnings but let users decide
- **No popups**: Inline error messages are friendlier and more accessible

### 11. Template Naming Rules System
**Problem**: No standardized naming convention for templates across categories
**Solution**:
- Created `/config/template-naming-rules.json` for category-based naming rules
- Integrated naming guidelines in `WorkflowFileManager` component
- Added collapsible UI section showing best practices, examples, and warnings
- Non-blocking soft warnings when names don't match expected patterns

**Naming Convention**:
- **Format**: `snake_case` (underscores, not hyphens)
- **Type Prefixes**:
  - `video_` - Video templates
  - `image_` - Image templates
  - `api_` - API-based templates
  - `utility_` - Utility templates
  - `gs_` - Getting Started templates

**Examples**:
- ✅ Good: `image_portrait_light_migration`, `video_animation_generator`, `api_text_to_image_basic`
- ❌ Bad: `MyTemplate123`, `template-with-hyphens`, `template with spaces`, `ver2.0_template`

**Features**:
- Category-specific prefix rules (e.g., "Use cases" → `image_` prefix)
- Collapsible guidelines section with best practices
- Auto-loads rules from API endpoint on component mount
- Shows amber warnings for naming violations (non-blocking)
- Updates in real-time as user types template name

**Files**:
- Config: `/config/template-naming-rules.json`
- Component: `components/WorkflowFileManager.vue:559-573` (load rules), `90-132` (UI)
- API: `/server/api/config/[name].ts` (serves config)

### 12. Duplicate Template Detection
**Problem**: Users could accidentally overwrite existing templates with same name
**Solution**:
- Implemented comprehensive duplicate detection across ALL categories
- Always checks against `main` branch (not working branch) for accuracy
- Scans entire template library, not just current category
- Shows red warning banner with warning icon when duplicate found

**Features**:
- **Comprehensive Scanning**: Checks all categories in the template library
- **Main Branch Validation**: Always compares against `main` branch templates
- **Flexible Matching**: Matches both `name` field and `file` field (with/without .json)
- **Multi-Category Detection**: Lists all categories where duplicate exists
- **Visual Feedback**: Red warning box with icon and detailed message
- **Real-time Check**: Validates on workflow file upload in create mode
- **Non-Blocking**: User can proceed after seeing warning (informed decision)

**Technical Details**:
- Fetches `templates/index.json` from `main` branch via raw.githubusercontent.com
- Handles both array format (current) and object format (legacy)
- Logs detailed debug info for troubleshooting
- Returns category list when duplicate found

**Warning Message Example**:
```
⚠️ A template with the name "image_flux2" already exists in: Image, Use cases
Please rename your template or proceed to update the existing one.
```

**Files**:
- Component: `components/WorkflowFileManager.vue:598-667` (detection logic), `163-169` (UI)
- UI Integration: Shown in create mode (`templateName === 'new'`)

### 13. Configuration System Unification
**Problem**: Configuration files scattered between `/public/config/` and `/config/` causing inconsistency
**Solution**:
- Unified all configuration files into project root `/config/` directory
- Created dedicated API endpoint to serve configuration files
- Updated all components to fetch from API instead of public folder
- Improved security by restricting access to allowed config files only

**Architecture**:
```
/config/                                    ← Project root configs
  ├── template-naming-rules.json           ← Template naming conventions
  └── workflow-model-config.json           ← Workflow model configuration

/server/api/config/[name].ts               ← API endpoint serving configs
```

**Security Features**:
- Whitelist-based access (only allowed config files can be fetched)
- Server-side file reading (no direct file access from client)
- Cache headers (60s cache for performance)
- Error handling with proper status codes

**API Endpoint**: `GET /api/config/[name].json`
- Allowed configs: `template-naming-rules.json`, `workflow-model-config.json`
- Returns parsed JSON with appropriate cache headers
- Returns 404 for unauthorized config files
- Returns 500 with error message on read failure

**Updated Components**:
1. `WorkflowFileManager.vue` - Template naming rules
2. `WorkflowModelLinksEditor.vue` - Workflow model config
3. `pages/admin/edit/[name].vue` - Workflow model config

**Files**:
- API: `/server/api/config/[name].ts` (new)
- Config 1: `/config/template-naming-rules.json`
- Config 2: `/config/workflow-model-config.json`
- Updates: `WorkflowFileManager.vue:559-573`, `WorkflowModelLinksEditor.vue:462`, `pages/admin/edit/[name].vue:1280`

**Deleted**:
- `/public/config/` directory (removed entirely)

**Benefits**:
- Single source of truth for configuration
- Better security (server-controlled access)
- Easier maintenance (one config per file type)
- Cache optimization with proper headers
- Type-safe with whitelist validation

---

## Data Flow

### Template Update Flow

```
1. User edits form in /admin/edit/[name]
2. User clicks "Save Changes"
3. handleSubmit() collects:
   - Form metadata (title, description, tags, models, etc.)
   - Reuploaded files (workflow, thumbnails) as base64
   - Template order if changed
4. POST /api/github/template/update
5. Server:
   - Authenticates user
   - Gets current commit SHA
   - Loads index.json from GitHub
   - Updates template metadata
   - Updates file tree (index.json, thumbnails, workflow)
   - Creates git commit
   - Updates branch reference
6. Returns commit SHA and URL
7. Redirects to homepage with refresh flag
```

### Thumbnail Conversion Flow

```
1. User clicks Upload button
2. File selected → handleThumbnailReupload()
3. Check if WebP:
   - Yes → Store in reuploadedThumbnails Map, update preview
   - No → Store in converterInitialFile, open dialog
4. In converter:
   - initialFile prop auto-loads the file
   - User adjusts settings (quality, fit mode, crop)
   - Clicks "Convert to WebP"
5. Conversion:
   - Images: Canvas API with high quality smoothing
   - Videos: FFmpeg with lanczos scaling
6. handleConvertedFile() receives File
7. Store in reuploadedThumbnails Map
8. Update preview and file info
9. On save, convert to base64 and upload to GitHub
```

### Workflow Input File Verification Flow

```
1. Page loads workflow content from GitHub
2. WorkflowFileManager component receives workflow JSON string
3. Component parses JSON to extract input file references:
   - Searches for LoadImage, LoadAudio, LoadVideo nodes
   - Extracts filename from widgets_values[0]
   - Creates InputFileRef array with node info
4. For each input file:
   - Checks if file exists in GitHub repo's input/ folder
   - Sets exists flag and retrieves file size
   - Creates preview URL for images
5. UI displays results:
   - Green checkmark for uploaded files
   - Amber warning for missing files
   - Shows file info (size, node ID, type)
6. User can upload missing files:
   - Click upload button for specific file
   - File stored in reuploadedInputFiles Map
   - Updates UI with new file info
7. On save:
   - Convert all reuploaded input files to base64
   - Send to backend API
   - Backend uploads to input/ folder in repo
```

### Input Asset Conversion Flow

```
1. User uploads input file (e.g., PNG or MP4)
2. WorkflowFileManager validates file:
   - Check if WebP: Yes → Direct upload
   - Check if non-WebP image/video: Show warning + "Convert" button
   - Check size: Warn if image > 2MB or video > 4MB
3. User clicks "Convert" button
4. Opens InputAssetConverter dialog with pre-loaded file
5. User configures conversion settings:
   - Format: WebP (best), JPEG (photos), PNG (transparency)
   - Resize: None, %, dimensions, max dimension
   - Quality: 60-100% slider
   - Aspect ratio: Maintain or custom
6. User clicks "Convert & Optimize"
7. Canvas/Image API processes:
   - Loads original image
   - Calculates target dimensions
   - Applies high-quality scaling
   - Compresses to target format
8. Shows before/after comparison:
   - Original size vs converted size
   - Dimensions and savings %
   - Color-coded warning (green/amber/red)
9. Emits converted file to parent
10. WorkflowFileManager receives file:
    - Stores in reuploadedInputFiles Map
    - Updates preview and file info
    - Clears warnings if size OK
11. On save: Uploads to GitHub input/ folder
```

---

## API Endpoints

### GET `/api/config/[name].json`

**Description**: Serves configuration files from the `/config/` directory

**Parameters**:
- `name` (path parameter): Config file name (e.g., `template-naming-rules.json`)

**Allowed Configs**:
- `template-naming-rules.json` - Template naming conventions and best practices
- `workflow-model-config.json` - Workflow model configuration

**Response**:
```typescript
// For template-naming-rules.json
{
  namingRules: {
    [categoryName: string]: {
      prefix: string
      description: string
      example: string
    }
  }
  notes: {
    general: string
    bestPractices: string[]
    examples: {
      good: string[]
      bad: string[]
    }
  }
}

// For workflow-model-config.json
{
  modelTypes: {
    [type: string]: {
      label: string
      description?: string
      urlPatterns?: string[]
    }
  }
}
```

**Headers**:
- `Cache-Control: public, max-age=60` (60-second cache)

**Error Responses**:
- `400` - Config name is required
- `404` - Config not found (not in allowed list)
- `500` - Failed to read config file

**Files**: `/server/api/config/[name].ts`

---

### POST `/api/github/template/update`

**Request Body**:
```typescript
{
  repo: string              // e.g., "Comfy-Org/workflow_templates"
  branch: string            // e.g., "main"
  templateName: string      // e.g., "image_flux2"
  metadata: {
    title?: string
    description?: string
    category?: string       // Category title
    thumbnailVariant?: string
    tags?: string[]
    models?: string[]      // NEW
    tutorialUrl?: string
    comfyuiVersion?: string
    date?: string
  }
  templateOrder?: string[]  // For reordering
  files?: {
    workflow?: {
      content: string      // base64
    }
    thumbnails?: Array<{
      index: number
      content: string      // base64
      filename: string
    }>
    inputFiles?: Array<{
      filename: string     // e.g., "3d_hunyuan3d-v2.1_input_image.png"
      content: string      // base64
    }>
  }
}
```

**Response**:
```typescript
{
  success: boolean
  message: string
  commit: {
    sha: string
    url: string
  }
}
```

---

## Component Props

### ThumbnailConverter.vue

```typescript
interface Props {
  initialFile?: File | null  // Pre-load file
}

emit: {
  converted: [file: File]    // Emits converted WebP file
}
```

### InputAssetConverter.vue

```typescript
interface Props {
  initialFile?: File | null  // Pre-load file
  targetFilename?: string    // Target filename for converted file
}

emit: {
  converted: [file: File]    // Emits converted file (WebP/JPEG/PNG)
}

// Settings:
// - targetFormat: 'webp' | 'jpeg' | 'png'
// - resizeMode: 'none' | 'percentage' | 'dimensions' | 'maxDimension'
// - resizePercentage: 10-100
// - targetWidth/targetHeight: custom dimensions
// - maxDimension: max width/height
// - maintainAspectRatio: boolean
// - quality: 60-100
```

### ThumbnailPreview.vue

```typescript
interface Props {
  variant: string            // 'none' | 'hoverDissolve' | 'compareSlider' | 'zoomHover'
  images: File[]             // Array of File objects
  className?: string
  hoverZoom?: number
}
```

### WorkflowFileManager.vue

```typescript
interface Props {
  templateName: string       // Template name (e.g., "image_flux2")
  repo: string              // GitHub repo (e.g., "Comfy-Org/workflow_templates")
  branch: string            // Git branch (e.g., "main")
  workflowContent?: string  // Workflow JSON string
}

emit: {
  workflowUpdated: [content: string]           // Emits updated workflow JSON string
  inputFilesUpdated: [files: Map<string, File>] // Emits map of filename → File
  openConverter: [file: File, targetFilename: string] // Opens converter for input file
}

exposed: {
  handleConvertedFileReceived: (file: File, originalFilename: string) => void
}
```

---

## Known Issues & Limitations

1. **FFmpeg Loading**: ~31MB download on first use, can take 30s+ to initialize
2. **Browser Support**: FFmpeg requires modern browsers with WebAssembly support
3. **File Size**: Large videos may exceed browser memory limits
4. **Git Operations**: No conflict resolution, assumes linear history
5. **Image Cropping**: Video cropping uses transform matrix, may need validation
6. **SSR Hydration Warnings**: Minor Vue SSR hydration mismatch warnings may appear in browser console during development. These are non-critical and don't affect functionality. SSR is kept enabled for optimal SEO and initial page load performance.

---

## Future Improvements

1. **Batch Operations**: Upload/convert multiple thumbnails at once
2. **Template Duplication**: Clone existing templates
3. **Undo/Redo**: Track changes before saving
4. **Conflict Detection**: Check for concurrent edits
5. **Asset Preview**: Better preview for audio thumbnails
6. **Validation**: Required fields enforcement
7. **Search/Filter**: Find templates by tags, models, category
8. **Analytics**: Track which templates are most popular

---

## Development Commands

```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

---

## Deployment

### Vercel (Recommended)

1. Connect GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy

```bash
npm run deploy:vercel
```

### Manual Deploy

```bash
npm run build
npm run preview  # Test locally first
# Upload .output directory to your host
```

---

## Authentication Flow

1. User clicks "Sign in with GitHub"
2. Redirects to GitHub OAuth
3. User authorizes app
4. Callback to `/api/auth/callback/github`
5. NextAuth creates session with access token
6. Access token used for GitHub API calls
7. Session stored in cookies

---

## Debugging Tips

### Check Browser Console
- FFmpeg loading messages
- File conversion progress
- API errors
- Thumbnail preview URL creation

### Check Network Tab
- GitHub API rate limits
- File upload sizes
- Response times

### Common Issues

**"FFmpeg not loaded"**: Wait for initialization or refresh page

**"Failed to download thumbnail"**: Check file exists in repo at correct path

**"Unauthorized"**: Session expired, sign in again

**"Invalid JSON"**: Workflow file corrupted, download and validate

---

## Browser Tools Available

The project includes MCP (Model Context Protocol) integrations:

- **browser-tools**: Console logs, network logs, screenshots, accessibility audits
- **playwright**: Browser automation for testing
- **figma-mcp**: Figma design integration
- **notionApi**: Notion API integration
- **youtube-transcript**: Extract video transcripts
- **ide**: VS Code diagnostics integration

---

## Git Workflow

The admin commits directly to the selected branch (usually `main`). Each save creates one commit with message:

```
Update template: {templateName}

Updated via ComfyUI Template Manager
```

Commit includes:
- Updated `templates/index.json`
- New/updated workflow JSON (if changed)
- New/updated thumbnails (if changed)
- Deletion of unused thumbnails (if variant changed)

---

## Testing

Currently no automated tests. Manual testing checklist:

- [ ] Sign in with GitHub
- [ ] Load template list
- [ ] Edit template metadata
- [ ] Upload/convert thumbnails
- [ ] Reorder templates
- [ ] Save changes
- [ ] Verify commit on GitHub
- [ ] Download files
- [ ] Preview changes

---

## Security Considerations

1. **Authentication**: GitHub OAuth only, no password storage
2. **Authorization**: User's GitHub token used for all operations (respects repo permissions)
3. **Input Validation**: Basic validation on frontend, relies on GitHub API for safety
4. **File Upload**: Size limits enforced by Nuxt/browser
5. **XSS Prevention**: Vue's template escaping
6. **CORS**: Backend API only, no direct GitHub calls from client

---

## Performance Optimization

1. **FFmpeg Caching**: Loaded once, reused for all conversions
2. **Image Optimization**: High-quality WebP with reasonable compression
3. **Lazy Loading**: Components loaded on demand
4. **SSR**: Initial page load optimized
5. **File URL Caching**: Object URLs cached to prevent memory leaks

---

## Troubleshooting

### FFmpeg fails to load
- Check browser console for errors
- Try different browser (Chrome/Edge recommended)
- Clear cache and reload
- Check internet connection

### Can't save changes
- Check GitHub token permissions
- Verify branch exists
- Check file size limits
- Look for API errors in Network tab

### Thumbnails not showing
- Verify file extension matches mediaSubtype
- Check file exists at expected path
- Clear browser cache
- Inspect thumbnail URL in preview

### Quality issues after conversion
- Increase quality slider (try 95-100)
- Check source file quality
- Use Crop mode for better framing
- Verify target size (400x400 for images)

---

## Contact & Support

For issues, check:
1. Browser console logs
2. Network tab responses
3. GitHub repository settings
4. Environment variables

---

**Last Updated**: 2026-01-16
**Version**: 1.2.0
