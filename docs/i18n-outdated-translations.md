# i18n Outdated Translations Tracking

## 概述

当更新模板的英文标题或描述时，系统会自动标记需要更新翻译的字段，方便后续翻译维护。

## 功能说明

### 自动追踪

当你在编辑模式下更新模板的英文 `title` 或 `description` 时：

1. 系统自动检测英文内容是否发生变化
2. 如果发生变化，在 `i18n.json` 的 `_status.outdated_translations` 中标记
3. 记录需要更新的字段（`title` 或 `description`）
4. 记录更新时间

### 数据结构

在 `scripts/i18n.json` 文件中：

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
        "zh": "旧的中文标题",
        "ja": "古い日本語タイトル",
        ...
      },
      "description": {
        "en": "Updated English Description",
        "zh": "旧的中文描述",
        "ja": "古い日本語説明",
        ...
      }
    }
  }
}
```

### 字段说明

- **`fields`**: 数组，包含需要更新的字段名（`"title"` 或 `"description"`）
- **`lastUpdated`**: ISO 8601 格式的时间戳，记录最后更新时间

## 使用流程

### 1. 编辑模板（触发标记）

```typescript
// 用户在管理界面编辑模板
// 修改英文标题: "Old Title" → "New Title"
// 保存更改
```

系统自动：
- 更新 `templates.template_name.title.en` 为新值
- 在 `_status.outdated_translations.templates.template_name` 中添加：
  ```json
  {
    "fields": ["title"],
    "lastUpdated": "2026-01-18T10:30:00Z"
  }
  ```

### 2. 查看需要更新的翻译

查询 `_status.outdated_translations.templates` 获取所有需要翻译更新的模板：

```javascript
// 读取 i18n.json
const i18nData = JSON.parse(fs.readFileSync('scripts/i18n.json', 'utf-8'))

// 获取所有需要更新的模板
const outdatedTemplates = i18nData._status.outdated_translations.templates

// 遍历
for (const [templateName, info] of Object.entries(outdatedTemplates)) {
  console.log(`Template: ${templateName}`)
  console.log(`  Fields to update: ${info.fields.join(', ')}`)
  console.log(`  Last updated: ${info.lastUpdated}`)
}
```

输出示例：
```
Template: image_flux2
  Fields to update: title, description
  Last updated: 2026-01-18T10:30:00Z

Template: video_animation_gen
  Fields to update: description
  Last updated: 2026-01-17T15:20:00Z
```

### 3. 更新翻译

翻译人员根据标记更新对应语言的翻译：

```json
{
  "templates": {
    "image_flux2": {
      "title": {
        "en": "New English Title",
        "zh": "新的中文标题",      // 更新
        "ja": "新しい日本語タイトル", // 更新
        ...
      }
    }
  }
}
```

### 4. 清除标记

翻译完成后，手动从 `outdated_translations.templates` 中删除对应条目：

```json
{
  "_status": {
    "outdated_translations": {
      "templates": {
        // "image_flux2": { ... }  // 删除这个条目
      }
    }
  }
}
```

或者使用脚本批量清除：

```javascript
// 清除特定模板的标记
delete i18nData._status.outdated_translations.templates['image_flux2']

// 保存
fs.writeFileSync('scripts/i18n.json', JSON.stringify(i18nData, null, 2))
```

### 5. 运行 Python 同步脚本

```bash
cd /path/to/workflow_templates
python scripts/sync_data.py --templates-dir ./templates
```

Python 脚本会：
- 读取 `i18n.json` 中的翻译
- 应用到所有语言的 `index.*.json` 文件
- 保持 `outdated_translations` 状态不变（需要手动清理）

## 示例场景

### 场景 1: 更新标题

**操作**:
```
编辑模板 "image_portrait" 的英文标题
旧: "Portrait Generator"
新: "Professional Portrait Generator"
```

**结果**:
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
        "zh": "肖像生成器",  // 需要更新
        "ja": "ポートレートジェネレーター"  // 需要更新
      }
    }
  }
}
```

### 场景 2: 同时更新标题和描述

**操作**:
```
编辑模板 "video_animation"
更新英文标题和描述
```

**结果**:
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

### 场景 3: 只更新技术字段（不触发标记）

**操作**:
```
编辑模板 "image_flux2"
只更新 models, tutorialUrl, comfyuiVersion
不修改 title 或 description
```

**结果**:
- `outdated_translations` 不变
- 技术字段正常同步到所有语言文件

## 工作流程图

```
用户编辑模板
    ↓
检测 title/description 是否变化?
    ↓ 是
更新 i18n.json 中的英文值
    ↓
在 outdated_translations 中标记
    ↓
同步到所有语言文件（保留旧翻译）
    ↓
Git commit
    ↓
翻译人员查看 outdated_translations
    ↓
更新 i18n.json 中的翻译
    ↓
手动删除 outdated_translations 标记
    ↓
运行 sync_data.py
    ↓
翻译应用到所有语言文件
```

## Tags 翻译处理

### 自动翻译逻辑

系统使用 `i18n.json` 中的 `tags` 映射来自动翻译 tags：

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

**创建/更新模板时**：
- 英文版本：使用原始 tag 名称（如 `"Portrait"`）
- 其他语言：从 `i18n.json` 查找对应翻译（如中文使用 `"肖像"`）
- 如果找不到翻译，使用英文作为 fallback

### 新 Tag 的处理

当添加新 tag 时，系统自动：
1. 检查 tag 是否在 `i18n.json` 中存在
2. 如果不存在，为所有 11 种语言创建英文占位符：
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
3. 记录日志：`✓ Added new tag to i18n.json: NewTag`

翻译人员后续可以更新这些占位符为实际翻译。

## 注意事项

1. **不自动清除标记**: 翻译完成后需要手动清除标记，避免误删
2. **只追踪 title 和 description**: tags 变化不会标记为 outdated，因为 tags 自动使用 i18n.json 映射
3. **新 tags 自动添加**: 创建/更新模板时，新 tags 会自动添加到 i18n.json（英文占位）
4. **不影响现有流程**: Python `sync_data.py` 脚本正常工作，不受影响
5. **时间戳为服务器时间**: 使用 ISO 8601 格式，便于排序和筛选
6. **首次创建不标记**: 新模板首次创建时不会进入 `outdated_translations`

## API 日志示例

### 更新标题和描述

当更新模板时，控制台会显示：

```
[Update Template] Syncing updated template to all locale files...
✓ Detected English title update for image_flux2
✓ Marked image_flux2 as needing translation update for: title
[Update Template] Marked English updates in i18n.json for translation review
[Update Template] Synced template to 11 locale file(s)
```

### 添加新 Tags

当添加新 tags 时：

```
[Update Template] Syncing updated template to all locale files...
✓ Added new tag to i18n.json: NewFeature
✓ Added new tag to i18n.json: Experimental
[Update Template] Marked English updates in i18n.json for translation review
[Update Template] Synced template to 11 locale file(s)
```

### Tags 翻译日志

更新模板时，tags 会自动翻译：

```
[Update Template] Syncing template to zh: index.zh.json
  - Tag "Portrait" → "肖像"
  - Tag "Video" → "视频"
[Update Template] Syncing template to ja: index.ja.json
  - Tag "Portrait" → "ポートレート"
  - Tag "Video" → "ビデオ"
```

## 相关文件

- **核心逻辑**: `/server/utils/i18n-sync.ts` - `trackOutdatedTranslations()`
- **更新 API**: `/server/api/github/template/update.post.ts`
- **配置文件**: `/config/i18n-config.json`
- **翻译数据**: `/path/to/workflow_templates/scripts/i18n.json`

## 未来改进

1. **自动清除机制**: 检测翻译完成度，自动清除已翻译的标记
2. **翻译状态统计**: 显示翻译完成百分比
3. **批量翻译工具**: 提供 Web UI 批量更新翻译
4. **翻译历史记录**: 保留英文变更历史
