# Preset Picker Redesign

## Problem

The current preset picker displays 15+ presets in a flat 2-column grid where all top-tier presets have equal visual weight. Descriptions are truncated to one line and unreadable. The 4 presets benchmarked across multiple novel prompts (kimi-coder, qwen-trinity, glm-nemotron, deepseek-coder) are indistinguishable from presets tested only on the rate limiter. Solo presets are squeezed into a scrollable pill row that's easy to miss.

## Solution

Approach B: "Single Grid, Visual Weight" — one continuous scrollable flow with three sections of decreasing visual density. Card size and information density communicate importance. No tabs, no hidden content.

## Data Model Changes

### `WaterfallPresetMeta` type updates

Replace `tier` with `category`:

```ts
category: 'recommended' | 'top' | 'solo' | 'demo'
```

- `recommended` — 4 presets benchmarked across 4 prompts: kimi-coder, qwen-trinity, glm-nemotron, deepseek-coder
- `top` — 7 presets tested on rate limiter: silk-road, glm-speed, glm-kimi, groq-speed, kimi-duo, deepseek-kimi, ollama-ultima
- `solo` — 7 single-model presets
- `demo` — reliable preset

Add `tagline` field (short string, 3-8 words) for UI display. Keep `description` for expand/tooltip use.

Change `speed` from union type `'~30s' | '~1-2m' | '~2-3m' | '~5m+'` to plain `string`.

Remove all `p.score` references in `WaterfallVisualizer.tsx` (pre-existing type errors).

### Taglines for recommended presets

| Preset | Tagline |
|---|---|
| kimi-coder | Most consistent across all prompts |
| qwen-trinity | Fastest quality preset |
| glm-nemotron | Reliable across all prompt types |
| deepseek-coder | Best for standard patterns |

## Layout Structure

Three sections in one continuous scroll inside the existing `glass-panel`:

### 1. Recommended (top, most prominent)

- Section label: "RECOMMENDED" (uppercase, `#64748b`, 10px, 800 weight) with helper text "benchmarked across 4 prompts" (`#475569`, 9px)
- 4 full-width rows, each containing:
  - Default dot: 4-5px purple circle, kimi-coder only
  - Name: `#e2e8f0` (selected) or `#cbd5e1`, 11px, 800 weight
  - Tagline: `#64748b`, 9px, preceded by em dash
  - Speed: green (`#34d399`) for `~2-3m` or faster, slate (`#475569`) for `~5m+`
  - Grade badge: existing color system (green A-range, sky B-range)
  - Pipeline models: `#334155`, 8px, arrow-separated: `Kimi K2.5 → Qwen3 Coder+ → Nemotron`
- Row height: ~40px, compact
- Row styling:
  - Default: `rgba(255,255,255,0.015)` bg, `1px solid rgba(255,255,255,0.06)` border, `border-radius: 8px`
  - Hover: lighten border to `rgba(255,255,255,0.15)`
  - Selected: `rgba(157,91,210,0.06)` bg, `rgba(157,91,210,0.2)` border, subtle purple shadow
- kimi-coder is pre-selected as the default
- Expand behavior: small chevron on each row. Clicking expands a slim panel below for provider swapping (stage icon + stage name + provider toggle pills). Only shows stages that have cross-provider alternatives. Uses existing `AnimatePresence` slide animation. Does NOT re-show model names (already visible in the row).

### 2. Top Tier (middle, compact)

- Section label: "TOP TIER" (same label style)
- 2-column grid of minimal cards (7 presets = 3 full rows + 1 half row)
- Each card shows: name (left, `#94a3b8`, 9px, 700 weight) + grade badge (right)
- Card styling: `rgba(255,255,255,0.015)` bg, `rgba(255,255,255,0.04)` border, `border-radius: 6px`, padding `6px 8px`
- Hover: lighten border. Selected: purple treatment matching recommended rows.
- Expand: same slim provider-swap panel as recommended section
- No taglines — name + grade is sufficient for secondary picks

### 3. Solo (bottom, lightest)

- Section label: "SOLO" with helper text "single model, all stages"
- 3-column grid of mini pills
- Each pill: model name only in `#64748b`, 8px, 600 weight
- Pill styling: `rgba(255,255,255,0.02)` bg, `rgba(255,255,255,0.04)` border, `border-radius: 5px`, padding `4px 6px`, center-aligned
- No grade badges (all untested, grade is `null`)
- Clicking selects (purple border, text brightens to `#94a3b8`). No expand needed — single model, single provider.

### Custom button

Stays in the header bar, same position and behavior as current. Toggling custom mode replaces the three sections with the existing `CustomStageRow` interface.

### Footer

Keep: "Scores from automated pipeline benchmarks - results may vary" with Trophy icon.

## Files to Modify

1. **`frontend/src/lib/waterfallPresets.ts`** — Update `WaterfallPresetMeta` interface (add `category`, `tagline`, change `speed` type, remove `tier`). Update all preset entries with new `category` and `tagline` values.

2. **`frontend/src/components/waterfall/WaterfallPresetPicker.tsx`** — Rewrite the main layout. Replace 2-col grid + pill row with three-section flow. Update `PresetCard` to become `RecommendedRow` (full-width). Add `TopTierCard` (compact 2-col) and `SoloPill` (3-col mini). Update expand panel to show only provider-swap toggles without re-showing model names. Update filtering logic from `p.tier` to `p.category`.

3. **`frontend/src/components/WaterfallVisualizer.tsx`** — Remove broken `p.score` references. Update `tier` references to `category`. Use `tagline` for display where `description` was used.

4. **`frontend/src/components/waterfall/WaterfallFlowPreview.tsx`** — Update any `tier` references to `category`.

## What This Does NOT Change

- Backend `WATERFALL_PRESETS` in `models.ts` — no structural changes needed, backend doesn't use `category` or `tagline`
- Custom mode UI — stays as-is
- Model availability warnings / upgrade suggestions — same logic, same display within expand panels
- Cross-provider model mapping — stays as-is
- Store types / state management — `waterfallPresetKey` and `waterfallModelSelection` unchanged
