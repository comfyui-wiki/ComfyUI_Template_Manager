# i18n Tags 翻译功能

## 概述

系统现在支持基于 i18n.json 映射的 tags 自动翻译功能，确保所有语言文件中的 tags 都使用正确的本地化名称。

## 功能特性

### 1. 自动翻译 Tags

创建或更新模板时，系统会：
- 读取 `i18n.json` 中的 `tags` 映射
- 根据目标语言自动翻译 tags
- 如果找不到翻译，使用英文作为 fallback

**示例**：

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

模板 tags 为 `["Portrait", "Video"]` 时：
- `index.json` (en): `["Portrait", "Video"]`
- `index.zh.json` (zh): `["肖像", "视频"]`
- `index.ja.json` (ja): `["ポートレート", "ビデオ"]`
- `index.ko.json` (ko): `["초상화", "비디오"]`

### 2. 自动添加新 Tags

当创建/更新模板并使用新 tag 时，系统会：
1. 检查 tag 是否在 i18n.json 中存在
2. 如果不存在，自动添加该 tag 并为所有语言创建英文占位符
3. 记录日志通知

**示例**：

添加新 tag "AIGenerated"：

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

后续翻译人员可以更新这些占位符为实际翻译。

## 实现细节

### 核心函数

#### `translateTag(tag, targetLang, i18nData)`
翻译单个 tag 到目标语言。

**参数**:
- `tag`: 英文 tag 名称
- `targetLang`: 目标语言代码（如 'zh', 'ja'）
- `i18nData`: i18n.json 数据

**返回值**: 翻译后的 tag（如果找不到翻译则返回原始 tag）

#### `translateTags(tags, targetLang, i18nData)`
翻译 tag 数组。

**参数**:
- `tags`: 英文 tag 数组
- `targetLang`: 目标语言代码
- `i18nData`: i18n.json 数据

**返回值**: 翻译后的 tag 数组

### 创建模板流程

```typescript
// server/utils/i18n-sync.ts - syncTemplateToAllLocales()

for (const locale of config.supportedLocales) {
  const newTemplate = { ...templateData }

  // 翻译 tags
  if (!locale.isDefault && templateData.tags) {
    newTemplate.tags = translateTags(templateData.tags, locale.code, i18nData)
  }

  // 添加到 locale 文件
  localeData[categoryIndex].templates.push(newTemplate)
}
```

在 `updateI18nJson()` 中添加新 tags：
```typescript
// 检查并添加新 tags
if (templateData.tags) {
  for (const tag of templateData.tags) {
    if (!i18nData.tags[tag]) {
      i18nData.tags[tag] = {}
      for (const langCode of allLangCodes) {
        i18nData.tags[tag][langCode] = tag // 英文占位符
      }
    }
  }
}
```

### 更新模板流程

```typescript
// server/utils/i18n-sync.ts - syncUpdatedTemplateToAllLocales()

for (const locale of config.supportedLocales) {
  const updatedTemplate = { ...existingTemplate }

  // 更新 tags
  if (templateData.tags) {
    if (locale.code === 'en') {
      updatedTemplate.tags = templateData.tags
    } else {
      updatedTemplate.tags = translateTags(templateData.tags, locale.code, i18nData)
    }
  }
}
```

在 `trackOutdatedTranslations()` 中添加新 tags：
```typescript
// 同步新 tags 到 i18n.json
if (newTags && newTags.length > 0) {
  for (const tag of newTags) {
    if (!i18nData.tags[tag]) {
      i18nData.tags[tag] = {}
      for (const langCode of allLangCodes) {
        i18nData.tags[tag][langCode] = tag // 英文占位符
      }
    }
  }
}
```

## 与 Python 脚本的兼容性

这个功能完全兼容现有的 Python `sync_data.py` 脚本：

1. **数据结构相同**: 使用相同的 i18n.json 格式
2. **翻译来源相同**: 都从 i18n.json 的 tags 映射读取翻译
3. **不冲突**: Node.js API 负责同步技术数据，Python 脚本负责应用人工翻译
4. **互补工作**: API 添加英文占位符，Python 脚本应用翻译后的值

### 工作流程

```
1. 用户创建/更新模板（Node.js API）
   ↓
2. 系统同步模板到所有语言文件
   - 英文版本：原始 tags
   - 其他语言：从 i18n.json 翻译（如果有）
   ↓
3. 新 tags 自动添加到 i18n.json（英文占位）
   ↓
4. 翻译人员更新 i18n.json 中的 tag 翻译
   ↓
5. 运行 sync_data.py
   ↓
6. 所有语言文件中的 tags 更新为正确翻译
```

## 优势

### 1. 一致性
- 所有语言文件中的 tags 始终使用相同的翻译策略
- 避免手动维护导致的不一致

### 2. 自动化
- 新 tags 自动添加到 i18n.json
- 无需手动创建 tag 映射

### 3. Fallback 机制
- 如果翻译缺失，使用英文
- 不会因为缺失翻译而中断流程

### 4. 可维护性
- 单一真实来源（i18n.json）
- 便于批量更新和管理

### 5. 兼容性
- 不破坏现有 Python 脚本
- 可以逐步完善翻译

## 日志输出

### 创建模板
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

### 更新模板
```
[Update Template] Syncing updated template to all locale files...
✓ Added new tag to i18n.json: Experimental
✓ Updated template in en: index.json
✓ Updated template in zh: index.zh.json
...
[Update Template] Synced template to 11 locale file(s)
```

## 故障排除

### 问题：Tags 没有被翻译

**可能原因**:
1. i18n.json 中缺少该 tag 的映射
2. 目标语言的翻译值缺失

**解决方案**:
1. 检查 i18n.json 中是否有该 tag
2. 确认目标语言有对应的翻译值
3. 如果是新 tag，等待系统自动添加英文占位符
4. 更新 i18n.json 中的翻译
5. 重新运行 sync_data.py

### 问题：新 tag 没有添加到 i18n.json

**可能原因**:
1. i18n.json 文件读取失败
2. 权限问题
3. JSON 格式错误

**解决方案**:
1. 检查控制台日志查看错误信息
2. 验证 i18n.json 格式是否正确
3. 确认 GitHub token 有写入权限

## 相关文件

- **核心逻辑**: `server/utils/i18n-sync.ts`
  - `translateTag()` - 翻译单个 tag
  - `translateTags()` - 翻译 tag 数组
  - `syncTemplateToAllLocales()` - 创建模板时同步
  - `syncUpdatedTemplateToAllLocales()` - 更新模板时同步
  - `updateI18nJson()` - 添加新 tags 到 i18n.json
  - `trackOutdatedTranslations()` - 追踪变化并添加新 tags

- **API 端点**:
  - `server/api/github/template/create.post.ts` - 创建模板
  - `server/api/github/template/update.post.ts` - 更新模板

- **配置文件**:
  - `config/i18n-config.json` - i18n 配置
  - `scripts/i18n.json` - 翻译数据库（在 workflow_templates 仓库中）

## 未来改进

1. **批量 Tag 管理**: Web UI 批量编辑 tag 翻译
2. **翻译建议**: AI 辅助生成 tag 翻译建议
3. **翻译状态统计**: 显示哪些 tags 还需要翻译
4. **Tag 别名**: 支持 tag 别名和同义词
5. **自动检测**: 检测未使用的 tags 并清理
