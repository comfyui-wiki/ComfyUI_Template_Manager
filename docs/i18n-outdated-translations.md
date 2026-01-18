# i18n Outdated Translations Tracking

## Overview

When updating the English title or description of a template, the system automatically marks fields that need translation updates, facilitating subsequent translation maintenance.

## Feature Description

### Automatic Tracking

When you update the English `title` or `description` of a template in edit mode:

1. The system automatically detects if the English content has changed
2. If changed, it marks the entry in `_status.outdated_translations` of `i18n.json`
3. Records the fields that need updating (`title` or `description`)
4. Records the update time

### Data Structure

In the `scripts/i18n.json` file:

```json
{
  "_status": {
    "comment": "Pending translation tasks. Only templates with missing translations appear here.",
    "pending_templates": {},
    "vram_size_update_templates": {
      "comment": "Templates that need vram and size data management in i18n.json",
      "templates": []
    },
    "outdated_translations": {
      "comment": "Templates with English updates that need translation review",
      "templates": {
        "template_name": {
          "fields": ["title", "description"],
          "lastUpdated": "2026-01-18T10:30:00Z"
        }
      }
    }
  },
  "templates": {
    "template_name": {
      "title": {
        "en": "Updated English Title",
        "zh": "Old Chinese Title",
        "ja": "古い日本語タイトル",
        ...
      },
      "description": {
        "en": "Updated English Description",
        "zh": "Old Chinese Description",
        "ja": "古い日本語説明",
        ...
      }
    }
  }
}
```

### Field Descriptions

- **`fields`**: Array containing the field names that need updating (`"title"` or `"description"`)
- **`lastUpdated`**: ISO 8601 formatted timestamp recording the last update time

## Usage Process

### 1. Edit Template (Trigger Marking)

```typescript
// User edits template in admin interface
// Modify English title: "Old Title" → "New Title"
// Save changes
```

System automatically:
- Updates `templates.template_name.title.en` to the new value
- Adds to `_status.outdated_translations.templates.template_name`:
  ```json
  {
    "fields": ["title"],
    "lastUpdated": "2026-01-18T10:30:00Z"
  }
  ```

### 2. View Translation Updates Needed

Query `_status.outdated_translations.templates` to get all templates that need translation updates:

```javascript
// Read i18n.json
const i18nData = JSON.parse(fs.readFileSync('scripts/i18n.json', 'utf-8'))

// Get all templates that need updates
const outdatedTemplates = i18nData._status.outdated_translations.templates

// Iterate
for (const [templateName, info] of Object.entries(outdatedTemplates)) {
  console.log(`Template: ${templateName}`)
  console.log(`  Fields to update: ${info.fields.join(', ')}`)
  console.log(`  Last updated: ${info.lastUpdated}`)
}
```

Example output:
```
Template: image_flux2
  Fields to update: title, description
  Last updated: 2026-01-18T10:30:00Z

Template: video_animation_gen
  Fields to update: description
  Last updated: 2026-01-17T15:20:00Z
```

### 3. Update Translations

Translators update corresponding language translations based on the markings:

```json
{
  "templates": {
    "image_flux2": {
      "title": {
        "en": "New English Title",
        "zh": "New Chinese Title",      // Updated
        "ja": "新しい日本語タイトル", // Updated
        ...
      }
    }
  }
}
```

### 4. Clear Markings

After translation is complete, manually remove the corresponding entries from `outdated_translations.templates`:

```json
{
  "_status": {
    "outdated_translations": {
      "templates": {
        // "image_flux2": { ... }  // Remove this entry
      }
    }
  }
}
```

Or use a script to clear in bulk:

```javascript
// Clear markings for specific template
delete i18nData._status.outdated_translations.templates['image_flux2']

// Save
fs.writeFileSync('scripts/i18n.json', JSON.stringify(i18nData, null, 2))
```

### 5. Run Python Sync Script

```bash
cd /path/to/workflow_templates
python scripts/sync_data.py --templates-dir ./templates
```

The Python script will:
- Read translations from `i18n.json`
- Apply to all language `index.*.json` files
- Keep `outdated_translations` status unchanged (manual cleanup needed)

## Example Scenarios

### Scenario 1: Update Title

**Operation**:
```
Edit English title of template "image_portrait"
Old: "Portrait Generator"
New: "Professional Portrait Generator"
```

**Result**:
```json
{
  "_status": {
    "outdated_translations": {
      "templates": {
        "image_portrait": {
          "fields": ["title"],
          "lastUpdated": "2026-01-18T10:30:00Z"
        }
      }
    }
  },
  "templates": {
    "image_portrait": {
      "title": {
        "en": "Professional Portrait Generator",
        "zh": "肖像生成器",  // Needs update
        "ja": "ポートレートジェネレーター"  // Needs update
      }
    }
  }
}
```

### Scenario 2: Update Title and Description Simultaneously

**Operation**:
```
Edit template "video_animation"
Update English title and description
```

**Result**:
```json
{
  "_status": {
    "outdated_translations": {
      "templates": {
        "video_animation": {
          "fields": ["title", "description"],
          "lastUpdated": "2026-01-18T11:00:00Z"
        }
      }
    }
  }
}
```

### Scenario 3: Update Technical Fields Only (Does Not Trigger Marking)

**Operation**:
```
Edit template "image_flux2"
Only update models, tutorialUrl, comfyuiVersion
Don't modify title or description
```

**Result**:
- `outdated_translations` remains unchanged
- Technical fields normally sync to all language files

## Workflow Diagram

```
User edits template
    ↓
Detect if title/description changed?
    ↓ Yes
Update English values in i18n.json
    ↓
Mark in outdated_translations
    ↓
Sync to all language files (preserve old translations)
    ↓
Git commit
    ↓
Translators view outdated_translations
    ↓
Update translations in i18n.json
    ↓
Manually remove outdated_translations marking
    ↓
Run sync_data.py
    ↓
Translations applied to all language files
```

## Tags Translation Processing

### Automatic Translation Logic

The system uses the `tags` mapping in `i18n.json` to automatically translate tags:

```json
{
  "tags": {
    "Portrait": {
      "en": "Portrait",
      "zh": "肖像",
      "ja": "ポートレート",
      "ko": "초상화"
    }
  }
}
```

**When creating/updating templates**:
- English version: Use original tag name (e.g., `"Portrait"`)
- Other languages: Look up corresponding translation from `i18n.json` (e.g., Chinese uses `"肖像"`)
- If translation not found, use English as fallback

### New Tag Processing

When adding a new tag, the system automatically:
1. Checks if the tag exists in `i18n.json`
2. If not, creates English placeholders for all 11 languages:
   ```json
   {
     "tags": {
       "NewTag": {
         "en": "NewTag",
         "zh": "NewTag",
         "ja": "NewTag",
         ...
       }
     }
   }
   ```
3. Log: `✓ Added new tag to i18n.json: NewTag`

Translators can subsequently update these placeholders with actual translations.

## Notes

1. **No automatic clearing of markings**: After translation is complete, markings need to be cleared manually to avoid accidental deletion
2. **Only track title and description**: Tag changes won't be marked as outdated because tags automatically use i18n.json mapping
3. **New tags automatically added**: When creating/updating templates, new tags are automatically added to i18n.json (English placeholders)
4. **Doesn't affect existing workflows**: Python `sync_data.py` script works normally, unaffected
5. **Timestamps are server time**: Using ISO 8601 format, convenient for sorting and filtering
6. **First creation doesn't mark**: Newly created templates won't enter `outdated_translations` on first creation

## API Log Examples

### Updating Title and Description

When updating a template, the console will display:

```
[Update Template] Syncing updated template to all locale files...
✓ Detected English title update for image_flux2
✓ Marked image_flux2 as needing translation update for: title
[Update Template] Marked English updates in i18n.json for translation review
[Update Template] Synced template to 11 locale file(s)
```

### Adding New Tags

When adding new tags:

```
[Update Template] Syncing updated template to all locale files...
✓ Added new tag to i18n.json: NewFeature
✓ Added new tag to i18n.json: Experimental
[Update Template] Marked English updates in i18n.json for translation review
[Update Template] Synced template to 11 locale file(s)
```

### Tags Translation Log

When updating templates, tags are automatically translated:

```
[Update Template] Syncing template to zh: index.zh.json
  - Tag "Portrait" → "肖像"
  - Tag "Video" → "视频"
[Update Template] Syncing template to ja: index.ja.json
  - Tag "Portrait" → "ポートレート"
  - Tag "Video" → "ビデオ"
```

## Related Files

- **Core Logic**: `/server/utils/i18n-sync.ts` - `trackOutdatedTranslations()`
- **Update API**: `/server/api/github/template/update.post.ts`
- **Configuration Files**: `/config/i18n-config.json`
- **Translation Data**: `/path/to/workflow_templates/scripts/i18n.json`

## Future Improvements

1. **Automatic clearing mechanism**: Detect translation completion rate, automatically clear translated markings
2. **Translation status statistics**: Display translation completion percentage
3. **Bulk translation tool**: Provide Web UI for bulk translation updates
4. **Translation history records**: Maintain English change history
