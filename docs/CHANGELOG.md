# Changelog

All notable changes to the ComfyUI Template CMS will be documented in this file.

## [2026-01-11] - Branch Comparison, Filtering & Permission Enhancement

### Added - Part 4 (Branch-Level Permission System)
- **Branch-Level Permission Checking**: New API and system to check permissions per branch, not just per repository
  - New API endpoint: `/api/github/branch-permission` (server/api/github/branch-permission.get.ts)
  - Checks repository-level permissions (read/write/admin)
  - Checks branch protection rules
  - Detects if user can bypass branch protection
  - Returns detailed permission info: `canPush`, `canCreatePR`, `isProtected`, `protection` details

- **Accurate Edit Permission Display**: Permission status now correctly reflects branch-level access
  - Green checkmark: "Can edit this branch" - user has push access
  - Yellow lock: "Branch protected (use PR)" - branch is protected, need pull request
  - Red lock: "Read-only: No edit permission" - no write access
  - Real-time permission checking when switching branches

- **Improved Permission Logic**: `canEditCurrentRepo` now considers:
  - Repository ownership (user's fork = full access by default)
  - Repository-level permissions (collaborator status)
  - Branch protection rules (even repo owners can't push to protected branches)

### Added - Part 3 (Main Branch Comparison Clarification)
- **Explicit Main Branch Comparison Labels**: All diff status indicators now explicitly show "vs MAIN" to clarify that comparisons are against the main branch
  - Badge text updated: "NEW vs MAIN", "MODIFIED vs MAIN", "DELETED vs MAIN"
  - Stats badges updated: "+X new vs main", "~X modified vs main", "-X deleted vs main"
  - Filter dropdown updated: "New vs Main", "Modified vs Main", "Deleted vs Main", "Identical to Main"
  - Added tooltips on all badges explaining the comparison

### Added - Part 2 (Latest Update)
- **Branch-Specific Thumbnails**: Template thumbnails now load from the currently selected branch instead of always loading from main
  - TemplateCard now accepts `repo` and `branch` props
  - Thumbnails, hover images, and audio files are fetched from the correct branch
  - This allows viewing templates exactly as they appear in each branch

- **Diff Status Filter**: New filter dropdown to show only templates with specific change statuses
  - Filter options: All Changes, New, Modified, Deleted, Unchanged
  - Color-coded indicators (green for new, yellow for modified, red for deleted)
  - Only visible when authenticated and viewing a branch
  - Integrates with existing filters (model, tag, type, search)

### Added - Part 1 (Initial Update)
- **Deleted Template Tracking**: The system now tracks templates that exist in the main branch but are deleted in the current branch
- **Deleted Template Badge**: Added a red "DELETED" badge on template cards that have been removed from the current branch
- **Deleted Count in Stats**: Added a deleted count badge (e.g., "-3 deleted") in the branch comparison stats header

### Changed - Part 4 (Branch-Level Permission System)
- **New API**: `server/api/github/branch-permission.get.ts`
  - Comprehensive branch permission checking
  - Handles repository ownership, collaborator status, and branch protection
  - Returns structured permission data for UI display

- **useGitHubRepo.ts (composables/useGitHubRepo.ts)**:
  - Added `branchPermission` global state (line 11)
  - Added `checkBranchPermission()` method (lines 166-185)
  - Completely rewrote `canEditCurrentRepo` computed property (lines 188-213)
  - Now checks branch-level permissions instead of just repository permissions
  - Distinguishes between user's fork and main repo with different permission logic
  - Exported `branchPermission` and `checkBranchPermission` (lines 252, 262)

- **index.vue (pages/index.vue)**:
  - Imported `branchPermission` and `checkBranchPermission` from useGitHubRepo (lines 376-377)
  - Updated `loadTemplates()` to check branch permissions in parallel with loading templates (lines 407-410)
  - Logs branch permission status for debugging (line 414)

- **RepoAndBranchSwitcher.vue (components/RepoAndBranchSwitcher.vue)**:
  - Imported `branchPermission` from useGitHubRepo (line 155)
  - Enhanced "Current working branch info" section with detailed permission status (lines 96-122)
  - Shows green checkmark for editable branches (lines 97-102)
  - Shows yellow lock for protected branches (lines 103-108)
  - Shows red lock for read-only access (lines 109-114)
  - Added debug permission info section (lines 117-121)

### Changed - Part 3 (Main Branch Comparison Clarification)
- **TemplateCard.vue (components/TemplateCard.vue)**:
  - Updated badge labels to include "vs MAIN" suffix (lines 89, 94, 99)
  - Added title tooltips to all diff status badges explaining comparison context (lines 87, 92, 97)
  - Updated thumbnail/audio URL logic to load from main branch for deleted templates (lines 188-222)
  - Deleted templates now load assets from `Comfy-Org/workflow_templates/main` where they still exist

- **useTemplateDiff.ts (composables/useTemplateDiff.ts)**:
  - Completely rewrote `categoriesWithDiff` computed property (lines 164-217)
  - Now creates a Map of categories from current branch first
  - Then explicitly iterates through deleted templates and adds them to their categories from main branch
  - Creates categories that don't exist in current branch if needed for deleted templates
  - Fixed bug where deleted templates were computed but never shown in UI

- **index.vue (pages/index.vue)**:
  - Updated stats badges to show "vs main" suffix (lines 267, 270, 273)
  - Changed "Up to date with main" to "Identical to main" for clarity (line 276)
  - Added tooltips to all stats badges (lines 266, 269, 272)
  - Updated filter dropdown labels to show "vs Main" suffix (lines 206, 213, 219, 225)
  - Changed placeholder text to "Changes vs Main" (line 206)
  - Changed "All Changes" to "All Templates" (line 209)
  - Increased filter dropdown width to accommodate longer labels (line 205)

### Changed - Part 2 (Latest Update)
- **TemplateCard.vue (components/TemplateCard.vue)**:
  - Added `repo` and `branch` props (lines 176-177)
  - Updated `thumbnailUrl`, `thumbnailUrl2`, and `audioUrl` computed properties to use dynamic repo/branch instead of hardcoded main (lines 188-207)
  - URLs now construct as: `https://raw.githubusercontent.com/${repo}/${branch}/templates/${template.name}-1.webp`

- **index.vue (pages/index.vue)**:
  - Added `selectedDiffStatus` state for diff status filtering (line 366)
  - Added diff status filter dropdown with color-coded options (lines 204-230)
  - Updated `filteredTemplates` to filter by diff status (lines 539-542)
  - Updated `clearFilters` to reset diff status filter (line 582)
  - Updated clear filters button condition to include diff status (line 234)
  - Passed `repo` and `branch` props to all TemplateCard instances (lines 289-290, 313-314)

- **useGitHubRepo.ts (composables/useGitHubRepo.ts)**:
  - Moved state refs outside the composable function to make them global (lines 3-10)
  - Fixed issue where multiple components had separate instances of state
  - Now all components share the same `selectedRepo` and `selectedBranch` refs

- **RepoAndBranchSwitcher.vue (components/RepoAndBranchSwitcher.vue)**:
  - Added `onBranchChange` handler with debug logging (lines 176-179)
  - Added `@update:modelValue` event to branch selector (line 68)

### Changed - Part 1 (Initial Update)
- **useTemplateDiff.ts (composables/useTemplateDiff.ts)**:
  - Updated `compareTemplates` computed property to detect deleted templates by comparing main branch templates against current branch templates (lines 150-159)
  - Enhanced `diffStats` computed property to include a `deleted` counter (line 200)
  - Updated JSDoc comment to reflect the new status type: `'new' | 'modified' | 'unchanged' | 'deleted'` (line 114)

- **TemplateCard.vue (components/TemplateCard.vue)**:
  - Added DELETED status badge with red background (`bg-red-500`) for templates that exist in main but not in current branch (lines 97-101)
  - Updated badge section comment to include DELETED status (line 86)

- **index.vue (pages/index.vue)**:
  - Added deleted count display badge with red styling (`bg-red-100 text-red-800`) in the diff stats section (lines 243-245)
  - Updated "Up to date with main" condition to check for deleted templates as well (line 246)

### Technical Details

#### How it works:
1. When switching to a branch, the system fetches `index.json` from both the current branch and the main branch
2. It creates template maps (name → template object) for both branches for efficient O(1) lookup
3. Templates are categorized into four statuses:
   - **NEW**: Exists in current branch but not in main
   - **MODIFIED**: Exists in both but with different content hash
   - **UNCHANGED**: Exists in both with identical content
   - **DELETED**: Exists in main but not in current branch (newly added)

#### Files Modified:
- `composables/useTemplateDiff.ts` - Core comparison logic
- `components/TemplateCard.vue` - Visual badge display
- `pages/index.vue` - Stats summary display

#### Visual Indicators:
- Green badge: NEW templates
- Yellow badge: MODIFIED templates
- Red badge: DELETED templates

### Bug Fixes - Part 3
1. **Deleted Templates Not Showing in UI**: Fixed critical bug where deleted templates were tracked but not displayed
   - Root cause: `categoriesWithDiff` only rebuilt categories from `currentTemplates`, excluding deleted templates
   - Solution: Updated logic to explicitly add deleted templates from main branch to their respective categories
   - Now deleted templates appear with red "DELETED vs MAIN" badges

2. **Deleted Templates Thumbnails Not Loading**: Fixed issue where deleted templates showed broken image icons
   - Root cause: Thumbnails tried to load from current branch where deleted templates don't exist
   - Solution: Special case for deleted templates - always load their thumbnails from main branch
   - Thumbnails now display correctly for deleted templates

### Bug Fixes - Part 2
1. **Branch Switching Not Working**: Fixed critical bug where branch selection didn't trigger template reload
   - Root cause: State refs were created inside composable function, causing each component to have separate instances
   - Solution: Moved state refs outside composable to make them global and shared across all components

2. **Thumbnails Loading from Wrong Branch**: Fixed issue where thumbnails always loaded from main branch
   - Root cause: Thumbnail URLs were hardcoded to point to main branch
   - Solution: Made TemplateCard accept repo and branch props, construct URLs dynamically

### Why These Changes?
**Part 4 (Branch-Level Permission System)**:
User reported frustration with incorrect permission detection:
> "实际上这个仓库除了主分支,我应该是有写入的权限的,但是现在只是显示我有读取权限"
> (Actually, I should have write permissions for this repository except for the main branch, but it only shows read-only access)

**Problems with the old system**:
1. **Repository-only checks**: Only checked if user had write access to the repository, not specific branches
2. **Ignored branch protection**: Didn't check if branches were protected, leading to false positives
3. **Inaccurate fork detection**: Didn't properly handle user's fork repositories
4. **No real-time feedback**: Users had to guess if they could edit a branch

**Solutions implemented**:
1. **Branch-level permission API**: New endpoint checks repository access + branch protection rules
2. **Smart permission logic**: Distinguishes between main repo (with branch rules) and user's fork (full access)
3. **Visual feedback**: Color-coded status indicators show exact permission state:
   - ✅ Green: Can push directly to this branch
   - 🔒 Yellow: Protected branch, use pull requests
   - 🔒 Red: No write access to repository
4. **Parallel loading**: Permission checks happen alongside template loading for better UX

**Result**: Users now see accurate, branch-specific permissions and understand exactly what actions they can take.

**Part 3 (Main Branch Comparison Clarification)**:
User feedback revealed two critical issues:
1. **Missing deleted templates**: The system tracked deleted templates but didn't display them in the UI. Users couldn't see which templates were removed from their branch.
2. **Unclear comparison context**: Labels like "NEW", "MODIFIED", "DELETED" didn't make it clear that the comparison was against the main branch specifically, not just "new in general".
3. **Broken thumbnails**: Deleted templates tried to load images from the current branch where they no longer existed, resulting in broken images.

The fixes ensure:
- All deleted templates are visible with working thumbnails
- Every label explicitly shows "vs MAIN" to clarify the comparison context
- Users can quickly understand: "This template is NEW compared to main branch"

**Part 1 (Deleted Template Tracking)**:
Previously, when switching to a branch with fewer templates than main, deleted templates were simply not shown, making it unclear which templates were removed. Now users can see:
- Which templates they added (green NEW badge)
- Which templates they modified (yellow MODIFIED badge)
- Which templates they deleted (red DELETED badge)

This provides complete visibility into branch differences and helps users understand exactly what changed compared to the main branch.

**Part 2 (Thumbnails & Filtering)**:
- **Thumbnails**: Users couldn't see branch-specific template previews. If a template's thumbnail changed in a branch, the UI still showed the main branch version. Now thumbnails load from the correct branch.
- **Filtering**: With potentially hundreds of templates, users needed a way to focus on only changed templates. The new diff status filter lets users quickly view only NEW, MODIFIED, or DELETED templates, making code review and branch comparison much faster.
