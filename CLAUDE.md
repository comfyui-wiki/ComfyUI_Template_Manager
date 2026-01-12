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
  ThumbnailConverter.vue      # Image/video to WebP converter
  ThumbnailPreview.vue        # Preview component with variants
  TemplateCardPreview.vue     # Template card preview

/server/api
  /github
    /template
      update.post.ts          # Update template endpoint

/composables
  useGitHubRepo.ts            # GitHub repo state management

nuxt.config.ts                # Nuxt configuration
package.json                  # Dependencies
```

---

## Configuration

### Environment Variables

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_TOKEN=your_personal_token  # For API access

# NextAuth
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000/api/auth
```

### nuxt.config.ts

Key settings:
- SSR enabled
- Auth: `@sidebase/nuxt-auth` with GitHub provider
- FFmpeg excluded from Vite optimization
- Default repo: `Comfy-Org/workflow_templates`

---

## Recent Implementations

### 1. Merged Upload/Convert Workflow
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

---

## API Endpoints

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

### ThumbnailPreview.vue

```typescript
interface Props {
  variant: string            // 'none' | 'hoverDissolve' | 'compareSlider' | 'zoomHover'
  images: File[]             // Array of File objects
  className?: string
  hoverZoom?: number
}
```

---

## Known Issues & Limitations

1. **FFmpeg Loading**: ~31MB download on first use, can take 30s+ to initialize
2. **Browser Support**: FFmpeg requires modern browsers with WebAssembly support
3. **File Size**: Large videos may exceed browser memory limits
4. **Git Operations**: No conflict resolution, assumes linear history
5. **Image Cropping**: Video cropping uses transform matrix, may need validation

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

**Last Updated**: 2026-01-12
**Version**: 1.0.0
