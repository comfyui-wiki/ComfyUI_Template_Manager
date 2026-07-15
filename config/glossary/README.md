# Translation Glossary

Preferred terminology for AI translation in Template Manager.

Aligned with the docs i18n glossary design
(`comfy/docs/.github/scripts/i18n/glossary`).

## Layout

```
config/glossary/
  frontend/          Machine mirror of ComfyUI frontend locales (auto-sync)
                     Do not hand-edit — rebuilt by pnpm glossary:sync
  overrides/         Hand-maintained preferred terms (committed)
                     ({lang}.json with terms + ignore)
```

## Sync from ComfyUI frontend

Set the locales path in `.env` (not in committed config):

```bash
FRONTEND_LOCALES_PATH=/path/to/ComfyUI_frontend/src/locales
```

Then:

```bash
# Dry-run: report term counts only
pnpm glossary:sync:dry-run

# Write config/glossary/frontend/{lang}.json
pnpm glossary:sync

# One language / one-off override path
pnpm glossary:sync -- --lang zh
pnpm glossary:sync -- --frontend /tmp/other-locales
```

Resolution order:

1. `--frontend <path>` (CLI one-off)
2. `FRONTEND_LOCALES_PATH` from the environment or `.env` / `.env.local`

Harvests `main.json`, `nodeDefs.json` (`display_name`), `settings.json`, `commands.json`
from matching keys in `en/` vs each target locale. Filters stopwords / sentences /
placeholders. **Never touches `overrides/`.**

## Override file shape

```json
{
  "terms": {
    "text-to-image": "文生图",
    "custom node": "自定义节点"
  },
  "ignore": ["title", "status", "custom"]
}
```

- `terms`: English keyword → preferred translation (wins over frontend mirror)
- `ignore`: drop noisy frontend words from injection

## Runtime behavior

1. Load `frontend/{lang}.json` (if present) then apply `overrides/{lang}.json`
2. On each AI translate request, scan English source for whole-word hits
3. Prefer longer phrases: drop shorter terms whose spans are fully covered by a longer keep
4. Inject remaining hits longest-first (capped at 25) as a soft "Preferred terminology" block
5. Model may still choose natural phrasing when a literal substitution fits poorly

Example: with both `custom node` and `node` in the glossary, `Add a custom node`
injects only `custom node`. A lone extra `node` elsewhere in the same sentence still injects `node`.

Wired into:

- `POST /api/ai/translate/single`
- `POST /api/ai/translate/batch`
- `POST /api/ai/translate/multi-lang`

## Translation Manager: glossary mismatch filter

Opening Translation Manager loads curated override maps via `GET /api/glossary/maps?layer=overrides`.

- Filter **Glossary mismatch**: rows where English hits a glossary term but the preferred translation is missing from that locale cell
- Orange cell highlight + status badge; hover shows `en → preferred`
- Re-translate with single-cell AI Translate or select + Batch Translate (glossary is already injected into AI prompts)

Mismatch checks use **overrides only** by default (low noise). Pass `layer=effective` on the API to include the frontend mirror as well.

Batch bar includes a **Glossary mismatches only** scope: only languages with a mismatch on each selected row are sent to AI Translate (not the full row). Switching the filter to Glossary mismatch turns this scope on by default.

## Editing tips

- Prefer multi-word phrases (`image to video`) so they win over shorter tokens
- Keep product names English when that is the product decision (`ComfyUI`, `LoRA`)
- Use `ignore` for frontend UI noise that slips past the sync filter
- After editing override JSON or re-syncing frontend, restart the dev server
  (glossary map is cached in-process)
