# i18n Tags Translation Feature

## Overview

The system now supports automatic tag translation based on i18n.json mappings, ensuring that tags in all language files use the correct localized names.

## Feature Characteristics

### 1. Automatic Tag Translation

When creating or updating a template, the system will:
- Read the `tags` mapping from `i18n.json`
- Automatically translate tags according to the target language
- Use English as fallback if translation is not found

**Example**:

i18n.json:
```json
{
  "tags": {
    "Portrait": {
      "en": "Portrait",
      "zh": "肖像",
      "ja": "ポートレート",
      "ko": "초상화"
    },
    "Video": {
      "en": "Video",
      "zh": "视频",
      "ja": "ビデオ",
      "ko": "비디오"
    }
  }
}
```

When template tags are `["Portrait", "Video"]`:
- `index.json` (en): `["Portrait", "Video"]`
- `index.zh.json` (zh): `["肖像", "视频"]`
- `index.ja.json` (ja): `["ポートレート", "ビデオ"]`
- `index.ko.json` (ko): `["초상화", "비디오"]`

### 2. Automatic Addition of New Tags

When creating/updating a template and using a new tag, the system will:
1. Check if the tag exists in i18n.json
2. If not, automatically add the tag and create English placeholders for all languages
3. Record log notification

**Example**:

Adding new tag "AIGenerated":

```json
{
  "tags": {
    "AIGenerated": {
      "en": "AIGenerated",
      "zh": "AIGenerated",
      "ja": "AIGenerated",
      "ko": "AIGenerated",
      "es": "AIGenerated",
      "fr": "AIGenerated",
      "ru": "AIGenerated",
      "tr": "AIGenerated",
      "ar": "AIGenerated",
      "pt-BR": "AIGenerated",
      "zh-TW": "AIGenerated"
    }
  }
}
```

Subsequently, translators can update these placeholders with actual translations.

## Implementation Details

### Core Functions

#### `translateTag(tag, targetLang, i18nData)`
Translate a single tag to the target language.

**Parameters**:
- `tag`: English tag name
- `targetLang`: Target language code (e.g., 'zh', 'ja')
- `i18nData`: i18n.json data

**Return Value**: Translated tag (returns original tag if translation not found)

#### `translateTags(tags, targetLang, i18nData)`
Translate an array of tags.

**Parameters**:
- `tags`: English tag array
- `targetLang`: Target language code
- `i18nData`: i18n.json data

**Return Value**: Translated tag array

### Template Creation Process

```typescript
// server/utils/i18n-sync.ts - syncTemplateToAllLocales()

for (const locale of config.supportedLocales) {
  const newTemplate = { ...templateData }

  // Translate tags
  if (!locale.isDefault && templateData.tags) {
    newTemplate.tags = translateTags(templateData.tags, locale.code, i18nData)
  }

  // Add to locale file
  localeData[categoryIndex].templates.push(newTemplate)
}
```

Add new tags in `updateI18nJson()`:
```typescript
// Check and add new tags
if (templateData.tags) {
  for (const tag of templateData.tags) {
    if (!i18nData.tags[tag]) {
      i18nData.tags[tag] = {}
      for (const langCode of allLangCodes) {
        i18nData.tags[tag][langCode] = tag // English placeholder
      }
    }
  }
}
```

### Template Update Process

```typescript
// server/utils/i18n-sync.ts - syncUpdatedTemplateToAllLocales()

for (const locale of config.supportedLocales) {
  const updatedTemplate = { ...existingTemplate }

  // Update tags
  if (templateData.tags) {
    if (locale.code === 'en') {
      updatedTemplate.tags = templateData.tags
    } else {
      updatedTemplate.tags = translateTags(templateData.tags, locale.code, i18nData)
    }
  }
}
```

Add new tags in `trackOutdatedTranslations()`:
```typescript
// Sync new tags to i18n.json
if (newTags && newTags.length > 0) {
  for (const tag of newTags) {
    if (!i18nData.tags[tag]) {
      i18nData.tags[tag] = {}
      for (const langCode of allLangCodes) {
        i18nData.tags[tag][langCode] = tag // English placeholder
      }
    }
  }
}
```

## Compatibility with Python Scripts

This feature is fully compatible with the existing Python `sync_data.py` script:

1. **Same data structure**: Uses the same i18n.json format
2. **Same translation source**: Both read translations from i18n.json tag mappings
3. **No conflicts**: Node.js API handles technical data synchronization, Python script handles manual translation application
4. **Complementary work**: API adds English placeholders, Python script applies translated values

### Workflow

```
1. User creates/updates template (Node.js API)
   ↓
2. System synchronizes template to all language files
   - English version: original tags
   - Other languages: translated from i18n.json (if available)
   ↓
3. New tags automatically added to i18n.json (English placeholders)
   ↓
4. Translators update tag translations in i18n.json
   ↓
5. Run sync_data.py
   ↓
6. Tags in all language files updated with correct translations
```

## Advantages

### 1. Consistency
- Tags in all language files always use the same translation strategy
- Avoids inconsistencies caused by manual maintenance

### 2. Automation
- New tags automatically added to i18n.json
- No need to manually create tag mappings

### 3. Fallback Mechanism
- Uses English if translation is missing
- Won't interrupt the process due to missing translations

### 4. Maintainability
- Single source of truth (i18n.json)
- Convenient for batch updates and management

### 5. Compatibility
- Doesn't break existing Python scripts
- Can gradually improve translations

## Log Output

### Creating Template
```
[Create Template] Syncing template to all locale files...
✓ Added new tag to i18n.json: NewTag
✓ Synced template to en: index.json
✓ Synced template to zh: index.zh.json
✓ Synced template to ja: index.ja.json
...
[Create Template] Synced template to 11 locale file(s)
[Create Template] Updated i18n.json with translation placeholders
```

### Updating Template
```
[Update Template] Syncing updated template to all locale files...
✓ Added new tag to i18n.json: Experimental
✓ Updated template in en: index.json
✓ Updated template in zh: index.zh.json
...
[Update Template] Synced template to 11 locale file(s)
```

## Troubleshooting

### Problem: Tags are not being translated

**Possible Causes**:
1. Tag mapping missing from i18n.json
2. Translation value missing for target language

**Solutions**:
1. Check if the tag exists in i18n.json
2. Confirm the target language has corresponding translation values
3. If it's a new tag, wait for the system to automatically add English placeholders
4. Update translations in i18n.json
5. Re-run sync_data.py

### Problem: New tag not added to i18n.json

**Possible Causes**:
1. i18n.json file read failure
2. Permission issues
3. JSON format error

**Solutions**:
1. Check console logs for error information
2. Verify i18n.json format is correct
3. Confirm GitHub token has write permissions

## Related Files

- **Core Logic**: `server/utils/i18n-sync.ts`
  - `translateTag()` - Translate single tag
  - `translateTags()` - Translate tag array
  - `syncTemplateToAllLocales()` - Synchronize when creating template
  - `syncUpdatedTemplateToAllLocales()` - Synchronize when updating template
  - `updateI18nJson()` - Add new tags to i18n.json
  - `trackOutdatedTranslations()` - Track changes and add new tags

- **API Endpoints**:
  - `server/api/github/template/create.post.ts` - Create template
  - `server/api/github/template/update.post.ts` - Update template

- **Configuration Files**:
  - `config/i18n-config.json` - i18n configuration
  - `scripts/i18n.json` - Translation database (in workflow_templates repository)

## Future Improvements

1. **Bulk Tag Management**: Web UI for bulk editing tag translations
2. **Translation Suggestions**: AI-assisted generation of tag translation suggestions
3. **Translation Status Statistics**: Show which tags still need translation
4. **Tag Aliases**: Support for tag aliases and synonyms
5. **Automatic Detection**: Detect unused tags and clean up
