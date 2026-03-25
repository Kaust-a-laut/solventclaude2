# Performance Optimization Design Spec

**Date:** 2026-03-25
**Goal:** Reduce resource consumption across the Solvent AI Electron application without sacrificing functionality or visual experience.
**Approach:** Lean baseline optimizations + device-adaptive behavior with user-overridable performance tiers.
**Target devices:** Budget laptops (4-8GB RAM, integrated GPU, older CPUs) and any machine from ~2018 onward.

---

## 1. Memory Leak Fixes & Cleanup

These are correctness bugs that compound into performance problems on constrained devices.

### Uncleaned Intervals & Listeners

The following components have `setInterval`, `setTimeout`, or `addEventListener` calls without proper cleanup on unmount:

- **`SolventSeeArea`**: `setInterval(check, 10000)` — no cleanup in `useEffect` return
- **`SettingsModal`**: `setInterval(checkHealth, 10000)` — no cleanup return
- **`ChatInput`**, **`ChatHeader`**: `addEventListener` calls with incomplete cleanup paths

**Fix:** Audit every `setInterval`, `setTimeout`, `addEventListener`, and `ResizeObserver` in the frontend. Each must have a corresponding cleanup in the component's `useEffect` return function.

### Scroll Lock Hack (main.tsx)

The DPI scaling approach uses `scale(0.75)` on an oversized `#root` (133vw/133vh) and attaches multiple scroll listeners to `document`, `documentElement`, `body`, and `#root`. These fire on every scroll event.

**Fix:** Replace the multiple scroll listeners with a single passive listener, or move to a CSS-only approach if feasible. At minimum, mark the listeners as `{ passive: true }` to avoid blocking the compositor.

---

## 2. Rendering Performance — Message List & Framer Motion

### Message List Virtualization

`MessageList.tsx` currently renders every message with `AnimatePresence` wrapping each one. Long conversations (50+ messages) result in 50+ DOM nodes managed by Framer Motion simultaneously, most of them off-screen.

**Changes:**
- Introduce windowed/virtualized rendering (`react-window` or `@tanstack/virtual`) so only visible messages plus a small buffer exist in the DOM
- Only the newest 1-2 messages receive entrance animations. Existing messages are static DOM with no Framer Motion overhead
- Preserve scroll position and "scroll to bottom" behavior

### Framer Motion Audit

**Changes:**
- Audit all `AnimatePresence` usage. Ensure `exit` animations unmount children rather than hiding them
- Replace spring physics with CSS transitions where the animation is simple (opacity fades, basic slides). CSS transitions are GPU-composited and nearly free
- Add `will-change: transform` hints on elements that animate position/scale so the browser promotes them to compositing layers ahead of time
- Preserve expressive spring animations for hero moments: panel opens, mode transitions, and interactions where users notice the quality difference

---

## 3. Heavy Dependency Optimization

### D3.js Knowledge Map

Currently imports the full `d3` package (~250KB minified). Only force simulation and DOM selection are used.

**Changes:**
- Switch to granular imports: `d3-force`, `d3-selection`, `d3-zoom`, `d3-drag` — only what the Knowledge Map actually uses
- For large graphs (50+ nodes), cap the force simulation tick rate and use `requestAnimationFrame` instead of D3's default timer to sync with the browser's paint cycle
- Replace the `selectAll("*").remove()` full-redraw pattern with a D3 data join (enter/update/exit) so only changed nodes are modified

### Monaco Editor + WebContainer

~4MB combined. Currently initialize on component mount.

**Changes:**
- True lazy loading: don't download or initialize until the user actually opens the Coding Area tab. The lazy route loads the component, but the component must not eagerly boot WebContainer
- Load Monaco language workers on demand (only for languages the user opens, not all at once)
- Defer WebContainer `boot()` until the user performs an action that requires it (runs code, opens terminal), not on panel mount

### Lucide Icons

**Changes:**
- Verify Vite is tree-shaking individual icon imports from `lucide-react`
- If bundle analysis shows the full icon set is included, switch to direct path imports (e.g., `import Search from 'lucide-react/dist/esm/icons/search'`)

---

## 4. Zustand Store & Re-render Prevention

### Shallow Equality Selectors

Components that select multiple fields from the store (e.g., `useAppStore(state => ({ messages: state.messages, isProcessing: state.isProcessing }))`) create a new object on every store change, causing unnecessary re-renders.

**Fix:** Add Zustand's `shallow` comparator to all multi-field selectors.

### Stable Selector References

**Fix:** Extract frequently-used selectors as constants outside components (e.g., `const selectMessages = (state) => state.messages`). This prevents subscription churn from recreating selector functions on every render.

### Cross-Slice Subscription Audit

**Fix:** Verify each component subscribes to the narrowest slice of state it actually needs. Components that only need chat state should not re-render when graph state changes.

### Unbounded Array Growth

The `messages[]`, `terminalOutput`, and `graphNodes`/`graphEdges` arrays grow without bounds.

**Fix:**
- Terminal output: ring-buffer the last N entries (e.g., 1000 lines) instead of appending forever
- Messages: the virtualization from Section 2 handles rendering cost, but monitor raw array size for extremely long sessions
- Graph nodes/edges: cap based on the adaptive tier (see Section 7)

---

## 5. Electron Main Process

### System Telemetry Loop

Currently runs every 2 seconds, calling `systeminformation` for CPU, memory, network, and disk stats. Each call involves non-trivial system I/O that briefly blocks the main process event loop.

**Changes:**
- Increase default interval to 10 seconds (30 seconds on Lite tier — see Section 7)
- Stagger calls: Tick 1 collects CPU + memory. Tick 2 collects network + disk. This halves per-tick I/O
- Only collect stats that are currently displayed in the UI. Skip calls for data that isn't visible

### Notepad File Watcher

**Changes:**
- Increase debounce from 100ms to 500ms
- Only broadcast if file content actually changed (compare hash or length before emitting)

### Main Process Bundle

The esbuild output for `main.js` is 637KB and not minified.

**Changes:**
- Add `--minify` to the esbuild command for `main.js` and `preload.js`
- Verify `--tree-shaking=true` is active

### Backend Process stdio

Production backend is spawned with `stdio: 'inherit'`, flowing all backend log output through the Electron main process.

**Changes:**
- Switch to `stdio: 'pipe'` and only forward error-level logs, or write to a rotating log file
- High-volume logging during orchestration/waterfall runs creates unnecessary IPC overhead between child and main process

---

## 6. Backend Resource Optimization

### Vector Service & Embedding Cache

**Changes:**
- Add LRU eviction to the embedding cache `Map` (max 500 entries)
- Debounce HNSW index disk saves: instead of saving every 50 operations, save at most once per 30 seconds. Burst operations (e.g., 200 in a row) produce 1 write instead of 4

### Context Retrieval

Currently fetches 8-25 memories per query and deduplicates via all-pairs cosine similarity.

**Changes:**
- Cap retrieval at 15 results
- Apply dedup threshold during retrieval rather than as a post-filter (fetch less, not fetch-then-discard)

### Socket.io Broadcasting

**Changes:**
- Batch outgoing events: accumulate updates over a 100ms window (250ms on Lite tier) and send one combined payload instead of many small messages
- Reduces both network overhead and renderer re-render triggers

### BullMQ Workers

5 workers run continuously regardless of queue activity.

**Changes:**
- Lazy worker activation: only spin up workers (`image_gen`, `orchestration`, etc.) when a job is enqueued in their queue
- Idle workers after a configurable timeout (e.g., 60 seconds of no work)

---

## 7. Device Capability Detection & Adaptive Behavior

### Detection

At app startup, run a one-time capability assessment using data Electron already collects:

- RAM total (`systeminformation.mem()`)
- CPU core count and speed (`os.cpus()` — lightweight)
- GPU info (`systeminformation.graphics()`) — discrete vs integrated

### Tier Classification

- **Lite**: Under 8GB RAM AND 4 or fewer cores AND integrated GPU only
- **Full**: Everything else (any device that doesn't match all three Lite criteria)

The Lite tier is opt-in by detection — a device must meet all three constraints to be classified as Lite. Any device with 8GB+ RAM, or more than 4 cores, or a discrete GPU gets the Full experience by default.

The tier is determined once at startup. No ongoing profiling.

### User Override — Performance Mode Setting

A toggle in Settings with three options:

- **Auto (recommended)** — uses the detected tier
- **Full** — overrides to Full regardless of hardware
- **Lite** — overrides to Lite regardless of hardware

Persisted in the Zustand settings slice. Changing the toggle applies immediately without requiring an app restart (components read the current tier reactively from the store).

### Adaptive Behaviors by Tier

| Area | Full | Lite |
|------|------|------|
| Framer Motion | Full spring physics, layout animations | CSS transitions for most animations; springs only for hero moments (panel opens, mode switches) |
| Telemetry interval | 10 seconds | 30 seconds |
| Knowledge Map | Full force simulation, unlimited nodes visible | Cap visible nodes at 100, simplified force sim (fewer iterations per tick) |
| Monaco Editor | Full features | Disable minimap, increase suggestion delay, disable bracket pair colorization |
| Socket.io event batching | 100ms window | 250ms window |
| BullMQ workers | All active | Lazy activation only |
| Message list virtualization buffer | 20 messages above/below viewport | 10 messages above/below viewport |

### Constraints

- No functionality is removed in Lite mode. Every feature remains accessible
- The tier is a default, not a lock — the user override in settings has final authority
- The visual experience on Full tier is identical to the current app behavior

---

## 8. Build & Font Optimization

### Google Fonts

Currently loaded via `@import url()` in `index.css` — this is render-blocking.

**Changes:**
- Self-host the font files (Geist, Inter Tight, JetBrains Mono) and load them with `font-display: swap`
- Subset fonts to only the weights actually used in the app
- Use `preload` links for the primary font weight to eliminate the flash of unstyled text

### Vite Build

**Changes:**
- Analyze the production bundle with `rollup-plugin-visualizer` to identify any remaining oversized chunks
- Configure manual chunk splitting for heavy dependencies (D3 modules, Framer Motion, React Markdown) so they're loaded only when needed
- Verify tree-shaking is working correctly across all entry points

---

## Non-Goals

- No features are removed or hidden in any tier
- No changes to the AI/LLM provider logic, prompt construction, or model selection
- No changes to the data model, API contracts, or persistence formats
- No changes to the authentication or security layer
