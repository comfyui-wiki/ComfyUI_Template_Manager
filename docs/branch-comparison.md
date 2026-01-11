# Branch Comparison Feature

## Overview

The branch comparison feature allows users to see exactly how their current branch differs from the main branch (`Comfy-Org/workflow_templates/main`). This is particularly useful when working on feature branches or forks.

## Features

### Template Status Indicators

Each template is automatically compared with the main branch and assigned one of four statuses:

| Status | Badge Color | Meaning |
|--------|------------|---------|
| **NEW** | Green | Template exists in current branch but not in main |
| **MODIFIED** | Yellow | Template exists in both branches but has different content |
| **DELETED** | Red | Template exists in main branch but not in current branch |
| **UNCHANGED** | No badge | Template is identical in both branches |

### Visual Indicators

#### Template Card Badges
Each template card displays a badge in the top-left corner if it has been modified:
- Green "NEW" badge for newly added templates
- Yellow "MODIFIED" badge for changed templates
- Red "DELETED" badge for removed templates

#### Stats Summary
The header displays a summary of changes:
```
owner/repo / branch-name  +5 new  ~3 modified  -2 deleted
```

When there are no changes, it shows:
```
✓ Up to date with main
```

## Implementation

### Architecture

The comparison system is built on three main components:

#### 1. useTemplateDiff Composable
**File**: `composables/useTemplateDiff.ts`

**Key Functions**:
- `loadCurrentTemplates(owner, repo, branch)` - Loads templates from both current and main branch in parallel
- `compareTemplates` - Computed property that performs the diff comparison
- `categoriesWithDiff` - Computed property that returns categories with enriched template data
- `diffStats` - Computed property that returns counts: `{ new, modified, deleted, unchanged }`

**Comparison Algorithm**:
```typescript
1. Fetch index.json from current branch
2. Fetch index.json from main branch (Comfy-Org/workflow_templates/main)
3. Create Map<templateName, template> for both branches (O(1) lookup)
4. For each template in current branch:
   - If not in main → status = 'new'
   - If in main but different hash → status = 'modified'
   - If in main and same hash → status = 'unchanged'
5. For each template in main branch:
   - If not in current → status = 'deleted'
```

**Hash Comparison**:
Templates are hashed using the `ohash` library. The hash includes:
- title
- description
- thumbnail
- models
- tags
- openSource
- audio
- hoverThumbnail

This ensures that any meaningful change to a template is detected.

#### 2. TemplateCard Component
**File**: `components/TemplateCard.vue`

Receives a template prop with a `diffStatus` property and displays the appropriate badge:
```vue
<div v-if="template.diffStatus === 'new'" class="absolute top-2 left-2 z-10">
  <span class="px-2 py-1 text-xs font-bold bg-green-500 text-white rounded shadow-lg">
    NEW
  </span>
</div>
```

#### 3. Main Page
**File**: `pages/index.vue`

- Uses the `useTemplateDiff()` composable
- Displays `diffStats` in the header
- Passes enriched templates (with `diffStatus`) to `TemplateCard` components
- Watches for branch changes and reloads comparisons automatically

### Data Flow

```
User switches branch
       ↓
pages/index.vue watches selectedBranch
       ↓
Calls useTemplateDiff.loadCurrentTemplates()
       ↓
Fetches index.json from current & main branches in parallel
       ↓
compareTemplates computed property runs
       ↓
Creates template maps and performs comparison
       ↓
categoriesWithDiff enriches templates with diffStatus
       ↓
TemplateCard components receive enriched templates
       ↓
Badges displayed based on diffStatus
```

## Usage

### For Users

1. **Switch branches** using the Repository & Branch selector in the left sidebar
2. **View changes** - Templates with badges indicate differences from main
3. **Check stats** - Look at the header to see a summary of all changes (+X new, ~X modified, -X deleted)
4. **Filter by status** - Use the "Changes" dropdown to show only templates with specific statuses:
   - All Changes (default)
   - New (green) - Only templates added in this branch
   - Modified (yellow) - Only templates changed in this branch
   - Deleted (red) - Only templates removed from this branch
   - Unchanged - Only templates identical to main
5. **Branch-specific previews** - Thumbnails automatically load from the current branch, so you see exactly how templates look in each branch

### For Developers

To use the comparison in your own components:

```typescript
import { useTemplateDiff } from '~/composables/useTemplateDiff'

const {
  loadCurrentTemplates,
  categoriesWithDiff,
  diffStats,
  isLoading,
  error
} = useTemplateDiff()

// Load templates for comparison
await loadCurrentTemplates('owner', 'repo', 'branch')

// Use the enriched data
console.log(diffStats.value) // { new: 5, modified: 3, deleted: 2, unchanged: 100 }
console.log(categoriesWithDiff.value) // Categories with templates including diffStatus
```

## Performance Considerations

- **Parallel Loading**: Both current and main branch templates are fetched in parallel using `Promise.all()`
- **Efficient Lookup**: Uses `Map` data structure for O(1) template lookup by name
- **Computed Properties**: Comparisons are cached and only recompute when data changes
- **Lazy Loading**: Main branch templates are cached after first load

## Edge Cases

### When is a template considered deleted?

A template is marked as deleted when:
- It exists in `Comfy-Org/workflow_templates/main`
- It does NOT exist in the current branch
- The template will still be displayed in the UI with a red "DELETED" badge

### What if I'm viewing the main branch itself?

When viewing `Comfy-Org/workflow_templates/main`, all templates will have status "unchanged" since there's nothing to compare against (current branch IS main branch).

### What about renamed templates?

If a template is renamed:
- The old name will show as "DELETED" (exists in main, not in current)
- The new name will show as "NEW" (exists in current, not in main)

This is by design, as the system compares by template name, not by content similarity.

## Recent Enhancements (2026-01-11)

### Branch-Specific Thumbnails
Previously, template thumbnails always loaded from the main branch, even when viewing a different branch. This made it impossible to preview branch-specific changes to images.

**Now**: Thumbnails dynamically load from the currently selected repository and branch:
```typescript
// TemplateCard now accepts repo and branch props
<TemplateCard
  :repo="selectedRepo"
  :branch="selectedBranch"
  :template="template"
/>

// URLs are constructed dynamically
const thumbnailUrl = computed(() => {
  const repo = props.repo || 'Comfy-Org/workflow_templates'
  const branch = props.branch || 'main'
  return `https://raw.githubusercontent.com/${repo}/${branch}/templates/${template.name}-1.webp`
})
```

### Diff Status Filter
Added a new "Changes" filter dropdown that allows filtering templates by their diff status:
- **All Changes**: Show all templates (default)
- **New**: Show only templates added in the current branch
- **Modified**: Show only templates that were changed
- **Deleted**: Show only templates that were removed
- **Unchanged**: Show only templates identical to main

This filter:
- Appears only when authenticated and viewing a branch
- Works alongside existing filters (model, tag, type, search)
- Has color-coded visual indicators matching the badges
- Helps focus on specific types of changes during code review

### Global State Management Fix
Fixed critical bug where branch switching didn't work:
- **Problem**: Each component had its own copy of `selectedBranch` state
- **Solution**: Moved state refs outside the composable function to make them global
- **Result**: All components now share the same state, and branch changes properly trigger template reloads

## Future Enhancements

Potential improvements for the future:
- [ ] Side-by-side diff view for modified templates
- [ ] Click on badge to see detailed changes
- [x] Filter by diff status (show only new, modified, or deleted) ✅ **Implemented**
- [ ] Export diff report as JSON or markdown
- [ ] Compare against branches other than main
- [ ] Smart rename detection using content similarity
- [x] Branch-specific thumbnail loading ✅ **Implemented**
