# Preset Picker Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the preset picker from a flat 2-column grid + pill row into a three-section layout (Recommended / Top Tier / Solo) with decreasing visual density.

**Architecture:** Data model adds `category` and `tagline` fields, replaces `tier`. The picker component is rewritten with three section renderers sharing the existing expand/provider-swap infrastructure. `WaterfallVisualizer.tsx` compact picker gets the same `tier→category` migration plus `p.score` bug fixes.

**Tech Stack:** React, Tailwind CSS, framer-motion (AnimatePresence), Zustand store, lucide-react icons.

---

### Task 1: Update data model in `waterfallPresets.ts`

**Files:**
- Modify: `frontend/src/lib/waterfallPresets.ts`

- [ ] **Step 1: Update the `WaterfallPresetMeta` interface**

Replace the interface with the new fields:

```ts
export interface WaterfallPresetMeta {
  key: string;
  name: string;
  description: string;
  tagline: string;             // 3-8 word summary for UI display
  grade: string | null;        // Letter grade (A+ through D-). null = untested.
  speed: string;               // e.g. '~30s', '~1-2m', '~2-3m', '~5m+'
  category: 'recommended' | 'top' | 'solo' | 'demo';
  selection: PresetSelection;
  stageLabels: Record<'planner' | 'executor' | 'reviewer', string>;
}
```

Changes from current:
- `tier: 'top' | 'standard' | 'demo'` → `category: 'recommended' | 'top' | 'solo' | 'demo'`
- `speed` union type → plain `string`
- Added `tagline: string`

- [ ] **Step 2: Update all preset entries**

Update each preset's `tier` → `category` and add `tagline`. Here are the category assignments:

**Recommended (4):**
- `kimi-coder`: `category: 'recommended'`, `tagline: 'Most consistent across all prompts'`
- `qwen-trinity`: `category: 'recommended'`, `tagline: 'Fastest quality preset'`
- `glm-nemotron`: `category: 'recommended'`, `tagline: 'Reliable across all prompt types'`
- `deepseek-coder`: `category: 'recommended'`, `tagline: 'Best for standard patterns'`

**Top (7):**
- `silk-road`: `category: 'top'`, `tagline: 'All open-weight SOTA'`
- `glm-speed`: `category: 'top'`, `tagline: 'GLM planning with Groq speed'`
- `glm-kimi`: `category: 'top'`, `tagline: 'GLM-Kimi-Qwen trio'`
- `groq-speed`: `category: 'top'`, `tagline: 'Ultra-fast all-Groq'`
- `kimi-duo`: `category: 'top'`, `tagline: 'Dual Kimi with Qwen review'`
- `deepseek-kimi`: `category: 'top'`, `tagline: 'Max thoroughness'`
- `ollama-ultima`: `category: 'top'`, `tagline: 'Largest models, max depth'`

**Solo (7):**
All solo presets get `category: 'solo'` and a tagline that is just the provider name or speed trait:
- `solo-gemini-pro`: `tagline: 'Gemini 3 Pro'`
- `solo-gemini-flash`: `tagline: 'Gemini 3 Flash'`
- `solo-gpt-oss`: `tagline: 'GPT-OSS via Groq'`
- `solo-qwen36`: `tagline: 'Qwen 3.6 Plus'`
- `solo-glm`: `tagline: 'GLM-4.7'`
- `solo-kimi-k2.5`: `tagline: 'Kimi K2.5'`
- `solo-kimi-k2`: `tagline: 'Kimi K2 via Groq'`

**Demo (1):**
- `reliable`: `category: 'demo'`, `tagline: 'Zero failures, consistent output'`

Also reorder the array so `kimi-coder` is first among recommended presets (it already is).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -40`

Expected: Type errors in files that still reference `tier` (WaterfallPresetPicker.tsx, WaterfallVisualizer.tsx). These are fixed in subsequent tasks. The `waterfallPresets.ts` file itself should have zero errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/waterfallPresets.ts
git commit -m "refactor(presets): replace tier with category, add tagline field"
```

---

### Task 2: Fix `WaterfallVisualizer.tsx` — remove `p.score`, migrate `tier→category`

**Files:**
- Modify: `frontend/src/components/WaterfallVisualizer.tsx`

- [ ] **Step 1: Fix the `CompactPresetPicker` filtering**

Change lines 145-146 from:

```tsx
const topPresets = WATERFALL_PRESET_LIST.filter((p) => p.tier === 'top');
const otherPresets = WATERFALL_PRESET_LIST.filter((p) => p.tier !== 'top');
```

To use `category` — show recommended + top in the main list, solo + demo in the "other" row:

```tsx
const mainPresets = WATERFALL_PRESET_LIST.filter((p) => p.category === 'recommended' || p.category === 'top');
const otherPresets = WATERFALL_PRESET_LIST.filter((p) => p.category === 'solo' || p.category === 'demo');
```

- [ ] **Step 2: Fix the `p.score` references**

Lines 189-194 reference `p.score` which doesn't exist on `WaterfallPresetMeta`. Replace with `p.grade`:

Change the score display inside the `topPresets.map()` callback (now `mainPresets.map()`):

```tsx
<div className="flex items-center gap-1.5 shrink-0">
  {p.speed === '~30s' ? <Zap size={8} className="text-emerald-400" /> : <Clock size={8} className="text-slate-600" />}
  <span className={cn(
    'text-[11px] font-black tabular-nums',
    p.grade?.startsWith('A') ? 'text-emerald-400' : p.grade?.startsWith('B') ? 'text-sky-400' : 'text-slate-500',
  )}>
    {p.grade ?? '—'}
  </span>
</div>
```

- [ ] **Step 3: Update the variable name in JSX**

Find the `{topPresets.map((p) => {` JSX block and rename the variable to `mainPresets` to match step 1.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep WaterfallVisualizer`

Expected: No errors from this file.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/WaterfallVisualizer.tsx
git commit -m "fix(visualizer): remove p.score type errors, migrate tier to category"
```

---

### Task 3: Change default preset to `kimi-coder`

**Files:**
- Modify: `frontend/src/store/waterfallSlice.ts:74`

- [ ] **Step 1: Update the default preset key**

Change line 74 from:

```ts
waterfallPresetKey: 'groq-speed',
```

To:

```ts
waterfallPresetKey: 'kimi-coder',
```

Also change the reset default on line 112 from `'groq-speed'` to `'kimi-coder'`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/waterfallSlice.ts
git commit -m "feat(store): change default preset to kimi-coder"
```

---

### Task 4: Rewrite `WaterfallPresetPicker.tsx` — section layout + RecommendedRow

This is the largest task. The component structure changes from a flat grid to three sections. We keep `CustomStageRow`, `CUSTOM_MODELS`, `CROSS_PROVIDER_MODELS`, and all the helper functions/types (`getPresetWarnings`, `getPresetUpgrades`, `upgradeKey`, `getProviderAlternatives`, `crossProviderLookup`).

**Files:**
- Modify: `frontend/src/components/waterfall/WaterfallPresetPicker.tsx`

- [ ] **Step 1: Update `gradeBadge` to use `category` instead of `tier`**

Change line 92:

```ts
const gradeBadge = (grade: string | null, category: string) => {
  if (category === 'demo') return { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/20', label: 'DEMO' };
  if (grade === null) return { text: 'text-slate-500', bg: 'bg-white/5', border: 'border-white/10', label: 'NEW' };
  if (grade.startsWith('A')) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/20', label: grade };
  if (grade.startsWith('B')) return { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/20', label: grade };
  if (grade.startsWith('C')) return { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/20', label: grade };
  return { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/20', label: grade };
};
```

- [ ] **Step 2: Replace `PresetCard` with `RecommendedRow`**

Delete the entire `PresetCard` component (lines 109-233) and replace with:

```tsx
const RecommendedRow = ({
  preset,
  isSelected,
  isExpanded,
  isDefault,
  onSelect,
  onToggleExpand,
  warnings,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  isExpanded: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  warnings: string[];
}) => {
  const badge = gradeBadge(preset.grade, preset.category);
  const isFast = preset.speed !== '~5m+';

  return (
    <div>
      <div
        className={cn(
          'rounded-lg border transition-all duration-200 cursor-pointer select-none px-3 py-2.5',
          isSelected
            ? 'bg-[rgba(157,91,210,0.06)] border-[rgba(157,91,210,0.2)] shadow-[0_0_16px_-4px_rgba(157,91,210,0.15)]'
            : 'bg-[rgba(255,255,255,0.015)] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)]',
        )}
        onClick={onSelect}
      >
        {/* Main row */}
        <div className="flex items-center gap-2.5">
          {/* Default dot */}
          {isDefault && (
            <div className="w-[5px] h-[5px] rounded-full bg-jb-purple shrink-0" />
          )}

          {/* Name */}
          <span className={cn(
            'text-[11px] font-extrabold tracking-tight shrink-0',
            isSelected ? 'text-[#e2e8f0]' : 'text-[#cbd5e1]',
          )}>
            {preset.name}
          </span>

          {/* Tagline */}
          <span className="text-[9px] text-[#64748b] truncate">
            — {preset.tagline}
          </span>

          <div className="flex-1" />

          {/* Speed */}
          <span className={cn(
            'text-[9px] font-mono shrink-0',
            isFast ? 'text-[#34d399]' : 'text-[#475569]',
          )}>
            {preset.speed}
          </span>

          {/* Grade badge */}
          <div className={cn('px-1.5 py-0.5 rounded-md border text-[10px] font-black tabular-nums shrink-0', badge.bg, badge.border, badge.text)}>
            {badge.label}
          </div>

          {/* Warning icon */}
          {warnings.length > 0 && (
            <AlertTriangle size={10} className="text-amber-400 shrink-0" />
          )}

          {/* Expand chevron */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="shrink-0 text-slate-700 hover:text-slate-400 transition-colors"
          >
            <ChevronDown size={10} className={cn('transition-transform', isExpanded && 'rotate-180')} />
          </button>
        </div>

        {/* Pipeline model labels */}
        <div className="mt-1.5">
          <span className="text-[8px] text-[#334155]">
            {preset.stageLabels.planner} → {preset.stageLabels.executor} → {preset.stageLabels.reviewer}
          </span>
        </div>
      </div>

      {/* Expand: provider-swap panel */}
      <AnimatePresence>
        {isExpanded && (
          <ProviderSwapPanel preset={preset} />
        )}
      </AnimatePresence>
    </div>
  );
};
```

- [ ] **Step 3: Add `TopTierCard` component**

After `RecommendedRow`, add:

```tsx
const TopTierCard = ({
  preset,
  isSelected,
  onSelect,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const badge = gradeBadge(preset.grade, preset.category);

  return (
    <div
      className={cn(
        'rounded-md border transition-all duration-200 cursor-pointer select-none px-2 py-1.5',
        isSelected
          ? 'bg-[rgba(157,91,210,0.06)] border-[rgba(157,91,210,0.2)]'
          : 'bg-[rgba(255,255,255,0.015)] border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.15)]',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          'text-[9px] font-bold truncate',
          isSelected ? 'text-white' : 'text-[#94a3b8]',
        )}>
          {preset.name}
        </span>
        <div className={cn('px-1 py-0.5 rounded border text-[9px] font-black tabular-nums shrink-0', badge.bg, badge.border, badge.text)}>
          {badge.label}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Add `SoloPill` component**

```tsx
const SoloPill = ({
  preset,
  isSelected,
  onSelect,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  // Strip "Solo: " prefix for display
  const displayName = preset.name.replace(/^Solo:\s*/, '');

  return (
    <button
      onClick={onSelect}
      className={cn(
        'rounded-[5px] border transition-all duration-200 px-1.5 py-1 text-center',
        isSelected
          ? 'bg-[rgba(157,91,210,0.06)] border-[rgba(157,91,210,0.2)] text-[#94a3b8]'
          : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.04)] text-[#64748b] hover:border-[rgba(255,255,255,0.15)]',
      )}
    >
      <span className="text-[8px] font-semibold">{displayName}</span>
    </button>
  );
};
```

- [ ] **Step 5: Add `ProviderSwapPanel` shared component**

This is used by both `RecommendedRow` and `TopTierCard`. It shows provider toggle pills for stages that have cross-provider alternatives, using the existing `getProviderAlternatives` function and `CROSS_PROVIDER_MODELS` data.

Add after the helper functions, before `RecommendedRow`:

```tsx
const ProviderSwapPanel = ({ preset }: { preset: WaterfallPresetMeta }) => {
  const { setWaterfallCustomStage } = useAppStore();

  // Only show stages that have cross-provider alternatives
  const stagesWithAlts = STAGE_ORDER.filter((stage) => {
    const sel = preset.selection[stage];
    if (typeof sel !== 'object') return false;
    return getProviderAlternatives(sel.provider, sel.model) !== null;
  });

  if (stagesWithAlts.length === 0) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden"
    >
      <div className="pt-2 pb-1 px-1 space-y-1.5">
        {stagesWithAlts.map((stage) => {
          const cfg = STAGE_CONFIGS[stage];
          const Icon = cfg.icon;
          const sel = preset.selection[stage] as { model: string; provider: string };
          const alts = getProviderAlternatives(sel.provider, sel.model)!;

          return (
            <div key={stage} className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0', cfg.bgColor)}>
                <Icon size={8} className={cfg.textColor} />
              </div>
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider w-16 shrink-0">
                {cfg.displayName}
              </span>
              <div className="flex items-center gap-1">
                {alts.group.variants.map((v) => (
                  <button
                    key={v.provider}
                    onClick={(e) => {
                      e.stopPropagation();
                      setWaterfallCustomStage(stage, { model: v.model, provider: v.provider });
                    }}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[8px] font-bold transition-all border',
                      v.provider === alts.current.provider
                        ? 'bg-jb-purple/15 border-jb-purple/30 text-jb-purple'
                        : 'bg-white/[0.03] border-white/[0.06] text-slate-600 hover:text-slate-400 hover:border-white/15',
                    )}
                  >
                    {v.providerLabel}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
```

- [ ] **Step 6: Rewrite the main `WaterfallPresetPicker` component body**

Replace the JSX inside the main component. Keep all the same props and hooks. Replace the filtering logic and section rendering:

```tsx
export const WaterfallPresetPicker = ({
  unavailableModels,
  upgradeSuggestions,
  dismissedKeys,
  onDismissUpgrade: _onDismissUpgrade,
  onSwapModel: _onSwapModel,
}: {
  unavailableModels: UnavailableModel[];
  upgradeSuggestions: UpgradeSuggestion[];
  dismissedKeys: Set<string>;
  onDismissUpgrade: (key: string) => void;
  onSwapModel: (stage: StageKey, model: string, provider: string) => void;
}) => {
  const {
    waterfallPresetKey,
    waterfallModelSelection,
    setWaterfallPreset,
    setWaterfallCustomStage,
  } = useAppStore();

  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(waterfallPresetKey === 'custom');

  const recommended = WATERFALL_PRESET_LIST.filter(p => p.category === 'recommended');
  const topTier = WATERFALL_PRESET_LIST.filter(p => p.category === 'top');
  const solo = WATERFALL_PRESET_LIST.filter(p => p.category === 'solo');

  const handleSelect = (key: string) => {
    setWaterfallPreset(key);
    setShowCustom(false);
    if (expandedPreset !== key) setExpandedPreset(null);
  };

  const handleCustomToggle = () => {
    setShowCustom(!showCustom);
    if (!showCustom) setExpandedPreset(null);
  };

  return (
    <div className="glass-panel rounded-[2rem] overflow-hidden">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers size={14} className="text-slate-500" />
            <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest">
              Pipeline Preset
            </span>
          </div>
          <button
            onClick={handleCustomToggle}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-bold uppercase tracking-wider transition-all',
              showCustom
                ? 'bg-jb-purple/10 border-jb-purple/25 text-jb-purple'
                : 'bg-white/[0.03] border-white/[0.08] text-slate-600 hover:text-slate-400 hover:border-white/15',
            )}
          >
            <SlidersHorizontal size={11} />
            Custom
          </button>
        </div>

        {!showCustom && (
          <>
            {/* ── Recommended Section ────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">
                  Recommended
                </span>
                <span className="text-[9px] text-[#475569]">
                  benchmarked across 4 prompts
                </span>
              </div>
              <div className="space-y-1.5">
                {recommended.map((preset) => (
                  <RecommendedRow
                    key={preset.key}
                    preset={preset}
                    isSelected={waterfallPresetKey === preset.key}
                    isExpanded={expandedPreset === preset.key}
                    isDefault={preset.key === 'kimi-coder'}
                    onSelect={() => handleSelect(preset.key)}
                    onToggleExpand={() => setExpandedPreset(expandedPreset === preset.key ? null : preset.key)}
                    warnings={getPresetWarnings(preset, unavailableModels)}
                  />
                ))}
              </div>
            </div>

            {/* ── Top Tier Section ────────────────────────────── */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest block">
                Top Tier
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {topTier.map((preset) => (
                  <TopTierCard
                    key={preset.key}
                    preset={preset}
                    isSelected={waterfallPresetKey === preset.key}
                    onSelect={() => {
                      handleSelect(preset.key);
                      setExpandedPreset(expandedPreset === preset.key ? null : preset.key);
                    }}
                  />
                ))}
              </div>
              {/* Provider swap panel renders below the grid for the selected top-tier preset */}
              <AnimatePresence>
                {topTier.some(p => p.key === expandedPreset) && (() => {
                  const expanded = topTier.find(p => p.key === expandedPreset);
                  return expanded ? <ProviderSwapPanel preset={expanded} /> : null;
                })()}
              </AnimatePresence>
            </div>

            {/* ── Solo Section ────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">
                  Solo
                </span>
                <span className="text-[9px] text-[#475569]">
                  single model, all stages
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {solo.map((preset) => (
                  <SoloPill
                    key={preset.key}
                    preset={preset}
                    isSelected={waterfallPresetKey === preset.key}
                    onSelect={() => handleSelect(preset.key)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Custom panel */}
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-white/[0.04] space-y-3">
                <span className="text-[12px] text-slate-700 font-mono block">Select a model for each pipeline stage</span>
                {STAGE_ORDER.map((stage) => (
                  <CustomStageRow
                    key={stage}
                    stage={stage}
                    currentSelection={waterfallModelSelection[stage]}
                    onChange={(model, provider) => setWaterfallCustomStage(stage, { model, provider })}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer hint */}
        <div className="pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Trophy size={11} className="text-slate-700" />
            <span className="text-[12px] text-slate-700 font-mono">
              Scores from automated pipeline benchmarks · results may vary
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -40`

Expected: Clean compile (no errors).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/waterfall/WaterfallPresetPicker.tsx
git commit -m "feat(ui): rewrite preset picker with recommended/top/solo sections"
```

---

### Task 5: Verify in browser and fix visual issues

**Files:**
- Possibly modify: `frontend/src/components/waterfall/WaterfallPresetPicker.tsx` (spacing/color tweaks)

- [ ] **Step 1: Start the dev server if not running**

Run: `cd frontend && npm run dev`

Navigate to the waterfall pipeline page and verify:
1. Three sections visible: RECOMMENDED (4 rows), TOP TIER (2-col grid, 7 cards), SOLO (3-col grid, 7 pills)
2. kimi-coder has a purple default dot
3. Clicking a recommended row selects it (purple border/bg)
4. Clicking the chevron expands the provider-swap panel
5. Top tier cards show name + grade badge
6. Solo pills show abbreviated model names
7. Custom button still works and shows the model dropdowns
8. Footer "Scores from automated pipeline benchmarks" still visible

- [ ] **Step 2: Fix any spacing/color issues found in step 1**

Make targeted edits to fix visual problems. Common fixes:
- Adjust padding/margins if sections feel too tight or too loose
- Adjust font sizes if text is too small to read
- Fix any overflow issues in the grid

- [ ] **Step 3: Commit any fixes**

```bash
git add frontend/src/components/waterfall/WaterfallPresetPicker.tsx
git commit -m "fix(ui): preset picker visual adjustments"
```

---

### Task 6: Final TypeScript check and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

Expected: Clean compile, zero errors.

- [ ] **Step 2: Check for unused imports**

Look for any unused imports in the modified files (e.g., `Zap` or `Clock` if `speedIcon` was removed from the picker). Remove them.

- [ ] **Step 3: Commit cleanup**

```bash
git add -u frontend/src/
git commit -m "chore: remove unused imports from preset picker redesign"
```
