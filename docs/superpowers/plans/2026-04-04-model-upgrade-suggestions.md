# Model Upgrade Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface "newer model available" suggestions in the waterfall pipeline UI via prefix matching against live provider model lists.

**Architecture:** Extend the existing `modelAvailabilityService.scan()` with a second pass that prefix-matches preset models against each provider's cached model list to find newer alternatives. The scan result gains an `upgrades[]` array served via the existing `/api/v1/health/models` endpoint. The frontend `WaterfallPresetPicker` shows blue info badges on preset cards and fires sonner toasts on mount, with dismiss state persisted in localStorage.

**Tech Stack:** TypeScript, Express, React, sonner (toast library), localStorage

**Spec:** `docs/superpowers/specs/2026-04-04-model-upgrade-suggestions-design.md`

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `backend/src/services/modelAvailabilityService.ts` | Prefix extraction, upgrade detection, extended scan result | Modify |
| `frontend/src/components/waterfall/WaterfallPresetPicker.tsx` | Upgrade badges, toasts, dismiss logic | Modify |

No new files needed. The `UpgradeSuggestion` type lives in `modelAvailabilityService.ts` alongside the existing `ModelStatus` and `AvailabilityScanResult` types (backend-only types, frontend defines its own matching interface for the API response).

---

### Task 1: Backend — Add Upgrade Detection to modelAvailabilityService

**Files:**
- Modify: `backend/src/services/modelAvailabilityService.ts`

This task adds three things: the `UpgradeSuggestion` interface, a `extractModelPrefix()` helper, and a `detectUpgrades()` method that runs as a second pass inside `scan()`.

- [ ] **Step 1: Add the `UpgradeSuggestion` interface and extend `AvailabilityScanResult`**

In `backend/src/services/modelAvailabilityService.ts`, add the new interface after the existing `AvailabilityScanResult` interface (after line 16), and add the `upgrades` field to the scan result:

```ts
// Add after the ModelStatus interface (line 9):

export interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;
  usedInPresets: string[];
}

// Modify AvailabilityScanResult to add upgrades field:
interface AvailabilityScanResult {
  scannedAt: string;
  unavailable: ModelStatus[];
  upgrades: UpgradeSuggestion[];  // ← add this line
  scanErrors: string[];
}
```

- [ ] **Step 2: Add the `extractModelPrefix()` private method**

Add this method to the `ModelAvailabilityService` class, after `getPresetModels()` (after line 68):

```ts
/**
 * Extract a prefix from a model ID for fuzzy family matching.
 * Strips version numbers, size tags, and provider suffixes.
 * Examples:
 *   'qwen3.5:cloud'                          → 'qwen'
 *   'qwen/qwen3-32b'                         → 'qwen/qwen'
 *   'meta-llama/llama-3.3-70b-instruct:free' → 'meta-llama/llama'
 *   'moonshotai/kimi-k2-instruct-0905'       → 'moonshotai/kimi'
 *   'deepseek-v3.2:cloud'                    → 'deepseek'
 *   'openai/gpt-oss-120b'                    → 'openai/gpt-oss'
 */
private extractModelPrefix(model: string): string {
  // Strip :cloud, :free, and similar suffixes first
  let clean = model.replace(/:(cloud|free|latest)$/i, '');
  // Strip trailing instruct/chat tags and date stamps
  clean = clean.replace(/[-_](instruct|chat|preview|exp)[-_]?\d*$/i, '');
  // Strip size tags like -70b, -32b, -480b, -120b
  clean = clean.replace(/[-_]\d+b$/i, '');
  // Strip version-like trailing segments: -v3.2, -3.3, .5, -0905
  clean = clean.replace(/[-.]?\d+(\.\d+)*$/g, '');
  // Strip trailing hyphens/dots from aggressive stripping
  clean = clean.replace(/[-_.]+$/, '');
  return clean.toLowerCase();
}
```

- [ ] **Step 3: Add the `detectUpgrades()` private method**

Add this method after `extractModelPrefix()`:

```ts
/**
 * Detect potential model upgrades by prefix-matching preset models
 * against each provider's cached model list.
 */
private detectUpgrades(
  presetModels: Map<string, { model: string; provider: string; presets: string[] }>
): UpgradeSuggestion[] {
  const upgrades: UpgradeSuggestion[] = [];
  // Collect all model IDs already used in presets per provider
  const usedByProvider = new Map<string, Set<string>>();
  for (const [, entry] of presetModels) {
    const set = usedByProvider.get(entry.provider) ?? new Set();
    set.add(entry.model);
    usedByProvider.set(entry.provider, set);
  }

  for (const [, entry] of presetModels) {
    const liveModels = this.providerModelCache.get(entry.provider);
    if (!liveModels) continue;

    const prefix = this.extractModelPrefix(entry.model);
    if (prefix.length < 3) continue; // too short to be meaningful

    const usedModels = usedByProvider.get(entry.provider) ?? new Set();

    for (const candidate of liveModels) {
      // Skip if it's the same model or already used in a preset
      if (candidate === entry.model || usedModels.has(candidate)) continue;

      const candidatePrefix = this.extractModelPrefix(candidate);
      if (candidatePrefix === prefix) {
        // Deduplicate: don't suggest the same successor for the same current model twice
        const alreadySuggested = upgrades.some(
          u => u.current.model === entry.model
            && u.current.provider === entry.provider
            && u.successor.model === candidate
        );
        if (alreadySuggested) continue;

        upgrades.push({
          current: { model: entry.model, provider: entry.provider },
          successor: { model: candidate, provider: entry.provider },
          note: `${candidate} available on ${entry.provider}`,
          usedInPresets: [...new Set(entry.presets)],
        });
      }
    }
  }

  return upgrades;
}
```

- [ ] **Step 4: Wire `detectUpgrades()` into `scan()` and update the return value**

In the `scan()` method, after the unavailable detection loop (after line 138) and before `this.lastScan = {`, add the upgrade detection call and include it in the result:

```ts
    // Detect potential upgrades via prefix matching
    const upgrades = this.detectUpgrades(presetModels);

    this.lastScan = {
      scannedAt: new Date().toISOString(),
      unavailable,
      upgrades,  // ← add this
      scanErrors,
    };

    // Log results (add after existing unavailable logging, around line 152):
    if (upgrades.length > 0) {
      logger.info(`[ModelAvailability] ${upgrades.length} upgrade suggestion(s) found:`);
      for (const u of upgrades) {
        logger.info(`  - ${u.current.provider}/${u.current.model} → ${u.successor.model} (presets: ${u.usedInPresets.join(', ')})`);
      }
    }
```

- [ ] **Step 5: Verify backend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Manual test — start backend and check endpoint**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npm run dev &`
Then: `sleep 15 && curl -s http://127.0.0.1:3001/api/v1/health/models | jq .`

Expected: JSON response with `scannedAt`, `unavailable`, `upgrades` (array, may be empty or have entries), `scanErrors`.

- [ ] **Step 7: Commit**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley
git add backend/src/services/modelAvailabilityService.ts
git commit -m "feat(models): add upgrade detection via prefix matching to availability scanner"
```

---

### Task 2: Frontend — Upgrade Badges on Preset Cards

**Files:**
- Modify: `frontend/src/components/waterfall/WaterfallPresetPicker.tsx`

This task extends the existing `useModelAvailability` hook and `PresetCard` to show blue upgrade badges alongside the existing amber offline warnings.

- [ ] **Step 1: Extend the frontend types and hook to include upgrades**

In `frontend/src/components/waterfall/WaterfallPresetPicker.tsx`, update the existing types and hook (lines 14-40):

```ts
// Add after UnavailableModel interface (after line 19):

interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;
  usedInPresets: string[];
}

// Update ModelScanResult to include upgrades (replace existing interface at lines 21-25):
interface ModelScanResult {
  scannedAt: string;
  unavailable: UnavailableModel[];
  upgrades: UpgradeSuggestion[];  // ← add this
  scanErrors: string[];
}

// Replace the useModelAvailability hook (lines 27-40) to return both:
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

- [ ] **Step 2: Add dismiss helpers and `getPresetUpgrades()` function**

Add after the existing `getPresetWarnings()` function (after line 57):

```ts
const DISMISS_KEY = 'solvent:dismissed-upgrades';

function getDismissedUpgrades(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function dismissUpgrade(key: string) {
  const dismissed = getDismissedUpgrades();
  dismissed.add(key);
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
}

function upgradeKey(u: UpgradeSuggestion): string {
  return `${u.current.provider}:${u.current.model}→${u.successor.model}`;
}

/** Get non-dismissed upgrade suggestions for a preset, return list of { stageLabel, note, key } */
function getPresetUpgrades(
  preset: WaterfallPresetMeta,
  upgrades: UpgradeSuggestion[],
  dismissed: Set<string>,
): { stageLabel: string; successorModel: string; note: string; key: string }[] {
  if (upgrades.length === 0) return [];
  const results: { stageLabel: string; successorModel: string; note: string; key: string }[] = [];
  for (const stage of STAGE_ORDER) {
    const sel = preset.selection[stage];
    if (typeof sel === 'object') {
      for (const u of upgrades) {
        if (u.current.provider === sel.provider && u.current.model === sel.model) {
          const k = upgradeKey(u);
          if (!dismissed.has(k)) {
            results.push({
              stageLabel: preset.stageLabels[stage],
              successorModel: u.successor.model,
              note: u.note,
              key: k,
            });
          }
        }
      }
    }
  }
  return results;
}
```

- [ ] **Step 3: Add `ArrowUpCircle` to lucide imports and add `upgrades` prop to PresetCard**

Update the lucide import (line 7):

```ts
import { Layers, ChevronDown, Zap, Clock, Trophy, SlidersHorizontal, AlertTriangle, ArrowUpCircle } from 'lucide-react';
```

Update PresetCard props (add after `warnings: string[];` at line 90):

```ts
const PresetCard = ({
  preset,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  warnings,
  upgrades,
  onDismissUpgrade,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  warnings: string[];
  upgrades: { stageLabel: string; successorModel: string; note: string; key: string }[];
  onDismissUpgrade: (key: string) => void;
}) => {
```

- [ ] **Step 4: Add upgrade badge UI inside PresetCard**

Add after the unavailability warning block (after the `{warnings.length > 0 && (...)}` block, before the expand toggle):

```tsx
        {/* Upgrade suggestions */}
        {upgrades.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <ArrowUpCircle size={11} className="text-sky-400 shrink-0" />
            <span className="text-[11px] text-sky-400 font-medium leading-tight flex-1">
              {upgrades.length === 1 ? `${upgrades[0].successorModel} available` : `${upgrades.length} upgrades available`}
            </span>
          </div>
        )}
```

- [ ] **Step 5: Add upgrade indicator to expanded model view**

In the expanded model breakdown (the `STAGE_ORDER.map` block), update to show upgrade info per-stage. Replace the existing model row rendering to add upgrade info after the offline indicator:

```tsx
                    {isOffline && <AlertTriangle size={10} className="text-amber-400" />}
                    {upgrades.filter(u => u.stageLabel === label).map(u => (
                      <span key={u.key} className="flex items-center gap-1 text-[11px] text-sky-400 font-medium">
                        <ArrowUpCircle size={9} /> {u.successorModel}
                      </span>
                    ))}
```

- [ ] **Step 6: Update the main component to pass upgrade data to PresetCard**

In the `WaterfallPresetPicker` component, update the hook call and add state (replace the existing `useModelAvailability()` call):

```ts
  const { unavailableModels, upgradeSuggestions } = useModelAvailability();
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => getDismissedUpgrades());

  const handleDismissUpgrade = (key: string) => {
    dismissUpgrade(key);
    setDismissedKeys(prev => new Set([...prev, key]));
  };
```

Update the PresetCard calls in the top presets grid to pass upgrade data:

```tsx
            <PresetCard
              key={preset.key}
              preset={preset}
              isSelected={waterfallPresetKey === preset.key}
              isExpanded={expandedPreset === preset.key}
              onSelect={() => handleSelect(preset.key)}
              onToggleExpand={() => setExpandedPreset(expandedPreset === preset.key ? null : preset.key)}
              warnings={getPresetWarnings(preset, unavailableModels)}
              upgrades={getPresetUpgrades(preset, upgradeSuggestions, dismissedKeys)}
              onDismissUpgrade={handleDismissUpgrade}
            />
```

Update the other presets collapsed row to show upgrade icon:

```tsx
              const otherUpgrades = getPresetUpgrades(preset, upgradeSuggestions, dismissedKeys);
              // ... existing code ...
                  {otherUpgrades.length > 0 && <ArrowUpCircle size={11} className="text-sky-400" />}
```

- [ ] **Step 7: Verify frontend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley
git add frontend/src/components/waterfall/WaterfallPresetPicker.tsx
git commit -m "feat(ui): add upgrade suggestion badges to waterfall preset cards"
```

---

### Task 3: Frontend — Toast Notifications on Launch

**Files:**
- Modify: `frontend/src/components/waterfall/WaterfallPresetPicker.tsx`

This task adds sonner toast notifications that fire once when the preset picker mounts and upgrade suggestions are available.

- [ ] **Step 1: Add sonner `toast` import**

Update imports at the top of `WaterfallPresetPicker.tsx`:

```ts
import { toast } from 'sonner';
```

- [ ] **Step 2: Add toast effect to `WaterfallPresetPicker`**

Add a `useEffect` inside the `WaterfallPresetPicker` component, after the `dismissedKeys` state:

```ts
  // Fire toasts for non-dismissed upgrade suggestions (max 3)
  useEffect(() => {
    if (upgradeSuggestions.length === 0) return;
    const dismissed = getDismissedUpgrades();
    const toShow = upgradeSuggestions
      .filter(u => !dismissed.has(upgradeKey(u)))
      .slice(0, 3);

    // Small delay so the UI is painted before toasts appear
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

- [ ] **Step 3: Verify frontend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley
git add frontend/src/components/waterfall/WaterfallPresetPicker.tsx
git commit -m "feat(ui): add sonner toast notifications for model upgrade suggestions"
```

---

### Task 4: Manual Integration Test

**Files:** None (testing only)

- [ ] **Step 1: Start backend and verify scan output**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley/backend && npm run dev
```

Check server logs for lines like:
```
[ModelAvailability] N upgrade suggestion(s) found:
  - openrouter/meta-llama/llama-3.3-70b-instruct:free → meta-llama/llama-4-scout:free (presets: ...)
```

- [ ] **Step 2: Check the API response**

```bash
curl -s http://127.0.0.1:3001/api/v1/health/models | jq '.upgrades'
```

Expected: Array of `UpgradeSuggestion` objects (may be empty if no prefix matches found — that's ok, it means current preset models don't have newer alternatives on the same provider).

- [ ] **Step 3: Start frontend and check UI**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npm run dev
```

Open the app, navigate to the waterfall pipeline preset picker. Check for:
- Blue upgrade badges on preset cards (if any upgrades were detected)
- Sonner toasts in bottom-right (if upgrades detected and not dismissed)
- Expanded model view shows blue upgrade indicators on affected models
- Clicking "Dismiss" on a toast removes it and persists to localStorage

- [ ] **Step 4: Verify dismiss persistence**

After dismissing a toast, refresh the page. The dismissed suggestion should not reappear as a toast or badge. Check `localStorage.getItem('solvent:dismissed-upgrades')` in browser console to confirm the key was saved.

- [ ] **Step 5: Commit all remaining changes if any cleanup needed**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley
git add -A
git commit -m "chore: cleanup after model upgrade suggestions integration test"
```

---

## Self-Review

**Spec coverage check:**
- Prefix matching in backend ✓ (Task 1)
- `UpgradeSuggestion` type ✓ (Task 1 Step 1)
- Extended scan result ✓ (Task 1 Step 1, Step 4)
- Same endpoint, no new routes ✓ (no route changes)
- Toast on launch ✓ (Task 3)
- Max 3 toasts ✓ (Task 3 Step 2 `.slice(0, 3)`)
- Inline badge on preset card ✓ (Task 2 Step 4)
- Expanded view upgrade indicator ✓ (Task 2 Step 5)
- Dismiss to localStorage ✓ (Task 2 Step 2)
- No auto-swap ✓ (no swap buttons)

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code blocks are complete.

**Type consistency:** `UpgradeSuggestion` has identical shape in backend (Task 1 Step 1) and frontend (Task 2 Step 1). `upgradeKey()` format `"provider:model→successor"` is used consistently in dismiss helpers and toast handler.
