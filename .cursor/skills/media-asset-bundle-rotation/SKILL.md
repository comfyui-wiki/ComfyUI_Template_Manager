---
name: media-asset-bundle-rotation
description: >-
  Keeps ComfyUI Template Manager in sync when the workflow_templates library
  freezes a filled media-assets shard and opens the next one (01→02, 02→03, …).
  Use when the user mentions media-assets-NN, 资源包, freeze/冻结 a media bundle,
  PyPI 100 MB wheel limit, recommendedAssetBundle, or bundle-mapping-rules.json.
---

# Media asset bundle rotation

PyPI wheels have a ~100 MB per-file limit. When the **active** asset shard
(`media-assets-NN`) is near that size, the template library freezes it and opens
`media-assets-(NN+1)` for **new** thumbnails, input media, and additive logos.

This repo does **not** own the package. It only decides which bundle the admin UI
assigns. Always read the template library first, then mirror it here.

## Source of truth

Template library (typical local clone: `WORKFLOW_TEMPLATES_PATH` or
`/Users/linmoumou/Documents/comfy/workflow_templates`):

| File | What to read |
|------|----------------|
| `scripts/data/version_policy.json` | `recommended_asset_bundle`, `additive_logo_bundle`, `frozen_packages` / `frozen_bundles` |
| `bundles.json` | Keys present; new templates go under the recommended id |
| `scripts/docs/frozen_bundles.md` | Policy text |
| `packages/media_assets_NN/` | Package exists for the new shard |

If the local clone lags, check GitHub `Comfy-Org/workflow_templates` (open PRs titled like “Freeze media-assets-NN and add media-assets-(NN+1)”). Example: PR #1268 opened `media-assets-02`.

Do **not** invent a new shard in this admin repo before the library has the package, `bundles.json` key, and policy update (merged or an explicit in-flight PR the user wants to follow).

## What Template Manager must change

Primary config: `config/bundle-mapping-rules.json`.

1. Set `recommendedAssetBundle` and `defaultBundle` to the **new** id (`media-assets-(NN+1)`).
2. Point **every** `categoryMapping` value at that same new id.
3. Add the **old** active id to `frozenBundles` (keep all previous frozen ids: `media-api`, `media-image`, `media-video`, `media-other`, plus earlier `media-assets-*`).
4. Under `bundles`:
   - Old shard: `"frozen": true` plus a `frozenReason` (near PyPI 100 MB; include pinned version and wheel size if known).
   - New shard: `"frozen": false`, label `Media Assets NN`, `pypiPackage` `comfyui-workflow-templates-media-assets-NN`.
5. Refresh `notes.categoryMapping` so it names the new recommended id.

Hardcoded fallbacks (must match `recommendedAssetBundle`, not a stale shard):

- `server/utils/bundles.ts` → `getRecommendedAssetBundle()` last fallback
- `components/BundleSelector.vue` → `recommendedAssetBundle` ref and API fallback

Do **not** bulk-migrate existing templates out of frozen shards. `resolveTargetBundle` / `assignTemplateToBundle` already:

- refuse assigning **new** templates onto a frozen id
- keep a template on a frozen id if that is already its current assignment
- create a missing `bundles.json` key for the recommended id on save

`components/BundleSelector.vue` should keep saying that frozen bundles (legacy `media-*` and filled asset shards) are not selectable for **new** templates.

## After editing

- New templates and new media → recommended shard only.
- Templates already on frozen shards stay put unless the user explicitly migrates one.
- Local clone without the new `packages/media_assets_NN` yet: saving still writes the new key into `bundles.json`; warn that the library PR/package must land before a release publish.
- New shard often has no PyPI wheel yet; status UI showing “Published size unavailable” is expected.

## Do not

- Change `media-api` / `media-image` / `media-video` / `media-other` except to keep them frozen.
- Treat `bundles.json` assignment as UI category order (`templates/index.json` is display).
- Hardcode only `media-assets-02` as eternal. Next rotation is the same steps with `NN+1`.

## Quick check

```bash
rg -n 'recommendedAssetBundle|media-assets-' config/bundle-mapping-rules.json server/utils/bundles.ts components/BundleSelector.vue
```

Recommended id, default, all category mappings, and TS/Vue fallbacks must agree. Frozen list must include every previous asset shard.
