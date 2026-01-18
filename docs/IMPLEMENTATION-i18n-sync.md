# i18n Synchronization Implementation

## Overview

Implemented automatic multi-language synchronization for ComfyUI Template Manager. When creating or updating templates, the system now automatically syncs changes across all 11 supported language files and updates the i18n.json translation database.

## Implementation Date

2026-01-18

## Supported Languages

1. English (en) - default
2. Simplified Chinese (zh)
3. Traditional Chinese (zh-TW)
4. Japanese (ja)
5. Korean (ko)
6. Spanish (es)
7. French (fr)
8. Russian (ru)
9. Turkish (tr)
10. Arabic (ar)
11. Brazilian Portuguese (pt-BR)

## Files Created/Modified

### Created Files

1. **`server/utils/i18n-sync.ts`** - Core i18n synchronization utility
   - `loadI18nConfig()` - Loads i18n configuration
   - `syncTemplateToAllLocales()` - Syncs new templates to all locale files
   - `updateI18nJson()` - Updates i18n.json with translation placeholders
   - `syncUpdatedTemplateToAllLocales()` - Syncs template updates (edit mode)

### Modified Files

1. **`server/api/config/[name].ts`**
   - Added `i18n-config.json` to allowed configs

2. **`server/api/github/template/create.post.ts`**
   - Added i18n sync for new template creation
   - Syncs template data to all 11 locale index files
   - Updates i18n.json with English placeholders

3. **`server/api/github/template/update.post.ts`**
   - Added i18n sync for template updates
   - Syncs technical fields while preserving existing translations
   - Handles category moves correctly

## How It Works

### Two-Stage Translation Workflow

#### Stage 1: Node.js API (Automatic)
When creating/updating a template:

1. **Template Creation/Update** → Updates English `index.json`
2. **i18n Sync** → Automatically syncs to all locale files:
   - `index.json` (English)
   - `index.zh.json` (Chinese)
   - `index.ja.json` (Japanese)
   - ... (all 11 languages)
3. **i18n.json Update** → Adds template with English placeholders:
   ```json
   {
     "templates": {
       "new_template": {
         "title": {
           "en": "My Template",
           "zh": "My Template",  // English placeholder
           "ja": "My Template",  // English placeholder
           ...
         }
       }
     }
   }
   ```

#### Stage 2: Python Script (Manual)
For proper translations (existing workflow):

1. **Manual Translation** → Translator updates i18n.json with real translations
2. **Run sync_data.py** → Python script applies translations to all locale files
3. **Result** → All languages display proper translations

### Field Categories

#### Auto-Sync Fields (Technical)
These fields are automatically synchronized across all languages without translation:
- `name`
- `models`
- `date`
- `size`
- `vram`
- `mediaType`
- `mediaSubtype`
- `tutorialUrl`
- `thumbnailVariant`
- `requiresCustomNodes`
- `usage`
- `searchRank`
- `openSource`
- `comfyuiVersion`

#### Translatable Fields
These fields are added to i18n.json for manual translation:
- `title` (template title)
- `description` (template description)
- `tags` (tag names)
- `category` (category titles)

### Create Template Flow

```
User creates template
       ↓
1. Update index.json (English)
       ↓
2. Sync to all locale files (11 files)
   - Add template with English placeholders
   - All technical fields copied as-is
       ↓
3. Update i18n.json
   - Add template entry with English placeholders
   - Add new tag placeholders if needed
       ↓
4. Git commit (13+ files)
   - 1 index.json
   - 11 locale index files
   - 1 i18n.json
   - workflow.json
   - thumbnails
   - input files
```

### Update Template Flow

```
User updates template
       ↓
1. Update index.json (English)
       ↓
2. Sync to all locale files (11 files)
   - Update technical fields only
   - Preserve existing translations
   - Update tags (will be re-translated by sync_data.py)
       ↓
3. Git commit (12+ files)
   - 1 index.json
   - 11 locale index files
   - updated files
```

## API Changes

### POST `/api/github/template/create`

**New Behavior:**
- Creates template in English `index.json`
- Automatically syncs to all 11 locale files
- Updates `i18n.json` with translation placeholders
- Commits all files atomically

**No API changes required** - existing requests work as before

### POST `/api/github/template/update`

**New Behavior:**
- Updates template in English `index.json`
- Automatically syncs technical fields to all locale files
- Preserves existing translations (title, description)
- Handles category moves correctly

**No API changes required** - existing requests work as before

## Configuration

### i18n-config.json

```json
{
  "supportedLocales": [
    {
      "code": "en",
      "name": "English",
      "indexFile": "index.json",
      "isDefault": true
    },
    ...
  ],
  "translatableFields": {
    "template": ["title", "description", "tags"],
    "category": ["title", "category"]
  },
  "autoSyncFields": {
    "fields": [
      "name", "models", "date", "size", "vram",
      "mediaType", "mediaSubtype", "tutorialUrl",
      "thumbnailVariant", "requiresCustomNodes",
      "usage", "searchRank", "openSource", "comfyuiVersion"
    ]
  }
}
```

## Benefits

1. **Consistency** - All locale files always have the same templates
2. **No Missing Entries** - New templates immediately available in all languages
3. **Atomic Updates** - All files updated in single commit
4. **Preserves Translations** - Edit mode doesn't overwrite existing translations
5. **Graceful Degradation** - English fallback if translation doesn't exist
6. **Compatible** - Works with existing Python sync_data.py workflow

## Error Handling

- i18n sync failures don't block template creation/update
- Errors logged to console with detailed stack traces
- Missing locale files are skipped with warnings
- Invalid locale data is skipped with warnings
- Continues processing remaining locales on error

## Testing

### Test Create Template

1. Create a new template with:
   - Title: "Test Template"
   - Description: "This is a test"
   - Tags: ["Test", "Example"]
2. Check that:
   - Template appears in all 11 locale files
   - i18n.json has template entry with English placeholders
   - All technical fields are identical across locales

### Test Update Template

1. Update an existing template's:
   - Models list
   - Tutorial URL
   - Tags
2. Check that:
   - Technical fields updated in all locale files
   - Translations preserved (title/description in non-English locales)
   - Tags remain in English (will be translated by Python script)

## Future Improvements

1. **Batch Operations** - Optimize multiple template operations
2. **Conflict Resolution** - Handle concurrent edits
3. **Translation Status** - Show which templates need translation
4. **Auto-Translation** - Optional AI-powered translation suggestions
5. **Validation** - Check translation completeness before commit

## Troubleshooting

### Issue: Locale file not updated
**Cause:** File doesn't exist or has invalid format
**Solution:** Check console logs, verify locale file exists and is valid JSON

### Issue: i18n.json not updated
**Cause:** Error reading or parsing i18n.json
**Solution:** Check console logs, verify i18n.json structure

### Issue: Translations overwritten
**Cause:** Bug in update logic
**Solution:** Verify `syncUpdatedTemplateToAllLocales` preserves translations

## Related Files

- `/config/i18n-config.json` - Configuration
- `/server/utils/i18n-sync.ts` - Core logic
- `/Users/linmoumou/Documents/comfy/workflow_templates/scripts/sync_data.py` - Python sync script
- `/Users/linmoumou/Documents/comfy/workflow_templates/scripts/i18n.json` - Translation database

## Documentation

- See `TODO-i18n-sync.md` for original planning
- See `CLAUDE.md` for updated project documentation
