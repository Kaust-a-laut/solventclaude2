# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce resource consumption across the Solvent AI Electron app without sacrificing functionality or visual experience, with device-adaptive behavior for budget hardware.

**Architecture:** A performance tier system (`full`/`lite`/`auto`) is built first as the foundation. Tier-independent optimizations (memory leaks, D3 tree-shaking, build config, backend resource management) run alongside. Tier-dependent optimizations (animation complexity, telemetry intervals, virtualization buffer sizes) consume the tier reactively from the Zustand store.

**Tech Stack:** React 18, Zustand 4.5, Framer Motion, D3.js, Monaco Editor, WebContainer API, Vite 7, Electron, Express, BullMQ, Socket.io, esbuild

**Spec:** `docs/superpowers/specs/2026-03-25-performance-optimization-design.md`

---

## File Structure

### New Files
- `frontend/src/lib/performanceTier.ts` — Tier types, detection logic, tier-aware utility hooks
- `frontend/src/store/performanceSlice.ts` — Performance tier Zustand slice
- `frontend/src/lib/useVirtualMessages.ts` — Virtualized message list hook
- `frontend/src/lib/animationUtils.ts` — Tier-aware animation helpers (CSS vs spring)
- `frontend/public/fonts/` — Self-hosted font files (Geist, Inter Tight, JetBrains Mono)
- `frontend/src/lib/socketBatcher.ts` — Client-side Socket.io event batcher
- `backend/src/lib/socketBatcher.ts` — Server-side Socket.io event batcher

### Modified Files
- `frontend/src/store/useAppStore.ts` — Add performance slice
- `frontend/src/store/types.ts` — Add PerformanceSlice to AppState
- `frontend/src/components/MessageList.tsx` — Virtualized rendering
- `frontend/src/components/MessageItem.tsx` — Tier-aware animation
- `frontend/src/components/KnowledgeMap.tsx` — Granular D3 imports, data join, tier-aware node cap
- `frontend/src/components/CodingArea.tsx` — Deferred WebContainer boot, tier-aware Monaco config
- `frontend/src/components/SettingsModal.tsx` — Performance Mode toggle in Behavior tab
- `frontend/src/main.tsx` — Simplified scroll lock
- `frontend/src/index.css` — Self-hosted font declarations
- `frontend/vite.config.ts` — Manual chunk splitting
- `frontend/package.json` — Add @tanstack/react-virtual
- `electron/main.ts` — Tier-aware telemetry, notepad debounce, stdio pipe
- `package.json` (root) — Add --minify to esbuild commands
- `backend/src/services/vectorService.ts` — Debounced HNSW save
- `backend/src/services/contextService.ts` — Capped retrieval
- `backend/src/server.ts` — Socket.io event batching
- `backend/src/worker.ts` — Lazy worker activation

---

## Phase 1: Performance Tier Foundation

### Task 1: Performance Tier Types and Store Slice

**Files:**
- Create: `frontend/src/lib/performanceTier.ts`
- Create: `frontend/src/store/performanceSlice.ts`
- Modify: `frontend/src/store/types.ts`
- Modify: `frontend/src/store/useAppStore.ts`

- [ ] **Step 1: Create the performance tier types and detection utility**

Create `frontend/src/lib/performanceTier.ts`:

```typescript
export type PerformanceTier = 'full' | 'lite';
export type PerformanceMode = 'auto' | 'full' | 'lite';

export interface DeviceCapability {
  ramGB: number;
  cpuCores: number;
  hasDiscreteGPU: boolean;
}

/**
 * Classify device as lite only if ALL three constraints are met:
 * - Under 8GB RAM
 * - 4 or fewer CPU cores
 * - Integrated GPU only
 */
export function detectTier(cap: DeviceCapability): PerformanceTier {
  const isLite = cap.ramGB < 8 && cap.cpuCores <= 4 && !cap.hasDiscreteGPU;
  return isLite ? 'lite' : 'full';
}

export function resolveTier(mode: PerformanceMode, detected: PerformanceTier): PerformanceTier {
  if (mode === 'auto') return detected;
  return mode;
}

/** Tier-aware constants */
export const TIER_CONFIG = {
  full: {
    telemetryIntervalMs: 10_000,
    socketBatchMs: 100,
    messageBufferSize: 20,
    knowledgeMapMaxNodes: Infinity,
    forceSimIterations: 300,
    monacoMinimap: true,
    monacoBracketColors: true,
  },
  lite: {
    telemetryIntervalMs: 30_000,
    socketBatchMs: 250,
    messageBufferSize: 10,
    knowledgeMapMaxNodes: 100,
    forceSimIterations: 100,
    monacoMinimap: false,
    monacoBracketColors: false,
  },
} as const;
```

- [ ] **Step 2: Create the performance Zustand slice**

Create `frontend/src/store/performanceSlice.ts`:

```typescript
import { StateCreator } from 'zustand';
import { AppState } from './types';
import {
  PerformanceTier,
  PerformanceMode,
  resolveTier,
} from '../lib/performanceTier';

export interface PerformanceSlice {
  performanceMode: PerformanceMode;
  detectedTier: PerformanceTier;
  activeTier: PerformanceTier;
  setPerformanceMode: (mode: PerformanceMode) => void;
  setDetectedTier: (tier: PerformanceTier) => void;
}

export const createPerformanceSlice: StateCreator<AppState, [], [], PerformanceSlice> = (set) => ({
  performanceMode: 'auto',
  detectedTier: 'full',
  activeTier: 'full',
  setPerformanceMode: (mode) =>
    set((state) => ({
      performanceMode: mode,
      activeTier: resolveTier(mode, state.detectedTier),
    })),
  setDetectedTier: (tier) =>
    set((state) => ({
      detectedTier: tier,
      activeTier: resolveTier(state.performanceMode, tier),
    })),
});
```

- [ ] **Step 3: Add PerformanceSlice to the AppState type**

In `frontend/src/store/types.ts`, add to the AppState intersection type:

```typescript
import { PerformanceSlice } from './performanceSlice';

// Add PerformanceSlice to the existing AppState type union:
export type AppState = ChatSlice & SettingsSlice & GraphSlice & ActionSlice & WaterfallSlice & CodingSlice & CollaborateSlice & PerformanceSlice;
```

- [ ] **Step 4: Wire the slice into useAppStore**

In `frontend/src/store/useAppStore.ts`, add the import and spread:

```typescript
import { createPerformanceSlice } from './performanceSlice';

export const useAppStore = create<AppState>()((...a) => ({
  ...createChatSlice(...a),
  ...createSettingsSlice(...a),
  ...createGraphSlice(...a),
  ...createActionSlice(...a),
  ...createWaterfallSlice(...a),
  ...createCodingSlice(...a),
  ...createCollaborateSlice(...a),
  ...createPerformanceSlice(...a),
}));
```

- [ ] **Step 5: Verify the app still starts**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/performanceTier.ts frontend/src/store/performanceSlice.ts frontend/src/store/types.ts frontend/src/store/useAppStore.ts
git commit -m "feat: add performance tier system with types, detection, and Zustand slice"
```

---

### Task 2: Device Capability Detection in Electron

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: Add capability detection and IPC handler in electron/main.ts**

Add after the existing IPC handlers (near the `ipcMain.handle('get-session-secret', ...)` block):

```typescript
import * as os from 'os';

ipcMain.handle('get-device-capability', async () => {
  try {
    const mem = await si.mem();
    const cpuCores = os.cpus().length;
    let hasDiscreteGPU = false;
    try {
      const graphics = await si.graphics();
      hasDiscreteGPU = graphics.controllers.some(
        (c) => c.vram > 512 && !/intel|integrated/i.test(c.vendor || '')
      );
    } catch {}
    return {
      ramGB: Math.round(mem.total / (1024 * 1024 * 1024)),
      cpuCores,
      hasDiscreteGPU,
    };
  } catch {
    return { ramGB: 16, cpuCores: 8, hasDiscreteGPU: false }; // safe fallback
  }
});
```

- [ ] **Step 2: Expose via preload**

In `electron/preload.ts`, add to the `contextBridge.exposeInMainWorld('electron', { ... })` object:

```typescript
getDeviceCapability: () => ipcRenderer.invoke('get-device-capability'),
```

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts electron/preload.ts
git commit -m "feat: add device capability detection IPC for performance tier"
```

---

### Task 3: Auto-Detection on App Startup

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Add detection call after React renders**

In `frontend/src/main.tsx`, add after the `createRoot` / `render` call:

```typescript
import { useAppStore } from './store/useAppStore';
import { detectTier, type DeviceCapability } from './lib/performanceTier';

// Detect performance tier on startup (Electron only)
if (window.electron?.getDeviceCapability) {
  window.electron.getDeviceCapability().then((cap: DeviceCapability) => {
    const tier = detectTier(cap);
    useAppStore.getState().setDetectedTier(tier);
    console.log(`[Performance] Detected tier: ${tier}`, cap);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "feat: auto-detect performance tier on Electron startup"
```

---

### Task 4: Performance Mode Toggle in Settings

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`

- [ ] **Step 1: Add the Performance Mode control to the Behavior tab**

In `SettingsModal.tsx`, find the "Assistant Features" section in the Behavior tab (the `<section>` containing `InlineToggle` components for Smart Router, Extended Thinking, Coding Assistant). Add a new section after it:

```typescript
{/* Performance */}
<section className="space-y-2 pt-6 border-t border-white/5">
  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Performance</h4>
  <div className="bg-white/[0.02] border border-white/5 rounded-2xl px-5">
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-col gap-0.5 pr-8">
        <span className="text-xs font-bold text-white">Performance Mode</span>
        <span className="text-[10px] text-slate-500 font-medium leading-snug">
          Auto detects your hardware. Full enables all visual effects. Lite reduces animation complexity and background work for smoother performance.
        </span>
      </div>
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(['auto', 'full', 'lite'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setPerformanceMode(mode)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
              performanceMode === mode
                ? "bg-jb-accent text-white shadow-[0_0_12px_rgba(60,113,247,0.3)]"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
    {performanceMode === 'auto' && (
      <div className="pb-3 -mt-1">
        <span className="text-[9px] text-slate-600 font-medium">
          Detected: <span className="text-slate-400 font-bold uppercase">{detectedTier}</span>
        </span>
      </div>
    )}
  </div>
</section>
```

- [ ] **Step 2: Wire up the store bindings**

At the top of the SettingsModal component, add selectors:

```typescript
const performanceMode = useAppStore(state => state.performanceMode);
const detectedTier = useAppStore(state => state.detectedTier);
const setPerformanceMode = useAppStore(state => state.setPerformanceMode);
```

- [ ] **Step 3: Verify the toggle renders correctly**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx
git commit -m "feat: add Performance Mode toggle (Auto/Full/Lite) to Settings Behavior tab"
```

---

## Phase 2: Frontend Rendering Optimizations

### Task 5: Message List Virtualization

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/useVirtualMessages.ts`
- Modify: `frontend/src/components/MessageList.tsx`
- Modify: `frontend/src/components/MessageItem.tsx`

- [ ] **Step 1: Install @tanstack/react-virtual**

Run: `cd frontend && npm install @tanstack/react-virtual`

- [ ] **Step 2: Create the virtualized message list hook**

Create `frontend/src/lib/useVirtualMessages.ts`:

```typescript
import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../store/useAppStore';
import { TIER_CONFIG } from './performanceTier';

export function useVirtualMessages() {
  const messages = useAppStore(state => state.messages);
  const isProcessing = useAppStore(state => state.isProcessing);
  const activeTier = useAppStore(state => state.activeTier);
  const scrollRef = useRef<HTMLDivElement>(null);

  const overscan = TIER_CONFIG[activeTier].messageBufferSize;

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120, // rough estimate, auto-measured after render
    overscan,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [messages.length, isProcessing]);

  return { scrollRef, virtualizer, messages };
}
```

- [ ] **Step 3: Rewrite MessageList to use virtualization**

Replace the contents of `frontend/src/components/MessageList.tsx`:

```typescript
import React from 'react';
import { MessageItem } from './MessageItem';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';
import { downloadImage } from '../lib/file-utils';
import { WaterfallVisualizer } from './WaterfallVisualizer';
import { useVirtualMessages } from '../lib/useVirtualMessages';

interface MessageListProps {
  compact?: boolean;
}

export const MessageList = ({ compact }: MessageListProps) => {
  const currentMode = useAppStore(state => state.currentMode);
  const isProcessing = useAppStore(state => state.isProcessing);
  const modeConfigs = useAppStore(state => state.modeConfigs);
  const selectedCloudModel = useAppStore(state => state.selectedCloudModel);
  const selectedLocalModel = useAppStore(state => state.selectedLocalModel);
  const globalProvider = useAppStore(state => state.globalProvider);
  const deviceInfo = useAppStore(state => state.deviceInfo);
  const imageProvider = useAppStore(state => state.imageProvider);

  const { scrollRef, virtualizer, messages } = useVirtualMessages();
  const isMobile = deviceInfo.isMobile;

  const config = modeConfigs[currentMode] || { provider: 'auto', model: selectedCloudModel };
  let activeModel = config.model;

  if (currentMode === 'vision') {
    activeModel = imageProvider === 'huggingface' ? 'Stable Diffusion' :
                  imageProvider === 'local' ? 'Juggernaut XL' :
                  imageProvider === 'pollinations' ? 'Flux (Free)' : 'Imagen 3';
  } else if (config.provider === 'auto') {
    activeModel = globalProvider === 'local' ? selectedLocalModel : selectedCloudModel;
  } else if (globalProvider === 'local' && config.provider === 'gemini') {
    activeModel = selectedLocalModel;
  }

  const getTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isVision = currentMode === 'vision';
  const isCoding = currentMode === 'coding';
  const isCompact = compact || isCoding || isVision;

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex-1 overflow-y-auto scrollbar-thin",
        isCompact ? "pt-20 pb-20" : "pt-[100px] pb-32",
        isMobile ? (compact ? "p-3 pt-16 pb-20" : "p-4 pt-20 pb-24") : "p-6"
      )}
    >
      <WaterfallVisualizer />

      {messages.length === 0 && !isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-24 pointer-events-none select-none">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-jb-accent/60 animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-slate-400">Ready when you are</p>
            <p className="text-[10px] text-slate-600 max-w-xs text-center leading-relaxed">
              Ask a question, share an idea, or drop in a file to get started.
            </p>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          className={isCompact ? "space-y-4" : "space-y-5"}
        >
          {virtualItems.map((virtualItem) => {
            const m = messages[virtualItem.index];
            const isNew = virtualItem.index >= messages.length - 2;
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <MessageItem
                  message={m}
                  isUser={m.role === 'user'}
                  modelName={m.role === 'user' ? 'User' : (m.model || activeModel)}
                  time={getTime()}
                  onDownloadImage={downloadImage}
                  compact={isCompact}
                  animate={isNew}
                />
              </div>
            );
          })}
        </div>
      )}

      {isProcessing && (
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-6">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-jb-accent/70 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-jb-accent/50 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-jb-accent/30 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-[10px] font-bold text-slate-600">
            {activeModel} is thinking
          </span>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Update MessageItem to accept an `animate` prop**

In `frontend/src/components/MessageItem.tsx`, add `animate` to the props interface:

```typescript
interface MessageItemProps {
  // ... existing props
  animate?: boolean;
}
```

Change the root `motion.div` to conditionally animate:

```typescript
// Replace motion.div with a conditional wrapper:
const Wrapper = animate ? motion.div : 'div';
const motionProps = animate
  ? { initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 } }
  : {};

return (
  <Wrapper
    {...motionProps}
    className={cn(
      "flex gap-4 max-w-none py-6 group relative first:mt-4",
      compact ? "px-4 py-3 gap-3" : "px-4 md:px-8",
      isUser ? "flex-row-reverse" : "flex-row"
    )}
  >
    {/* ... existing content unchanged ... */}
  </Wrapper>
);
```

- [ ] **Step 5: Remove AnimatePresence import from MessageList**

The `AnimatePresence` wrapper is no longer needed since virtualized items handle their own lifecycle. Remove the import of `AnimatePresence` from `framer-motion` in MessageList.tsx.

- [ ] **Step 6: Verify the app compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/useVirtualMessages.ts frontend/src/components/MessageList.tsx frontend/src/components/MessageItem.tsx
git commit -m "feat: virtualize message list with @tanstack/react-virtual, animate only newest messages"
```

---

### Task 6: Framer Motion Tier-Aware Animation Utilities

**Files:**
- Create: `frontend/src/lib/animationUtils.ts`

- [ ] **Step 1: Create tier-aware animation helpers**

Create `frontend/src/lib/animationUtils.ts`:

```typescript
import { useAppStore } from '../store/useAppStore';

type AnimationVariant = {
  initial: Record<string, any>;
  animate: Record<string, any>;
  exit?: Record<string, any>;
  transition?: Record<string, any>;
};

/**
 * Returns appropriate animation props based on the active tier.
 * - Full tier: uses Framer Motion spring physics
 * - Lite tier: uses simple CSS-friendly transitions (opacity/transform only)
 */
export function useTierAnimation(
  type: 'fadeIn' | 'slideUp' | 'scaleIn' | 'hero'
): AnimationVariant {
  const activeTier = useAppStore(state => state.activeTier);
  const isLite = activeTier === 'lite';

  switch (type) {
    case 'fadeIn':
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: isLite
          ? { duration: 0.15, ease: 'easeOut' }
          : { type: 'spring', stiffness: 300, damping: 30 },
      };

    case 'slideUp':
      return {
        initial: { opacity: 0, y: 15 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: isLite
          ? { duration: 0.15, ease: 'easeOut' }
          : { type: 'spring', stiffness: 400, damping: 25 },
      };

    case 'scaleIn':
      return {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.95, opacity: 0 },
        transition: isLite
          ? { duration: 0.12, ease: 'easeOut' }
          : { type: 'spring', stiffness: 400, damping: 30 },
      };

    case 'hero':
      // Hero animations always use spring physics regardless of tier
      return {
        initial: { scale: 0.9, opacity: 0, y: 20 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: { scale: 0.9, opacity: 0, y: 20 },
        transition: { type: 'spring', stiffness: 300, damping: 25 },
      };
  }
}

/**
 * On lite tier, disables layout animations that trigger expensive recalculations.
 * Returns the `layout` prop value for motion components.
 */
export function useTierLayout(): boolean | 'position' {
  const activeTier = useAppStore(state => state.activeTier);
  return activeTier === 'lite' ? false : true;
}
```

- [ ] **Step 2: Audit existing AnimatePresence usage across the app**

Search all `AnimatePresence` usage:

```bash
grep -rn "AnimatePresence" frontend/src/components/ --include="*.tsx"
```

For each instance:
- Verify children have proper `exit` props and unmount after exit (not just hidden)
- For simple fade/slide animations that are NOT hero moments (modal opens, panel transitions), consider replacing `motion.div` with a plain `div` that uses CSS transitions
- Add `will-change: transform` as an inline style on elements that animate position/scale (panels, modals, sidebars). Only on elements that actually animate — overuse wastes GPU memory

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/animationUtils.ts frontend/src/components/
git commit -m "feat: add tier-aware animation utilities, audit AnimatePresence exit behavior, add will-change hints"
```

---

### Task 7: D3.js Tree-Shaking and Knowledge Map Optimization

**Files:**
- Modify: `frontend/src/components/KnowledgeMap.tsx`

- [ ] **Step 1: Replace the wildcard D3 import with granular imports**

In `frontend/src/components/KnowledgeMap.tsx`, replace:

```typescript
import * as d3 from 'd3';
```

with:

```typescript
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceX, forceY } from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3Zoom } from 'd3-zoom';
import { drag as d3Drag } from 'd3-drag';
```

- [ ] **Step 2: Update all d3.xxx references to use the direct imports**

Throughout the component, replace:
- `d3.forceSimulation(...)` -> `forceSimulation(...)`
- `d3.forceLink(...)` -> `forceLink(...)`
- `d3.forceManyBody()` -> `forceManyBody()`
- `d3.forceCenter(...)` -> `forceCenter(...)`
- `d3.forceX(...)` -> `forceX(...)`
- `d3.forceY(...)` -> `forceY(...)`
- `d3.select(...)` -> `select(...)`
- `d3.zoom()` -> `d3Zoom()`
- `d3.drag()` -> `d3Drag()`

- [ ] **Step 3: Add tier-aware node cap**

Add at the top of the rendering useEffect, before the simulation setup:

```typescript
import { useAppStore } from '../store/useAppStore';
import { TIER_CONFIG } from '../lib/performanceTier';

// Inside the component:
const activeTier = useAppStore(state => state.activeTier);
const tierConfig = TIER_CONFIG[activeTier];

// Cap nodes for lite tier
let displayNodes = graphNodes;
let displayEdges = graphEdges;
if (displayNodes.length > tierConfig.knowledgeMapMaxNodes) {
  const nodeSet = new Set(displayNodes.slice(0, tierConfig.knowledgeMapMaxNodes).map(n => n.id));
  displayNodes = displayNodes.slice(0, tierConfig.knowledgeMapMaxNodes);
  displayEdges = displayEdges.filter(e => nodeSet.has(e.source) && nodeSet.has(e.target));
}
```

Use `displayNodes` and `displayEdges` instead of `graphNodes` and `graphEdges` in the simulation setup.

- [ ] **Step 4: Cap force simulation iterations on lite tier**

After creating the simulation, add:

```typescript
simulation.alphaDecay(activeTier === 'lite' ? 0.05 : 0.0228); // faster cooldown on lite
```

- [ ] **Step 5: Replace selectAll("*").remove() with D3 data join pattern**

Replace the clear-and-redraw pattern:

```typescript
// BEFORE:
d3.select(svgRef.current).selectAll("*").remove();
// ... recreate everything

// AFTER:
const svg = select(svgRef.current);
const g = svg.select('g.graph-container');

// Only create the container group once
if (g.empty()) {
  const container = svg.append('g').attr('class', 'graph-container');
  // Set up zoom on svg targeting the container
  const zoomBehavior = d3Zoom()
    .scaleExtent([0.1, 8])
    .on('zoom', (event) => container.attr('transform', event.transform));
  svg.call(zoomBehavior as any);
}

const container = svg.select('g.graph-container');

// Data join for links
const link = container.selectAll<SVGLineElement, any>('line.graph-link')
  .data(displayEdges, (d: any) => `${d.source}-${d.target}`);
link.exit().remove();
const linkEnter = link.enter().append('line').attr('class', 'graph-link');
const linkMerged = linkEnter.merge(link);

// Data join for nodes
const node = container.selectAll<SVGGElement, any>('g.graph-node')
  .data(displayNodes, (d: any) => d.id);
node.exit().remove();
const nodeEnter = node.enter().append('g').attr('class', 'graph-node');
const nodeMerged = nodeEnter.merge(node);

// Apply attributes to enter+update selections
// ... (existing styling code, applied to linkMerged and nodeMerged)
```

- [ ] **Step 6: Verify compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/KnowledgeMap.tsx
git commit -m "feat: tree-shake D3 imports, add data join pattern and tier-aware node cap to Knowledge Map"
```

---

### Task 8: Monaco + WebContainer Deferred Loading

**Files:**
- Modify: `frontend/src/components/CodingArea.tsx`

- [ ] **Step 1: Defer WebContainer boot to first user action**

In `frontend/src/components/CodingArea.tsx`, the `bootWebContainer` function is currently called eagerly. Find where `bootWebContainer()` is called in a `useEffect` on mount (or implicitly). Add a gate so it only boots when the user clicks "Run" or opens a terminal:

```typescript
const [bootRequested, setBootRequested] = useState(false);

// Only boot when explicitly requested
useEffect(() => {
  if (bootRequested && bootStatus === 'idle') {
    bootWebContainer();
  }
}, [bootRequested, bootStatus, bootWebContainer]);

// In the Run button onClick or terminal open handler:
const handleRun = () => {
  if (bootStatus === 'idle') {
    setBootRequested(true);
  }
  // ... existing run logic
};
```

Remove any existing `useEffect` that calls `bootWebContainer()` unconditionally on mount.

- [ ] **Step 2: Add tier-aware Monaco configuration**

In the Monaco `Editor` component props, add tier-aware options:

```typescript
import { useAppStore } from '../store/useAppStore';
import { TIER_CONFIG } from '../lib/performanceTier';

// Inside the component:
const activeTier = useAppStore(state => state.activeTier);
const tierConfig = TIER_CONFIG[activeTier];

// In the Editor component:
<Editor
  // ... existing props
  options={{
    // ... existing options
    minimap: { enabled: tierConfig.monacoMinimap },
    bracketPairColorization: { enabled: tierConfig.monacoBracketColors },
    // Reduce suggestion delay on lite to avoid UI jank
    quickSuggestionsDelay: activeTier === 'lite' ? 300 : 100,
  }}
/>
```

- [ ] **Step 3: Configure Monaco to load language workers on demand**

The `@monaco-editor/react` package loads language workers lazily by default via its CDN loader. Verify this by checking if there's a custom `monaco.config.ts` or `loader.config()` call that eagerly loads all languages. If found, remove it. If not found, no action needed — the default behavior is already on-demand.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CodingArea.tsx
git commit -m "feat: defer WebContainer boot to first user action, add tier-aware Monaco config"
```

---

### Task 9: Zustand Selector Optimization

**Files:**
- Modify: `frontend/src/components/MessageList.tsx`
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/src/components/KnowledgeMap.tsx`
- Modify: `frontend/src/components/CodingArea.tsx`
- Modify: any other component with multi-field selectors

- [ ] **Step 1: Add shallow import from zustand**

In each component file that selects multiple fields, add:

```typescript
import { useShallow } from 'zustand/react/shallow';
```

- [ ] **Step 2: Wrap multi-field selectors with useShallow**

Find all patterns like:

```typescript
const something = useAppStore(state => state.fieldA);
const other = useAppStore(state => state.fieldB);
```

Where the component has 4+ individual `useAppStore` calls that could be combined, consolidate into:

```typescript
const { fieldA, fieldB, fieldC, fieldD } = useAppStore(
  useShallow((state) => ({
    fieldA: state.fieldA,
    fieldB: state.fieldB,
    fieldC: state.fieldC,
    fieldD: state.fieldD,
  }))
);
```

**Priority components** (most selectors, most re-renders):
- `MessageList.tsx` — 8 individual selectors
- `SettingsModal.tsx` — many selectors across tabs
- `CodingArea.tsx` — multiple coding slice selectors
- `ChatArea.tsx` — mode and panel state selectors

- [ ] **Step 3: Verify the app compiles and renders correctly**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MessageList.tsx frontend/src/components/SettingsModal.tsx frontend/src/components/KnowledgeMap.tsx frontend/src/components/CodingArea.tsx
git commit -m "refactor: use useShallow for multi-field Zustand selectors to prevent unnecessary re-renders"
```

---

### Task 10: Terminal Output Ring Buffer

**Files:**
- Modify: `frontend/src/store/codingSlice.ts`

- [ ] **Step 1: Cap the terminalLines array**

In `frontend/src/store/codingSlice.ts`, find the `addTerminalLine` action and add a cap:

```typescript
const MAX_TERMINAL_LINES = 1000;

addTerminalLine: (line) => set((state) => {
  const lines = [...state.terminalLines, line];
  // Ring buffer: keep only the last MAX_TERMINAL_LINES entries
  if (lines.length > MAX_TERMINAL_LINES) {
    return { terminalLines: lines.slice(-MAX_TERMINAL_LINES) };
  }
  return { terminalLines: lines };
}),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/codingSlice.ts
git commit -m "fix: cap terminal output to 1000 lines to prevent unbounded memory growth"
```

---

## Phase 3: Electron Optimizations

### Task 11: Telemetry Loop Optimization

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Replace the fixed 2-second telemetry loop**

In `electron/main.ts`, replace the existing `setInterval(async () => { ... }, 2000)` telemetry block with a staggered, tier-aware version:

```typescript
// Tier-aware telemetry with staggered system calls
let telemetryInterval = 10_000; // default to full tier
let telemetryTick = 0;

// Allow renderer to update the interval based on detected tier
ipcMain.on('set-telemetry-interval', (_event, intervalMs: number) => {
  telemetryInterval = Math.max(5000, Math.min(60000, intervalMs));
});

const runTelemetry = async () => {
  try {
    telemetryTick++;
    let stats: Record<string, number> = {};

    // Stagger: CPU+mem every tick, network+disk every other tick
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    stats.cpu = Math.round(cpu.currentLoad);
    stats.mem = Math.round((mem.active / mem.total) * 100);

    if (telemetryTick % 2 === 0) {
      const network = await si.networkStats();
      const disk = await si.fsStats();
      stats.net = network[0] ? Math.round(network[0].rx_sec / 1024) : 0;
      stats.disk = disk.wx_sec ? Math.round(disk.wx_sec / 1024) : 0;
    }

    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('system-telemetry', stats);
    });
  } catch (e) {}

  setTimeout(runTelemetry, telemetryInterval);
};

// Start after a short delay to not compete with app startup
setTimeout(runTelemetry, 3000);
```

- [ ] **Step 2: Send tier-based interval from the renderer**

In `frontend/src/main.tsx`, after the tier detection code, add:

```typescript
if (window.electron?.getDeviceCapability) {
  window.electron.getDeviceCapability().then((cap: DeviceCapability) => {
    const tier = detectTier(cap);
    useAppStore.getState().setDetectedTier(tier);

    // Inform Electron main process of the appropriate telemetry interval
    const interval = TIER_CONFIG[tier].telemetryIntervalMs;
    window.electron?.setTelemetryInterval?.(interval);
  });
}
```

Add to `electron/preload.ts`:

```typescript
setTelemetryInterval: (ms: number) => ipcRenderer.send('set-telemetry-interval', ms),
```

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts electron/preload.ts frontend/src/main.tsx
git commit -m "feat: tier-aware staggered telemetry loop (10s full, 30s lite, staggered system calls)"
```

---

### Task 12: Notepad Watcher Debounce

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Increase debounce to 500ms**

In `electron/main.ts`, in the `fs.watch` block, change the debounce timeout:

```typescript
// BEFORE:
setTimeout(() => { fsWait = false; }, 100);

// AFTER:
setTimeout(() => { fsWait = false; }, 500);
```

The content-change check (`if (newContent !== notepadBuffer)`) is already in place, so no additional changes needed there.

- [ ] **Step 2: Commit**

```bash
git add electron/main.ts
git commit -m "fix: increase notepad file watcher debounce from 100ms to 500ms"
```

---

### Task 13: Electron Build Optimization

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add --minify and --tree-shaking=true to esbuild commands**

In the root `package.json`, update the `build:electron` script:

```json
"build:electron": "esbuild electron/preload.ts --outfile=electron/preload.js --bundle --platform=node --external:electron --minify --tree-shaking=true && esbuild electron/main.ts --outfile=electron/main.js --bundle --platform=node --external:electron --external:systeminformation --minify --tree-shaking=true"
```

- [ ] **Step 2: Verify the build still works**

Run: `npm run build:electron`
Expected: No errors, smaller output files

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: add --minify and --tree-shaking to Electron esbuild commands"
```

---

### Task 14: Backend stdio Optimization

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Switch backend spawn from 'inherit' to 'pipe'**

In `electron/main.ts`, in the production backend spawning block, change:

```typescript
// BEFORE:
const backendProcess = spawn('node', [backendPath], {
  env: { ...process.env, BACKEND_INTERNAL_SECRET: SESSION_SECRET, PORT: '3001' },
  stdio: 'inherit'
});

// AFTER:
const backendProcess = spawn('node', [backendPath], {
  env: { ...process.env, BACKEND_INTERNAL_SECRET: SESSION_SECRET, PORT: '3001' },
  stdio: ['ignore', 'pipe', 'pipe']
});

// Only forward stderr (errors) to the console
if (backendProcess.stderr) {
  backendProcess.stderr.on('data', (data: Buffer) => {
    console.error(`[Backend] ${data.toString().trimEnd()}`);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/main.ts
git commit -m "perf: switch backend child process to piped stdio, forward only stderr"
```

---

## Phase 4: Backend Optimizations

> **Note:** The spec called for adding LRU eviction to the embedding cache. Investigation found that `vectorService.ts` already implements LRU eviction with `MAX_CACHE_SIZE` (default 1000) and `lastAccess` timestamps. No task needed for this — it's already done.

### Task 15: Debounced HNSW Index Saves

**Files:**
- Modify: `backend/src/services/vectorService.ts`

- [ ] **Step 1: Add a debounced save mechanism**

In `backend/src/services/vectorService.ts`, add a debounced HNSW save timer. Find the `saveMemory` method and replace the periodic HNSW save logic:

```typescript
// Add as class properties:
private hnswSaveTimer: ReturnType<typeof setTimeout> | null = null;
private readonly HNSW_SAVE_DEBOUNCE_MS = 30_000;

// Replace this block in saveMemory():
// BEFORE:
// if (this.hnswIndex && this.useHNSW && this.saveCounter % 10 === 0) {
//   this.hnswIndex.save(this.hnswIndexPath).catch(e =>
//     logger.error('[VectorService] HNSW save failed', e)
//   );
// }

// AFTER:
if (this.hnswIndex && this.useHNSW) {
  this.scheduleHnswSave();
}
```

Add the debounce method:

```typescript
private scheduleHnswSave() {
  if (this.hnswSaveTimer) return; // already scheduled
  this.hnswSaveTimer = setTimeout(() => {
    this.hnswSaveTimer = null;
    if (this.hnswIndex) {
      this.hnswIndex.save(this.hnswIndexPath).catch(e =>
        logger.error('[VectorService] HNSW save failed', e)
      );
    }
  }, this.HNSW_SAVE_DEBOUNCE_MS);
}
```

- [ ] **Step 2: Flush on shutdown**

Add a `shutdown` method to ensure the HNSW index is saved when the process exits:

```typescript
async shutdown() {
  if (this.hnswSaveTimer) {
    clearTimeout(this.hnswSaveTimer);
    this.hnswSaveTimer = null;
  }
  if (this.hnswIndex && this.useHNSW) {
    await this.hnswIndex.save(this.hnswIndexPath);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/vectorService.ts
git commit -m "perf: debounce HNSW index saves to at most once per 30 seconds"
```

---

### Task 16: Context Retrieval Capping

**Files:**
- Modify: `backend/src/services/contextService.ts`

- [ ] **Step 1: Cap the maximum retrieval count**

In `backend/src/services/contextService.ts`, find the retrieval constants:

```typescript
// BEFORE:
const RETRIEVAL_COUNT_MASSIVE = 25;

// AFTER:
const RETRIEVAL_COUNT_MASSIVE = 15;
```

- [ ] **Step 2: Apply dedup threshold during retrieval rather than post-filter**

Find the line where `vectorService.search` is called:

```typescript
// BEFORE:
const relevantEntries = await vectorService.search(lastMessage, maxRetrievalCount * 3);

// AFTER:
const relevantEntries = await vectorService.search(lastMessage, maxRetrievalCount + 5);
```

The `* 3` over-fetch was to compensate for post-dedup filtering. By reducing the over-fetch factor, we retrieve fewer entries while still having a small buffer for dedup removal.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/contextService.ts
git commit -m "perf: cap context retrieval to 15 results, reduce over-fetch factor"
```

---

### Task 17: Socket.io Server-Side Event Batching

**Files:**
- Create: `backend/src/lib/socketBatcher.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Create the server-side event batcher**

Create `backend/src/lib/socketBatcher.ts`:

```typescript
import { Server } from 'socket.io';

export class SocketBatcher {
  private pending: Map<string, any[]> = new Map();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private io: Server;
  private batchWindowMs: number;

  constructor(io: Server, batchWindowMs = 100) {
    this.io = io;
    this.batchWindowMs = batchWindowMs;
  }

  emit(event: string, data: any) {
    const queue = this.pending.get(event) || [];
    queue.push(data);
    this.pending.set(event, queue);
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.flush();
    }, this.batchWindowMs);
  }

  private flush() {
    this.timer = null;
    for (const [event, items] of this.pending.entries()) {
      if (items.length === 1) {
        this.io.emit(event, items[0]);
      } else {
        this.io.emit(`${event}:batch`, items);
      }
    }
    this.pending.clear();
  }

  /** For events that should bypass batching (e.g., errors) */
  emitImmediate(event: string, data: any) {
    this.io.emit(event, data);
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.pending.clear();
  }
}
```

- [ ] **Step 2: Integrate the batcher into server.ts**

In `backend/src/server.ts`, after the `io` is created:

```typescript
import { SocketBatcher } from './lib/socketBatcher';

const batcher = new SocketBatcher(io, 100);

// Replace direct io.emit calls for high-frequency events:
// BEFORE:
// io.emit('MISSION_PROGRESS', { jobId, progress: data });

// AFTER:
batcher.emit('MISSION_PROGRESS', { jobId, progress: data });
```

Keep `io.emit` for low-frequency or critical events (errors, completion).

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/socketBatcher.ts backend/src/server.ts
git commit -m "perf: add Socket.io event batcher for high-frequency mission progress events"
```

---

### Task 18: BullMQ Lazy Worker Activation

**Files:**
- Modify: `backend/src/worker.ts`

- [ ] **Step 1: Replace eager worker creation with lazy activation**

In `backend/src/worker.ts`, wrap each worker in a lazy factory:

```typescript
import { Worker, QueueEvents, Queue } from 'bullmq';

const IDLE_TIMEOUT_MS = 60_000;

function createLazyWorker(
  queueName: string,
  processor: any,
  opts: { connection: any; concurrency: number }
) {
  let worker: Worker | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const queue = new Queue(queueName, { connection: opts.connection });

  const ensureWorker = () => {
    if (!worker) {
      worker = new Worker(queueName, processor, opts);
      logger.info(`[LazyWorker] Started worker for ${queueName}`);
      worker.on('completed', resetIdleTimer);
      worker.on('failed', resetIdleTimer);
    }
    resetIdleTimer();
  };

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      const waiting = await queue.getWaitingCount();
      if (waiting === 0 && worker) {
        await worker.close();
        worker = null;
        logger.info(`[LazyWorker] Idled worker for ${queueName}`);
      }
    }, IDLE_TIMEOUT_MS);
  };

  // Listen for new jobs to wake up the worker
  const events = new QueueEvents(queueName, { connection: opts.connection });
  events.on('waiting', () => ensureWorker());

  return { ensureWorker, events };
}

// Replace the 5 eager worker creations:
const indexingWorker = createLazyWorker(TaskQueue.INDEXING, indexProjectJob, {
  connection: redisConnection,
  concurrency: 1,
});

const memoryGardeningWorker = createLazyWorker(TaskQueue.MEMORY_GARDENING, memoryMaintenanceJob, {
  connection: redisConnection,
  concurrency: 2,
});

const imageGenWorker = createLazyWorker(TaskQueue.IMAGE_GEN, imageGenJob, {
  connection: redisConnection,
  concurrency: 3,
});

const orchestrationWorker = createLazyWorker(TaskQueue.ORCHESTRATION, orchestrationJob, {
  connection: redisConnection,
  concurrency: 2,
});

const defaultWorker = createLazyWorker(TaskQueue.DEFAULT, async (job: any) => {
  logger.warn(`[DefaultWorker] Received job of type: ${job.data.type}. No handler defined.`);
  return { success: true, message: 'No handler for this job type' };
}, {
  connection: redisConnection,
  concurrency: 5,
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/worker.ts
git commit -m "perf: lazy BullMQ worker activation with 60s idle timeout"
```

---

## Phase 5: Build & Font Optimization

### Task 19: Self-Host Google Fonts

**Files:**
- Create: `frontend/public/fonts/` (directory with font files)
- Modify: `frontend/src/index.css`
- Modify: `frontend/index.html` (add preload links)

- [ ] **Step 1: Download the font files**

Run from the project root:

```bash
mkdir -p frontend/public/fonts
cd frontend/public/fonts

# Geist (variable weight)
curl -Lo geist-variable.woff2 "https://fonts.gstatic.com/s/geist/v1/gyBhhwUxId8gMGYQMKR3pzfaWI_RnOQ.woff2"

# Inter Tight (variable weight)
curl -Lo inter-tight-variable.woff2 "https://fonts.gstatic.com/s/intertight/v7/NGSnv5HMAFg6IuGlBNMjxLsC66ZMtb8hyW62x0xCHi5XgqoUPvi5.woff2"

# JetBrains Mono (variable weight)
curl -Lo jetbrains-mono-variable.woff2 "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff2"
```

Note: If the exact URLs change, fetch the CSS from the Google Fonts URL in `index.css` and extract the woff2 URLs from it.

- [ ] **Step 2: Replace the @import with local @font-face declarations**

In `frontend/src/index.css`, replace line 1:

```css
/* BEFORE: */
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Inter+Tight:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');

/* AFTER: */
@font-face {
  font-family: 'Geist';
  src: url('/fonts/geist-variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: 'Inter Tight';
  src: url('/fonts/inter-tight-variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/jetbrains-mono-variable.woff2') format('woff2');
  font-weight: 100 800;
  font-display: swap;
}
```

- [ ] **Step 3: Add preload links to index.html**

In `frontend/index.html`, add inside `<head>` before any `<link>` or `<script>` tags:

```html
<link rel="preload" href="/fonts/geist-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/inter-tight-variable.woff2" as="font" type="font/woff2" crossorigin>
```

Only preload the two UI fonts (Geist and Inter Tight). JetBrains Mono is only used in code areas and can load lazily.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/fonts/ frontend/src/index.css frontend/index.html
git commit -m "perf: self-host Google Fonts with font-display swap and preload links"
```

---

### Task 20: Vite Bundle Optimization

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Add manual chunk splitting and bundle analysis**

In `frontend/vite.config.ts`, add a build configuration:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-markdown': ['react-markdown', 'react-syntax-highlighter', 'remark-gfm', 'marked'],
          'vendor-d3': ['d3-force', 'd3-selection', 'd3-zoom', 'd3-drag'],
          'vendor-zustand': ['zustand'],
        },
      },
    },
    // Target modern browsers for smaller output
    target: 'es2020',
  },
  server: {
    // ... existing server config unchanged
  },
  test: {
    // ... existing test config unchanged
  },
})
```

- [ ] **Step 2: Install rollup-plugin-visualizer for analysis (dev dependency)**

Run: `cd frontend && npm install -D rollup-plugin-visualizer`

Add to vite.config.ts plugins (only for analysis, can be toggled):

```typescript
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  react(),
  // Uncomment to generate bundle analysis:
  // visualizer({ open: true, gzipSize: true }),
],
```

- [ ] **Step 3: Build and verify chunks are split correctly**

Run: `cd frontend && npm run build`
Expected: Multiple chunk files in `dist/assets/` instead of one large bundle. Check that vendor chunks are separate.

- [ ] **Step 4: Verify Lucide icons are tree-shaken**

Enable the visualizer temporarily (`visualizer({ open: true, gzipSize: true })` in vite.config.ts plugins), run `npm run build`, and check the output. If `lucide-react` appears as a single large chunk (>200KB), individual icon imports are not being tree-shaken. In that case, switch imports throughout the app from:

```typescript
import { Search, X, Save } from 'lucide-react';
```

to direct path imports:

```typescript
import { Search } from 'lucide-react';
// (lucide-react v0.378+ with Vite should tree-shake named exports correctly)
```

If the visualizer shows lucide-react is already small (<50KB), no changes needed. Disable the visualizer after checking.

- [ ] **Step 5: Commit**

```bash
git add frontend/vite.config.ts frontend/package.json frontend/package-lock.json
git commit -m "build: add manual chunk splitting for heavy dependencies, add bundle visualizer"
```

---

## Phase 6: Comprehensive Audit

### Task 21: Memory Leak Audit

**Files:**
- Potentially modify: any frontend component with `useEffect`

Note: The initial investigation found that SolventSeeArea, SettingsModal, ChatInput, and ChatHeader already have proper cleanup. This task is a broader sweep.

- [ ] **Step 1: Search for all setInterval/setTimeout usage without cleanup**

Run from the project root:

```bash
cd frontend/src && grep -rn "setInterval\|setTimeout" --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."
```

For each result, verify it has a corresponding `clearInterval`/`clearTimeout` in a `useEffect` cleanup return. Fix any that don't.

- [ ] **Step 2: Search for all addEventListener usage without cleanup**

Run:

```bash
cd frontend/src && grep -rn "addEventListener" --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."
```

For each result, verify it has a corresponding `removeEventListener` in a cleanup function.

- [ ] **Step 3: Search for ResizeObserver and IntersectionObserver without disconnect**

Run:

```bash
cd frontend/src && grep -rn "ResizeObserver\|IntersectionObserver" --include="*.tsx" --include="*.ts" | grep -v node_modules
```

Verify each has a `.disconnect()` call in cleanup.

- [ ] **Step 4: Fix any issues found**

For each leaked listener/interval/observer, add proper cleanup in the `useEffect` return function.

- [ ] **Step 5: Commit**

```bash
git add -u frontend/src/
git commit -m "fix: comprehensive memory leak audit — ensure all intervals, listeners, and observers are cleaned up"
```

---

### Task 22: Scroll Lock Simplification

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Simplify the scroll lock to a single listener**

In `frontend/src/main.tsx`, replace the existing scroll lock block (3 separate listeners) with a single capture listener:

```typescript
// BEFORE: window.addEventListener + document.addEventListener + requestAnimationFrame root listener

// AFTER: Single capture listener on window handles all cases
const lockDocScroll = () => {
  document.documentElement.scrollTop = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollTop = 0;
  document.body.scrollLeft = 0;
};
window.addEventListener('scroll', lockDocScroll, { capture: true, passive: true });
```

The single capture listener on `window` with `capture: true` will catch scroll events from all targets (document, body, #root) during the capture phase, which is sufficient.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "refactor: simplify scroll lock to single passive capture listener"
```

---

## Verification

### Task 23: Final Build and Smoke Test

- [ ] **Step 1: Full TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full frontend build**

Run: `cd frontend && npm run build`
Expected: Successful build with split chunks visible in dist/assets/

- [ ] **Step 3: Full Electron build**

Run: `npm run build:electron`
Expected: Minified main.js and preload.js (significantly smaller than 637KB)

- [ ] **Step 4: Backend TypeScript check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run existing tests**

Run: `cd frontend && npm test` and `cd backend && npm test`
Expected: All existing tests pass

- [ ] **Step 6: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: final cleanup and verification after performance optimization"
```
