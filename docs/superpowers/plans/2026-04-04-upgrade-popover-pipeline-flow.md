# Upgrade Popover in Pipeline Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the model upgrade swap menu from preset cards into the pipeline flow component, where each stage with an available upgrade shows a clickable icon that opens a popover with swap/dismiss actions.

**Architecture:** The upgrade data (fetched from `/health/models`) is lifted to the shared parent `WaterfallArea`, passed down to both `WaterfallPresetPicker` (for the compact banner) and `WaterfallFlowPreview` (for the interactive popovers). The PresetCard's dropdown is removed, keeping only the indicator banner. The `WaterfallFlowPreview` gets per-stage `ArrowUpCircle` icons that toggle a left-aligned popover showing current→new model with Use/Dismiss buttons.

**Tech Stack:** React, framer-motion, lucide-react, sonner, localStorage

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `frontend/src/components/WaterfallArea.tsx` | Lift upgrade data fetch + dismiss state to shared parent, pass as props | Modify |
| `frontend/src/components/waterfall/WaterfallFlowPreview.tsx` | Add upgrade icon per stage + popover with swap/dismiss | Modify |
| `frontend/src/components/waterfall/WaterfallPresetPicker.tsx` | Remove dropdown/swap menu from PresetCard, keep compact banner only, accept upgrade data as props instead of self-fetching | Modify |

---

### Task 1: Lift Upgrade Data to WaterfallArea

**Files:**
- Modify: `frontend/src/components/WaterfallArea.tsx`
- Modify: `frontend/src/components/waterfall/WaterfallPresetPicker.tsx`

Move the upgrade fetch, dismiss state, and swap handler out of `WaterfallPresetPicker` and into `WaterfallArea` so both child components can share the data.

- [ ] **Step 1: Add upgrade types, fetch hook, and dismiss helpers to WaterfallArea**

In `frontend/src/components/WaterfallArea.tsx`, add imports and the shared hook. Copy the `UpgradeSuggestion`, `ModelScanResult`, `useModelAvailability`, dismiss helpers, and `upgradeKey` from `WaterfallPresetPicker.tsx`:

```tsx
// Add to imports:
import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../lib/config';
import type { StageKey } from './waterfall/WaterfallStageCard';

// Add before the component:
interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;
  usedInPresets: string[];
}

interface UnavailableModel {
  model: string;
  provider: string;
  available: boolean;
  usedInPresets: string[];
}

interface ModelScanResult {
  scannedAt: string;
  unavailable: UnavailableModel[];
  upgrades: UpgradeSuggestion[];
  scanErrors: string[];
}

const DISMISS_KEY = 'solvent:dismissed-upgrades';

function getDismissedUpgrades(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function dismissUpgrade(key: string) {
  const dismissed = getDismissedUpgrades();
  dismissed.add(key);
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
}

function upgradeKey(u: UpgradeSuggestion): string {
  return `${u.current.provider}:${u.current.model}→${u.successor.model}`;
}

function useModelAvailability() {
  const [unavailableModels, setUnavailableModels] = useState<UnavailableModel[]>([]);
  const [upgradeSuggestions, setUpgradeSuggestions] = useState<UpgradeSuggestion[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/health/models`)
      .then(res => res.ok ? res.json() : null)
      .then((data: ModelScanResult | null) => {
        if (data?.unavailable) setUnavailableModels(data.unavailable);
        if (data?.upgrades) setUpgradeSuggestions(data.upgrades);
      })
      .catch(() => {});
  }, []);

  return { unavailableModels, upgradeSuggestions };
}
```

- [ ] **Step 2: Add state and handlers inside WaterfallArea component**

Inside the `WaterfallArea` component function, add:

```tsx
const { unavailableModels, upgradeSuggestions } = useModelAvailability();
const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => getDismissedUpgrades());

const handleDismissUpgrade = (key: string) => {
  dismissUpgrade(key);
  setDismissedKeys(prev => new Set([...prev, key]));
};

const handleSwapModel = (stage: StageKey, model: string, provider: string) => {
  setWaterfallCustomStage(stage, { model, provider });
};
```

Make sure `setWaterfallCustomStage` is destructured from `useAppStore()` (it should already be available or add it to the destructuring).

- [ ] **Step 3: Pass upgrade data to WaterfallPresetPicker and WaterfallFlowPreview**

Update the JSX where both components are rendered:

```tsx
<WaterfallPresetPicker
  unavailableModels={unavailableModels}
  upgradeSuggestions={upgradeSuggestions}
  dismissedKeys={dismissedKeys}
  onDismissUpgrade={handleDismissUpgrade}
/>

// ... later:

<WaterfallFlowPreview
  upgradeSuggestions={upgradeSuggestions}
  dismissedKeys={dismissedKeys}
  onDismissUpgrade={handleDismissUpgrade}
  onSwapModel={handleSwapModel}
/>
```

- [ ] **Step 4: Update WaterfallPresetPicker to accept props instead of self-fetching**

In `WaterfallPresetPicker.tsx`:

1. Add props to the component signature:
```tsx
export const WaterfallPresetPicker = ({
  unavailableModels,
  upgradeSuggestions,
  dismissedKeys,
  onDismissUpgrade,
}: {
  unavailableModels: UnavailableModel[];
  upgradeSuggestions: UpgradeSuggestion[];
  dismissedKeys: Set<string>;
  onDismissUpgrade: (key: string) => void;
}) => {
```

2. Remove the internal `useModelAvailability` call, `dismissedKeys` state, `handleDismissUpgrade`, `handleSwapModel`, and the toast `useEffect` from inside the component. These now come from props or live in `WaterfallArea`.

3. Move the toast `useEffect` to `WaterfallArea` instead (it fires once on mount when upgrades are detected — belongs at the parent level).

4. Remove the `useModelAvailability` function definition, `DISMISS_KEY`, `getDismissedUpgrades`, `dismissUpgrade`, `upgradeKey` from `WaterfallPresetPicker.tsx` (they now live in `WaterfallArea.tsx`).

5. Keep the `UnavailableModel`, `UpgradeSuggestion`, `PresetUpgrade`, `getPresetWarnings`, and `getPresetUpgrades` types/functions — they're still used for the preset card rendering.

6. Update the `upgradeKey` usage in `getPresetUpgrades` — since the function moved to the parent, either re-export it or inline the key computation. Simplest: keep a local copy of `upgradeKey` in `WaterfallPresetPicker.tsx`.

- [ ] **Step 5: Verify frontend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/WaterfallArea.tsx frontend/src/components/waterfall/WaterfallPresetPicker.tsx
git commit -m "refactor: lift upgrade data fetch and dismiss state to WaterfallArea parent"
```

---

### Task 2: Simplify PresetCard — Remove Dropdown, Keep Banner Only

**Files:**
- Modify: `frontend/src/components/waterfall/WaterfallPresetPicker.tsx`

Remove the swap dropdown menu from `PresetCard`. Keep only the compact "N upgrades available" indicator banner (non-interactive — no expand/collapse, no swap buttons). Remove `onSwapModel`, `showSwapMenu` state, and the `AnimatePresence` dropdown from `PresetCard`.

- [ ] **Step 1: Simplify PresetCard props**

Remove `onSwapModel` and `onDismissUpgrade` from PresetCard props. The `upgrades` prop stays (for the banner count), but the card no longer needs interaction callbacks:

```tsx
const PresetCard = ({
  preset,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  warnings,
  upgradeCount,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  warnings: string[];
  upgradeCount: number;
}) => {
  const badge = scoreBadge(preset.score, preset.tier);
  const spd = speedIcon(preset.speed);
  const SpdIcon = spd.icon;
```

Note: `showSwapMenu` state is removed entirely.

- [ ] **Step 2: Replace the upgrade section with a simple non-interactive banner**

Replace the entire upgrade suggestions block (the `<div>` with `showSwapMenu`, `AnimatePresence`, stage-grouped items) with a simple indicator:

```tsx
        {/* Upgrade indicator */}
        {upgradeCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08]">
            <ArrowUpCircle size={11} className="text-blue-400 shrink-0" />
            <span className="text-[11px] text-slate-400 font-medium leading-tight">
              {upgradeCount === 1 ? '1 upgrade available' : `${upgradeCount} upgrades available`}
            </span>
          </div>
        )}
```

- [ ] **Step 3: Update PresetCard call sites**

In the top presets grid, pass `upgradeCount` instead of `upgrades`, `onDismissUpgrade`, `onSwapModel`:

```tsx
<PresetCard
  key={preset.key}
  preset={preset}
  isSelected={waterfallPresetKey === preset.key}
  isExpanded={expandedPreset === preset.key}
  onSelect={() => handleSelect(preset.key)}
  onToggleExpand={() => setExpandedPreset(expandedPreset === preset.key ? null : preset.key)}
  warnings={getPresetWarnings(preset, unavailableModels)}
  upgradeCount={getPresetUpgrades(preset, upgradeSuggestions, dismissedKeys).length}
/>
```

- [ ] **Step 4: Remove upgrade indicators from the expanded model breakdown**

In the expanded model view inside PresetCard, remove the `upgrades.filter(u => u.stageLabel === label)` mapping that showed `ArrowUpCircle` per-stage. That display is moving to `WaterfallFlowPreview`. Keep the offline `AlertTriangle` indicators as they are.

- [ ] **Step 5: Clean up unused imports**

Remove imports that are no longer needed in `WaterfallPresetPicker.tsx`:
- Remove `toast` from `sonner` (toast logic moved to parent)
- Remove `STAGE_CONFIGS` if no longer used (check — it may still be used in the expanded model view)
- Remove `API_BASE_URL` from config (fetch moved to parent)

Keep `ArrowUpCircle` (still used in the simple banner).

- [ ] **Step 6: Verify frontend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/waterfall/WaterfallPresetPicker.tsx
git commit -m "refactor(ui): simplify preset card upgrade indicator to compact banner"
```

---

### Task 3: Add Upgrade Popovers to WaterfallFlowPreview

**Files:**
- Modify: `frontend/src/components/waterfall/WaterfallFlowPreview.tsx`

Add per-stage upgrade icons and left-aligned popovers to the pipeline flow component. When a stage has an available upgrade, an `ArrowUpCircle` icon appears next to it. Clicking it opens a popover to the left showing the current→new model with Use/Dismiss buttons.

- [ ] **Step 1: Update component props**

Add upgrade-related props to `WaterfallFlowPreview`:

```tsx
import { ArrowDown, Workflow, ArrowUpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WATERFALL_PRESET_LIST, type WaterfallPresetMeta } from '../../lib/waterfallPresets';

// Add UpgradeSuggestion type (same shape as elsewhere):
interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;
  usedInPresets: string[];
}

interface FlowPreviewProps {
  upgradeSuggestions: UpgradeSuggestion[];
  dismissedKeys: Set<string>;
  onDismissUpgrade: (key: string) => void;
  onSwapModel: (stage: StageKey, model: string, provider: string) => void;
}

function upgradeKey(u: UpgradeSuggestion): string {
  return `${u.current.provider}:${u.current.model}→${u.successor.model}`;
}

export const WaterfallFlowPreview = ({
  upgradeSuggestions,
  dismissedKeys,
  onDismissUpgrade,
  onSwapModel,
}: FlowPreviewProps) => {
```

- [ ] **Step 2: Add state for active popover and compute per-stage upgrades**

Inside the component:

```tsx
const { waterfallPresetKey } = useAppStore();
const [activePopover, setActivePopover] = useState<StageKey | null>(null);

// Get current preset to match upgrades against stage models
const preset = WATERFALL_PRESET_LIST.find(p => p.key === waterfallPresetKey);

function getStageUpgrades(stage: StageKey): { successor: string; provider: string; note: string; key: string; currentModel: string }[] {
  if (!preset) return [];
  const sel = preset.selection[stage];
  if (typeof sel !== 'object') return [];
  const results: { successor: string; provider: string; note: string; key: string; currentModel: string }[] = [];
  for (const u of upgradeSuggestions) {
    if (u.current.provider === sel.provider && u.current.model === sel.model) {
      const k = upgradeKey(u);
      if (!dismissedKeys.has(k)) {
        results.push({
          successor: u.successor.model,
          provider: u.successor.provider,
          note: u.note,
          key: k,
          currentModel: u.current.model,
        });
      }
    }
  }
  return results;
}
```

- [ ] **Step 3: Add the upgrade icon to each stage row**

In the stage flow map, after the `{/* Info */}` div (the `<div className="flex-1 min-w-0">` block), add a conditional upgrade icon:

```tsx
{/* Upgrade icon */}
{(() => {
  const stageUpgrades = getStageUpgrades(stage);
  if (stageUpgrades.length === 0) return null;
  return (
    <button
      onClick={() => setActivePopover(activePopover === stage ? null : stage)}
      className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all',
        activePopover === stage
          ? 'bg-blue-500/15 border-blue-500/30'
          : 'bg-white/[0.03] border-white/[0.08] hover:border-white/15',
      )}
    >
      <ArrowUpCircle size={14} className="text-blue-400" />
    </button>
  );
})()}
```

- [ ] **Step 4: Add the popover component that renders below the stage row**

After each stage row's `motion.div` (but before the connector), add the popover. It slides in below the stage when active:

```tsx
{/* Upgrade popover */}
<AnimatePresence>
  {activePopover === stage && (() => {
    const stageUpgrades = getStageUpgrades(stage);
    if (stageUpgrades.length === 0) return null;
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="overflow-hidden ml-14"
      >
        <div className="py-2 space-y-1.5">
          {stageUpgrades.map(u => (
            <div key={u.key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-600 font-medium truncate">{u.currentModel}</div>
                <div className="text-[11px] text-slate-300 font-medium truncate">→ {u.successor}</div>
              </div>
              <button
                onClick={() => { onSwapModel(stage, u.successor, u.provider); onDismissUpgrade(u.key); setActivePopover(null); }}
                className={cn('shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors', cfg.bgColor, cfg.textColor, 'border-white/10 hover:border-white/20')}
              >
                Use
              </button>
              <button
                onClick={() => onDismissUpgrade(u.key)}
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-700 hover:text-slate-400 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    );
  })()}
</AnimatePresence>
```

- [ ] **Step 5: Add `useState` import**

Update the React import at the top:

```tsx
import React, { useState } from 'react';
```

- [ ] **Step 6: Verify frontend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/waterfall/WaterfallFlowPreview.tsx
git commit -m "feat(ui): add upgrade popovers to pipeline flow stages"
```

---

### Task 4: Move Toast to WaterfallArea + Final Cleanup

**Files:**
- Modify: `frontend/src/components/WaterfallArea.tsx`
- Modify: `frontend/src/components/waterfall/WaterfallPresetPicker.tsx`

Move the sonner toast logic from `WaterfallPresetPicker` to `WaterfallArea` (where the upgrade data now lives). Clean up any remaining dead code.

- [ ] **Step 1: Add toast effect to WaterfallArea**

In `WaterfallArea.tsx`, add the sonner import and the toast effect after the dismiss handler:

```tsx
import { toast } from 'sonner';

// Inside the component, after handleSwapModel:
useEffect(() => {
  if (upgradeSuggestions.length === 0) return;
  const dismissed = getDismissedUpgrades();
  const toShow = upgradeSuggestions
    .filter(u => !dismissed.has(upgradeKey(u)))
    .slice(0, 3);

  const timer = setTimeout(() => {
    for (const u of toShow) {
      const k = upgradeKey(u);
      toast.info(u.note, {
        description: `Used by: ${u.usedInPresets.join(', ')}`,
        duration: 8000,
        action: {
          label: 'Dismiss',
          onClick: () => handleDismissUpgrade(k),
        },
      });
    }
  }, 1500);

  return () => clearTimeout(timer);
}, [upgradeSuggestions]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Remove toast effect and sonner import from WaterfallPresetPicker**

In `WaterfallPresetPicker.tsx`, remove:
- `import { toast } from 'sonner';`
- The entire `useEffect` block that fires toasts

- [ ] **Step 3: Final dead code scan**

Check `WaterfallPresetPicker.tsx` for any remaining unused:
- `API_BASE_URL` import (should be removed — fetch moved to parent)
- `useEffect` import (check if still needed — may be used elsewhere)
- `useModelAvailability` function (should be removed — moved to parent)
- `ModelScanResult` interface (should be removed — moved to parent)
- `DISMISS_KEY`, `getDismissedUpgrades`, `dismissUpgrade` (should be removed — moved to parent)

Keep: `UpgradeSuggestion` and `UnavailableModel` interfaces (still used in `getPresetWarnings` and `getPresetUpgrades`), `upgradeKey` local copy (used in `getPresetUpgrades`), `PresetUpgrade` interface, `getPresetWarnings`, `getPresetUpgrades`.

- [ ] **Step 4: Verify frontend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/WaterfallArea.tsx frontend/src/components/waterfall/WaterfallPresetPicker.tsx
git commit -m "refactor: move toast notifications to WaterfallArea + cleanup dead code"
```

---

## Self-Review

**Spec coverage:**
- Preset card keeps compact banner (no dropdown) ✓ — Task 2
- Pipeline flow gets per-stage upgrade icon ✓ — Task 3 Step 3
- Popover opens below stage with current→new + Use/Dismiss ✓ — Task 3 Step 4
- "Use" button triggers swap to custom ✓ — Task 3 Step 4 (`onSwapModel`)
- Dismiss persists to localStorage ✓ — lifted to parent in Task 1
- Toast notifications still fire ✓ — moved to parent in Task 4
- Same styling/fonts as existing UI ✓ — uses same `cfg.bgColor`, `cfg.textColor`, same text sizes

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code blocks complete.

**Type consistency:** `UpgradeSuggestion` interface has identical shape across all 3 files. `upgradeKey()` function is defined in both `WaterfallArea.tsx` and `WaterfallFlowPreview.tsx` (same implementation, local to each file — avoids cross-file imports for a one-liner). `StageKey` type from `WaterfallStageCard` is used consistently. `onSwapModel` signature `(stage: StageKey, model: string, provider: string)` matches across parent and child.
