# SolventSee Bug Fixes — 13 Issues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 13 bugs identified in the code review of the Task 11-12 SolventSee + FAL.ai merge, ordered from most to least critical.

**Architecture:** Fixes are spread across backend services (`aiService.ts`, `falService.ts`, `config.ts`) and frontend components (`ExportTool.tsx`, `SolventSeeArea.tsx`, `CropTool.tsx`, `ImageProviderSelector.tsx`, `ManualEditTools.tsx`). No new files are needed — all changes are targeted edits to existing files.

**Tech Stack:** TypeScript (backend Node/Express, frontend React + Zustand + Framer Motion + Tailwind)

---

## Task 1: Fix Gemini image path TypeError (Critical #1)

**Files:**
- Modify: `backend/src/services/aiService.ts:446-462`

**Problem:** `gemini.complete()` returns `Promise<string>`, but the code calls `result.base64` on that string — which is `undefined`. This causes `Buffer.from(undefined, 'base64')` to throw a TypeError at runtime. The entire Gemini Imagen branch is broken.

**Fix:** The `gemini.complete()` plugin abstraction is a text-completion method, not an image-generation API. Remove the broken Gemini Imagen stub entirely and let the code fall through directly to the working Pollinations fallback. This is the correct minimal fix — Gemini Imagen requires a separate SDK integration that doesn't exist yet.

**Step 1: Edit `aiService.ts` — remove the broken Gemini try/catch block**

Replace lines 446–462 (the Gemini image try/catch that calls `gemini.complete`) with a direct call to Pollinations:

```typescript
// BEFORE (lines 446-462):
try {
  const gemini = await AIProviderFactory.getProvider('gemini');
  const geminiKey = options.apiKeys?.gemini || apiKey || config.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('Gemini API key missing');
  const result = await gemini.complete([{role: 'user', content: `Generate an image with the prompt: ${prompt}`}], {
    model: model || 'imagen-3.0-generate-001',
    apiKey: geminiKey
  });
  return this.saveImage(result.base64);
} catch (error: any) {
  try {
    const result = await pollinationsService.generateImage(prompt);
    return this.saveImage(result.base64, 'Pollinations.ai');
  } catch (pollError: any) {
    throw SolventError.provider('All image providers failed.');
  }
}

// AFTER:
try {
  const result = await pollinationsService.generateImage(prompt);
  return this.saveImage(result.base64, 'Pollinations.ai');
} catch (pollError: any) {
  throw SolventError.provider('All image providers failed.');
}
```

**Step 2: Commit**

```bash
git add backend/src/services/aiService.ts
git commit -m "fix: remove broken Gemini image path that called result.base64 on a string"
```

---

## Task 2: Fix ExportTool permanent freeze on image load failure (Critical #3)

**Files:**
- Modify: `frontend/src/components/ExportTool.tsx:81-115`

**Problem:** `new Image()` has an `onload` handler but no `onerror` handler. If `selectedImage` is a URL that fails to load (backend down, invalid path), `setIsExporting(false)` is never called and the UI freezes permanently in "Exporting..." state with no recovery.

**Step 1: Add `img.onerror` handler in `handleExport`**

In `ExportTool.tsx`, after `img.onload = () => { ... };`, add:

```typescript
img.onerror = () => {
  setIsExporting(false);
};
```

Full updated `handleExport` function (lines 81–115):

```typescript
const handleExport = () => {
  if (!selectedImage) return;
  setIsExporting(true);

  const img = new Image();
  img.onload = () => {
    const w = resizeEnabled ? resizeW : img.naturalWidth;
    const h = resizeEnabled ? resizeH : img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.drawImage(img, 0, 0, w, h);

    const q = format === 'image/png' ? undefined : quality / 100;
    const dataUrl = canvas.toDataURL(format, q);

    const ext  = format.split('/')[1] === 'jpeg' ? 'jpg' : format.split('/')[1];
    const link = document.createElement('a');
    link.href     = dataUrl;
    link.download = `solvent-export.${ext}`;
    link.click();

    setIsExporting(false);
  };
  img.onerror = () => {
    setIsExporting(false);
  };
  img.src = selectedImage;
};
```

**Step 2: Commit**

```bash
git add frontend/src/components/ExportTool.tsx
git commit -m "fix: add img.onerror handler in ExportTool to prevent permanent freeze on load failure"
```

---

## Task 3: Fix CropTool discriminated union violation (Critical #2)

**Files:**
- Modify: `frontend/src/components/SolventSeeArea.tsx:693-705`

**Problem:** The `CropTool` JSX call site passes all props for both `CropModeProps` and `SelectModeProps` simultaneously. TypeScript's discriminated union provides no protection here — with strict excess property checking it's a compile error, and it masks potential future bugs.

**Step 1: Split the JSX call into two conditional renders**

Replace the single `<CropTool ... />` block (lines 693–705) with:

```tsx
{isOverlayTool && activeTool === 'crop' && (
  <CropTool
    mode="crop"
    selection={selection}
    activeAspect={activeAspect}
    onAspectChange={setActiveAspect}
    onApply={handleApplyCrop}
    onCancel={() => setSelection(null)}
    disabled={!selectedImage || isProcessing}
  />
)}

{isOverlayTool && activeTool === 'select' && (
  <CropTool
    mode="select"
    selection={selection}
    onCut={handleCutSelection}
    onCopy={handleCopySelection}
    onCancel={() => setSelection(null)}
    disabled={!selectedImage || isProcessing}
  />
)}
```

Remove the original `{isOverlayTool && (<CropTool mode={activeTool as 'crop' | 'select'} ... />)}` block entirely.

**Step 2: Commit**

```bash
git add frontend/src/components/SolventSeeArea.tsx
git commit -m "fix: split CropTool JSX into mode-specific conditional renders to satisfy discriminated union"
```

---

## Task 4: Add timeout to FAL.ai polling requests (High #4)

**Files:**
- Modify: `backend/src/services/falService.ts:46-48`

**Problem:** The polling `axios.get` inside the FAL queue loop has no `timeout`. If the FAL result endpoint hangs, the poll blocks indefinitely, stalling the whole loop.

**Step 1: Add `timeout: 10_000` to the polling axios.get**

Replace:
```typescript
const pollRes = await axios.get(resultUrl, {
  headers: { Authorization: `Key ${apiKey}` },
});
```

With:
```typescript
const pollRes = await axios.get(resultUrl, {
  headers: { Authorization: `Key ${apiKey}` },
  timeout: 10_000,
});
```

**Step 2: Commit**

```bash
git add backend/src/services/falService.ts
git commit -m "fix: add 10s timeout to FAL.ai polling axios.get to prevent indefinite hangs"
```

---

## Task 5: Hide unimplemented providers from ImageProviderSelector (High #5)

**Files:**
- Modify: `frontend/src/components/ImageProviderSelector.tsx:54-73`

**Problem:** `openai` (DALL-E 3) and `replicate` are shown as selectable options in the UI, but `aiService.generateImage()` has no backend implementation for either. Selecting them silently falls through to Pollinations. `huggingface` is marked `free: true` but requires an API key, so users without a key can select it and get a backend error.

**Step 1: Remove `openai` and `replicate` from `IMAGE_PROVIDERS` array**

In `ImageProviderSelector.tsx`, delete the two provider definition objects for `openai` and `replicate` (lines 54–73):

```typescript
// DELETE these two objects from the IMAGE_PROVIDERS array:
{
  id:       'openai',
  label:    'DALL-E 3',
  desc:     'OpenAI · High accuracy',
  free:     false,
  keyName:  'openai',
  icon:     Sparkles,
  color:    'text-jb-accent',
  bgColor:  'bg-jb-accent/10',
},
{
  id:       'replicate',
  label:    'Replicate',
  desc:     'Flexible model hub',
  free:     false,
  keyName:  'replicate',
  icon:     Globe,
  color:    'text-purple-400',
  bgColor:  'bg-purple-500/10',
},
```

**Step 2: Fix `huggingface` provider — set `free: false`**

Change:
```typescript
{
  id:       'huggingface',
  label:    'Hugging Face',
  desc:     'Free tier · SDXL models',
  free:     true,
  keyName:  'huggingface',
  ...
},
```
To:
```typescript
{
  id:       'huggingface',
  label:    'Hugging Face',
  desc:     'Requires API key · SDXL models',
  free:     false,
  keyName:  'huggingface',
  ...
},
```

**Step 3: Also update the `ProviderId` type to remove `openai` and `replicate`**

Change line 9:
```typescript
// BEFORE:
type ProviderId = 'pollinations' | 'huggingface' | 'fal' | 'openai' | 'replicate' | 'local';

// AFTER:
type ProviderId = 'pollinations' | 'huggingface' | 'fal' | 'local';
```

**Step 4: Commit**

```bash
git add frontend/src/components/ImageProviderSelector.tsx
git commit -m "fix: remove unimplemented openai/replicate providers; fix huggingface free flag"
```

---

## Task 6: Fix `config.ts` secret strength regex (High #6)

**Files:**
- Modify: `backend/src/config.ts:55-58`

**Problem:** The regex `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)` requires uppercase letters. But the recommended generation command `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` produces only lowercase hex. So every developer using the documented command sees a spurious warning on every server start.

**Step 1: Replace the regex check with a simple length check**

Replace lines 55–58:
```typescript
// BEFORE:
if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{32,}$/.test(config.BACKEND_INTERNAL_SECRET)) {
  console.warn('⚠️  WARNING: BACKEND_INTERNAL_SECRET may be weak. It should contain uppercase, lowercase, and numbers.');
  console.warn('   Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

// AFTER:
if (config.BACKEND_INTERNAL_SECRET.length < 32) {
  console.warn('⚠️  WARNING: BACKEND_INTERNAL_SECRET is shorter than 32 characters and may be weak.');
  console.warn('   Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}
```

Note: The `z.string().min(32)` Zod schema already enforces minimum length at startup (and exits if it fails), so this warn block is effectively a belt-and-suspenders notice for future changes. The simple length check is accurate and won't false-positive.

**Step 2: Commit**

```bash
git add backend/src/config.ts
git commit -m "fix: replace broken secret strength regex with simple length check that matches recommended generation command"
```

---

## Task 7: Fix resize event listener stale closure / leak (High #7)

**Files:**
- Modify: `frontend/src/components/SolventSeeArea.tsx:136-141`

**Problem:** `startResizing` is not wrapped in `useCallback`, so it captures a potentially stale `stopResizing` reference. If a re-render occurs mid-drag, `removeEventListener` in `stopResizing` targets the stale function reference, leaving a dangling `mouseup` listener.

**Step 1: Wrap `startResizing` in `useCallback` with `[handleMouseMove, stopResizing]` deps**

Replace:
```typescript
const startResizing = () => {
  isResizing.current = true;
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', stopResizing);
  document.body.style.cursor = 'col-resize';
};
```

With:
```typescript
const startResizing = useCallback(() => {
  isResizing.current = true;
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', stopResizing);
  document.body.style.cursor = 'col-resize';
}, [handleMouseMove, stopResizing]);
```

**Step 2: Commit**

```bash
git add frontend/src/components/SolventSeeArea.tsx
git commit -m "fix: wrap startResizing in useCallback to prevent stale closure event listener leak"
```

---

## Task 8: Fix overly broad image intent detection (Medium #8)

**Files:**
- Modify: `backend/src/services/aiService.ts:36,184-188`

**Problem:** `EXPLICIT_IMAGE_INTENT_REGEX` matches bare verbs like "create", "make", "render" at the start of a message. In `vision` mode, "Create a REST API" triggers image generation because `isExplicitIntent` satisfies both the regex and the mode check. The `IMAGE_INTENT_CLEANUP_REGEX` then strips those words, producing a near-empty image prompt.

**Step 1: Tighten `EXPLICIT_IMAGE_INTENT_REGEX` to require an image noun**

Replace line 36:
```typescript
// BEFORE:
const EXPLICIT_IMAGE_INTENT_REGEX = /^(draw|imagine|visualize|generate|make|create)\b/i;

// AFTER:
const EXPLICIT_IMAGE_INTENT_REGEX = /^(draw|imagine|visualize)\b|(generate|make|create)\b.{0,60}\b(image|picture|photo|art|illustration|graphic|sketch|painting)\b/i;
```

This ensures that broad verbs like "create", "generate", "make" only match as explicit image intent when an image-specific noun appears within 60 characters. Narrow verbs like "draw", "imagine", "visualize" are still matched on their own since they are unambiguous.

**Step 2: Commit**

```bash
git add backend/src/services/aiService.ts
git commit -m "fix: tighten image intent regex to prevent false positives on 'create/make/render' without image noun"
```

---

## Task 9: Remove duplicate SliderRow from ExportTool (Medium #9)

**Files:**
- Modify: `frontend/src/components/ExportTool.tsx:21-53`
- Modify: `frontend/src/components/ManualEditTools.tsx:72-80` (verify export is already there)

**Problem:** `ExportTool` defines its own local `SliderRow` (lines 33–53) instead of importing the already-exported `SliderRow` from `ManualEditTools`. The two implementations have already drifted — `ManualEditTools.SliderRow` wraps the `input` in a `<div className="relative">`, ExportTool's copy does not. Future changes to one won't reflect in the other.

**Step 1: Verify `SliderRow` is exported from `ManualEditTools.tsx`**

Confirm line 82 in `ManualEditTools.tsx` reads `export const SliderRow = ...` — it does.

**Step 2: In `ExportTool.tsx`, add import and remove local definition**

Add to imports at top of `ExportTool.tsx`:
```typescript
import { SliderRow } from './ManualEditTools';
```

Remove the entire local `SliderRow` definition block (lines 22–53, including the `interface SliderRowProps` and `const SliderRow = ...` declarations).

**Step 3: Commit**

```bash
git add frontend/src/components/ExportTool.tsx
git commit -m "fix: remove duplicate SliderRow from ExportTool, import from ManualEditTools"
```

---

## Task 10: Move ToolGrid outside SolventSeeArea component body (Medium #10)

**Files:**
- Modify: `frontend/src/components/SolventSeeArea.tsx:352-389`

**Problem:** `ToolGrid` is defined as a `const` inside `SolventSeeArea`'s render function. React sees a brand-new component type on every render, causing full unmount + remount of all `ToolGrid` children on every state change in `SolventSeeArea` (including mouse moves during resize and every keystroke in the instruction input).

**Step 1: Extract `ToolGrid` as a proper component above `SolventSeeArea`**

Define a typed props interface and extract the component above the `SolventSeeArea` function definition:

```typescript
// Add above SolventSeeArea function, after the constants section:

interface ToolGridProps {
  activeTool: string;
  setActiveTool: (id: string) => void;
  setSelection: (s: SelectionRect | null) => void;
}

const ToolGridComponent: React.FC<ToolGridProps> = ({ activeTool, setActiveTool, setSelection }) => (
  <div className="space-y-3 shrink-0">
    {TOOL_GRID.map((section) => (
      <div key={section.label}>
        <span className="text-[7px] font-black text-slate-700 uppercase tracking-[0.3em] block mb-1.5 px-0.5">
          {section.label}
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {section.tools.map((tool) => {
            const Icon     = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => {
                  setActiveTool(tool.id);
                  if (!OVERLAY_TOOLS.includes(tool.id)) setSelection(null);
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all border',
                  isActive
                    ? cn(tool.accent, 'border-white/10', tool.color)
                    : 'bg-white/[0.02] border-white/5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] hover:border-white/8',
                )}
              >
                <Icon size={14} />
                <span className="text-[8px] font-black uppercase tracking-wide leading-none text-center">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);
```

**Step 2: Remove the inline `const ToolGrid = () => (...)` from inside `SolventSeeArea` (lines 352–389)**

**Step 3: Update the JSX call site inside `SolventSeeArea`**

Replace `<ToolGrid />` with:
```tsx
<ToolGridComponent
  activeTool={activeTool}
  setActiveTool={setActiveTool}
  setSelection={setSelection}
/>
```

**Step 4: Commit**

```bash
git add frontend/src/components/SolventSeeArea.tsx
git commit -m "fix: extract ToolGrid outside SolventSeeArea to prevent full remount on every state change"
```

---

## Task 11: Add logging to empty catch blocks in fallback chain (Medium #11)

**Files:**
- Modify: `backend/src/services/aiService.ts:401,409`

**Problem:** Two `catch (e) {}` blocks in `handleFallbacks()` silently discard all errors from the Groq and OpenRouter fallback attempts. When all providers fail, the only error surfaced is the last Ollama error — Groq and OpenRouter failures are invisible in logs, making multi-provider debugging extremely painful.

**Step 1: Add warn-level logging to both empty catch blocks**

Replace:
```typescript
// Line 401:
} catch (e) {}

// Line 409:
} catch (e) {}
```

With:
```typescript
// Line 401:
} catch (e: unknown) {
  logger.warn('[Fallback] Groq failed', e instanceof Error ? e.message : e);
}

// Line 409:
} catch (e: unknown) {
  logger.warn('[Fallback] OpenRouter failed', e instanceof Error ? e.message : e);
}
```

**Step 2: Commit**

```bash
git add backend/src/services/aiService.ts
git commit -m "fix: log warnings in fallback chain catch blocks instead of silently swallowing errors"
```

---

## Task 12: Fix inconsistent secret enforcement posture in config.ts (Low #12)

**Files:**
- Modify: `backend/src/config.ts:54-58`

**Problem:** After Task 6 fixes the regex, this task is now a minor polish item. The old-default check exits with `process.exit(1)`, but the weakness check only warns. If the weakness check is meaningful (it is, as belt-and-suspenders), it should at minimum be clearly documented as a non-fatal warning. This task just adds a comment to document the intentional inconsistency.

**Step 1: Add a brief comment explaining the non-fatal warning posture**

After the `process.exit(1)` block (line 52), before the length warning block, add:

```typescript
// Warn (non-fatal) if the secret is shorter than expected.
// The Zod schema above already enforces min length=32 and will exit if violated.
// This check is a secondary safeguard in case the schema is loosened in future.
```

**Step 2: Commit**

```bash
git add backend/src/config.ts
git commit -m "chore: document intentional non-fatal posture for secret strength warning in config"
```

---

## Task 13: Add privacy note to FAL.ai prompt logging (Low #13)

**Files:**
- Modify: `backend/src/services/falService.ts:19`

**Problem:** User prompt content (up to 80 chars) is logged at `info` level. In deployments where logs are aggregated (e.g., Datadog, CloudWatch), this may capture PII or sensitive user intent. Low severity but worth a comment.

**Step 1: Downgrade FAL prompt log from `info` to `debug`**

Replace line 19:
```typescript
// BEFORE:
logger.info(`[FAL] Generating image: "${prompt.slice(0, 80)}..."`);

// AFTER:
logger.debug(`[FAL] Generating image: "${prompt.slice(0, 80)}..."`);
```

**Step 2: Commit**

```bash
git add backend/src/services/falService.ts
git commit -m "chore: downgrade FAL prompt content log from info to debug to reduce PII exposure risk"
```

---

## Final Verification

After all tasks are complete, run the full build and type-check to confirm no regressions:

```bash
# From the worktree root
cd backend && npx tsc --noEmit && cd ..
cd frontend && npx tsc --noEmit && cd ..
```

Expected: No TypeScript errors on either side.
