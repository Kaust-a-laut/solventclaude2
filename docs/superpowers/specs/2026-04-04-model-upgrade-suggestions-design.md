# Model Upgrade Suggestions — Design Spec

## Goal

Surface actionable "newer model available" suggestions to users in the waterfall pipeline UI, so they're aware of new options without auto-swapping anything. Builds on the existing `modelAvailabilityService` availability scanner.

## Core Principles

1. **Suggestion-only, never auto-swap.** Newer isn't always better (Kimi K2 outperforms K2.5 in some pipelines). The user always pulls the trigger.
2. **Dismissible.** Once dismissed, a suggestion doesn't come back.
3. **Two urgency tiers.** Soft blue suggestions for "newer exists, old still works." Amber warnings (already built) for "model is offline."
4. **Ship simple, iterate later.** No config files, no alias systems, no hardcoded upgrade maps. Just prefix matching against live provider data.

## Architecture

```
modelAvailabilityService.scan()
  ├── existing: check preset models against provider lists → unavailable[]
  └── new: prefix-match preset models against provider lists → upgrades[]
         │
         ▼
GET /api/v1/health/models → { unavailable, upgrades, scanErrors, scannedAt }
         │
         ▼
WaterfallPresetPicker (frontend)
  ├── sonner toast on mount (max 3, dismissible)
  └── inline blue badge on preset cards + expanded model view
         │
         ▼
localStorage: solvent:dismissed-upgrades (persist dismiss state)
```

## Backend

### Prefix Matching

Added to `modelAvailabilityService.scan()` as a second pass after the existing availability check.

**Logic:**
1. For each unique `provider:model` pair used in presets, extract a prefix — the model name stripped of version-like suffixes (numbers, dots, size tags like `480b`).
2. Search that same provider's cached model list for other models sharing the prefix that aren't already referenced by any preset.
3. If matches found, emit an `UpgradeSuggestion`.

**Prefix extraction:** Simple string manipulation — strip trailing version segments. Examples:
- `qwen3.5:cloud` → prefix `qwen` on ollama
- `qwen/qwen3-32b` → prefix `qwen/qwen3` on groq
- `meta-llama/llama-3.3-70b-instruct:free` → prefix `meta-llama/llama` on openrouter

The prefix extraction intentionally casts a wider net. False positives are fine — they get dismissed once by the user. False negatives (missing a real upgrade) are worse.

**Scope:** Only checks models within the same provider. Cross-provider suggestions (e.g., "Qwen 3.6 is on OpenRouter, try it instead of Qwen 3.5 on Ollama") are out of scope for v1.

### Types

```ts
interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;           // auto-generated, e.g. "qwen3.6-plus available on openrouter"
  usedInPresets: string[]; // preset keys referencing the current model
}
```

### Scan Result Extension

The existing `AvailabilityScanResult` gains one field:

```ts
interface AvailabilityScanResult {
  scannedAt: string;
  unavailable: ModelStatus[];
  upgrades: UpgradeSuggestion[];  // ← new
  scanErrors: string[];
}
```

No new endpoints. Same `GET /api/v1/health/models` returns both.

## Frontend

### Toast on Launch

When `WaterfallPresetPicker` mounts, the existing fetch to `/health/models` now also receives `upgrades`. For each non-dismissed suggestion (max 3 toasts to avoid spam):

- Fire a sonner toast with info styling (blue-tinted, distinct from amber warnings)
- Message: **"Qwen 3.6 Plus available on OpenRouter"** — "Used by: GLM Speed, Groq Speed"
- Actions: `[Dismiss]` — writes to localStorage, toast disappears

### Inline Badge on Preset Card

Same visual pattern as the amber offline warnings, but blue/info-toned:

- On the preset card: `⬆ 1 upgrade available` (or `⬆ N upgrades available`)
- In the expanded model view: the specific model row gets a blue indicator showing the successor name
- No swap button in v1 — just awareness. User can switch to Custom mode and pick the new model manually.

### Dismiss State

- **Key:** `solvent:dismissed-upgrades`
- **Value:** JSON array of strings, each formatted as `"provider:currentModel→successorModel"`
- **Checked:** Before showing any toast or badge. If the suggestion's key is in the dismissed list, skip it.
- **No expiry** for v1. Dismissed means dismissed permanently.
- **Cleared:** Not automatically. User would need to clear localStorage manually (or we add a "reset suggestions" button later).

## Files Changed

| File | Change |
|------|--------|
| `backend/src/services/modelAvailabilityService.ts` | Add prefix extraction, upgrade detection pass, `UpgradeSuggestion` type, extend scan result |
| `backend/src/constants/models.ts` | Export `UpgradeSuggestion` interface (shared type) |
| `frontend/src/components/waterfall/WaterfallPresetPicker.tsx` | Add upgrade badge to PresetCard, toast on mount, dismiss logic, localStorage interaction |

## Out of Scope (v1)

- Cross-provider upgrade suggestions (Qwen 3.5 Ollama → Qwen 3.6 OpenRouter)
- Curated/manual upgrade map or config file
- Model family alias system
- Auto-swap or one-click swap button
- Expiry on dismissed suggestions
- Admin UI for managing suggestions

## Future Iteration

After v1 ships and we see how prefix matching works in practice:
- Add a swap-to-custom action button if users want it
- Consider cross-provider suggestions via optional config file
- Add a "reset dismissed suggestions" button in settings
- Explore provider-side alias/pointer patterns if naming conventions stabilize
