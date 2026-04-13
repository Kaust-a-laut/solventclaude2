# Agent Preview Capabilities V2 — Implementation Summary

Generated: 2026-04-12
Branch: `feat/intelligent-search-pipeline` (merged from `feat/agent-preview-v2`)
Commits: 11 | Files changed: 24 | Lines: ~1,100 insertions

---

## What Was Implemented

### Phase 1: Model Curation (Foundation)

**`useModelCapabilities` hook** (`frontend/src/hooks/useModelCapabilities.ts`)
- Reads selected model from Zustand store, returns `tier`, `traits`, and 3 capability flags: `canUseRuntimeTools`, `canUseScreenshots`, `canUseClickToEdit`
- Classifies 11 models as `full-agentic` (Kimi K2.5, Qwen3 Coder+, Claude Sonnet 4, GPT-4o, GLM-4.7, GLM-5, Qwen 3.6 Plus, Groq Compound, Kimi K2, DeepSeek V3, Qwen3 Coder Flash)
- Classifies 8 models as `code-only` (GPT-OSS 120B, Llama 4 Maverick, MiniMax M2, Qwen3 32B, Compound Mini, Qwen3 235B, Qwen3 Coder Next, Llama 3.3 70B)
- Identifies 2 multimodal models (Claude Sonnet 4, GPT-4o) that can receive screenshots
- **Dropped** Llama 3.1 8B entirely

**Tier transport (Option B)** — Frontend sends `tier` + `traits` in the `/agent/chat` POST body. Backend Zod schema accepts them. This is how the backend knows which tools to register.

### Phase 2: Runtime Injection (The Bridge)

**Bridge script** (`frontend/src/lib/preview-bridge-script.ts`) — ~130 lines of vanilla JS exported as a string constant. When injected into the WebContainer preview iframe, it:
- Monkey-patches `console.log/warn/error` → posts `solvent:console` events to parent
- Listens for `window.onerror` + `unhandledrejection` → posts `solvent:error` events
- Runs a `MutationObserver` on `document.body` → posts debounced `solvent:dom-changed` events with body hash + truncated HTML (50KB cap)
- Captures clicks in capture phase → posts `solvent:click` events with tag, classes, text, data attributes, bounding rect
- Lazily loads `html2canvas` from CDN on first screenshot request → captures PNG and posts `solvent:screenshot-ready` back

**Injection into WebContainer** — During `syncProjectToWebContainer` in `CodingArea.tsx`, after mounting the file tree, the bridge script is injected into `index.html` before `</head>` (falling back to `</body>`). Original files on disk are untouched — only the ephemeral WebContainer FS is modified.

**Parent message listener** — `CodingArea.tsx` registers a `window.addEventListener('message')` handler that filters on `solvent:` prefix and dispatches to Zustand actions: `appendConsoleEntry`, `updatePreviewDom`, `setSelectedElement`.

**Zustand preview state** (added to `codingSlice.ts`):
- `previewConsoleBuffer` — ring buffer, max 200 entries
- `previewBodyHash` / `previewBodyHTML` / `previewDomChanged` — DOM snapshot state
- `previewSelectedElement` — element the user clicked in the preview
- `previewScreenshotUrl` — URL of the last captured screenshot

### Phase 3: Backend Endpoints

**PreviewStashStore** (`backend/src/services/previewStashStore.ts`) — In-memory `Map<sessionId, PreviewStash>` with 10-minute TTL, automatic pruning every 60s. Stores full console buffer and DOM snapshot for pull tools to read.

**4 new tool definitions** added to `TOOL_DEFINITIONS`:
- `get_console_logs(filter?, limit?)` — reads from session stash
- `get_dom_snapshot()` — returns stored hash and body HTML
- `get_selected_element()` — returns clicked element info, clears selection on read
- `capture_screenshot()` — only available for multimodal models

**Preview routes** (`backend/src/routes/previewRoutes.ts`):
- `POST /api/v1/preview/events` — fire-and-forget, stores console buffer + DOM snapshot. Validates payload, rejects >500KB.
- `POST /api/v1/preview/tool-result` — resolves pending promises keyed by `callId`. 8-second timeout on pending calls → resolves with `{ error: 'Screenshot capture timed out' }`.

**Tool gating by tier** (`baseOpenAIService.ts`):
- `filterToolsByTier()` filters the tool list before each API call:
  - Code-only models: exclude all 4 preview tools
  - Full-agentic non-multimodal: exclude `capture_screenshot`
  - Full-agentic multimodal: all tools available

**Browser-tool SSE round-trip** (`baseOpenAIService.ts` + `toolService.ts`):
- Agent calls `capture_screenshot` → `toolService.executeTool` throws `BROWSER_TOOL:capture_screenshot`
- `baseOpenAIService` catches this, emits `{ type: 'browser-tool', tool: 'capture_screenshot', callId: '<uuid>' }` on SSE stream
- Creates a pending promise via `createPendingCall()` (8s timeout)
- Frontend receives SSE event, triggers iframe screenshot, uploads PNG, posts result to `/api/preview/tool-result`
- Backend resolves promise, injects URL as tool result, agent loop continues

### Phase 4: UI Patterns

**Push summary block** (`PreviewRuntimeSummary.tsx`) — Builds `<preview-runtime>` XML block appended to user messages before sending:
```
<preview-runtime>
console: 3 errors, 1 warning | last-error: "TypeError: ..." (4s ago)
dom-hash: a3f9c2 | changed: true since last turn
preview: running
</preview-runtime>
```
Zero tokens when no preview is running.

**Preview data flush** — On each message send, fire-and-forget `POST /api/preview/events` with full console buffer and DOM snapshot. Resets `previewDomChanged` after sending.

**Screenshot button** (`PreviewPanel.tsx`) — Replaced the old `onSnap` (which captured HTML as text) with real PNG screenshot capture via the iframe postMessage flow. Uploads to `/files/upload`, stores URL in Zustand.

**Click-to-edit pill** (`ClickToEditPill.tsx`) — Dismissible pill above the composer showing `<tag.class> "text"`. Auto-dismisses when `previewSelectedElement` is cleared on read.

**System prompt updates** (`slashCommands.ts`) — `buildSystemPrompt` now accepts `previewSelectedElement` and appends a hint when an element is selected, prompting the agent to call `get_selected_element()`.

### Phase 5: Delegation A+

**Delegate candidate parser + card** (`DelegateCandidateCard.tsx`) — Detects `<delegate-candidate>` XML blocks in agent responses and renders an interactive card with 4 states:
- **Pending:** Task description, files, "Send to code model" + "Dismiss" buttons
- **Running:** Amber spinner + "Delegating" label
- **Complete:** Green checkmark + "Open result" + "Dismiss"
- **Failed:** Red error icon + "Retry" button

Malformed XML is swallowed without throwing. Missing fields default gracefully.

**Delegation system prompt** — Full-agentic models receive instructions on when and how to use `<delegate-candidate>` format for self-contained, file-scoped tasks.

**`preferredCodeModel` setting** — Zustand-persisted preference for which code-tier model to delegate to. Default `null` (first code-only model).

---

## What's Left To Do (Not Started)

### Critical Gaps

1. **`get_selected_element()` tool execution** — The tool is defined in `TOOL_DEFINITIONS` and the system prompt hints the agent to call it, but there's no backend handler for it. The frontend stores `previewSelectedElement` in Zustand, but the backend's `toolService.executeTool` doesn't know how to read it. This needs either:
   - A frontend-side tool handler (like `ide_show_diff`), or
   - A backend endpoint that reads from a shared state (the frontend would need to POST selected element state), or
   - The tool returns data from the push summary context

2. **`get_console_logs()` and `get_dom_snapshot()` tool execution** — Similarly defined but not implemented in `toolService.ts`. They need to read from `PreviewStashStore` by session ID. The session ID needs to be available during tool execution (it comes from the request body but isn't threaded through to the tool handler).

3. **Delegation handoff backend** — The card renders and has "Send to code model" / "Dismiss" buttons with placeholder handlers. The actual model-swap handoff (create new chat session, switch to `preferredCodeModel`, inject task + context, send) is not wired up.

4. **`<delegate-candidate>` detection in streaming responses** — Currently only parses from `text_complete` content. If the agent streams the delegate block progressively, it won't be detected until the stream finishes.

### Nice-To-Have

5. **Backend tier validation (Option C hardening)** — Currently trusts frontend's `tier` claim. Backend maintaining its own `MODEL_TIERS` map as defense-in-depth was noted in the spec as future work.

6. **Bridge script duplicate injection guard** — If `syncProjectToWebContainer` runs multiple times (e.g., on file change re-sync), the bridge script could be injected multiple times. A guard comment or unique marker would prevent this.

7. **Screenshot button visibility gating** — The button should only appear when `canUseScreenshots === true`. Currently the PreviewPanel always shows it — the gating needs to be wired through from `useModelCapabilities()`.

8. **E2E / integration tests** — The browser-tool round-trip (SSE event → iframe capture → upload → tool-result → promise resolution) has no integration test. The spec calls for mocked iframe testing.

9. **Manual verification checklist** — None of the 9 manual verification items from the spec have been validated in a running app yet.

---

## Status Matrix

| Capability | Status |
|---|---|
| Model tier detection | ✅ Complete |
| Tier transport (frontend → backend) | ✅ Complete |
| Bridge script injection | ✅ Complete |
| Console/DOM event capture | ✅ Complete |
| Zustand preview state | ✅ Complete |
| Preview data flush to backend | ✅ Complete |
| PreviewStashStore (TTL store) | ✅ Complete |
| Tool gating by tier | ✅ Complete |
| Push summary in messages | ✅ Complete |
| Screenshot capture flow | ✅ Complete (but button not gated) |
| Click-to-edit pill | ✅ Complete |
| System prompt updates | ✅ Complete |
| Delegate card rendering | ✅ Complete |
| `get_selected_element` tool | ⚠️ Defined, not executed |
| `get_console_logs` tool | ⚠️ Defined, not executed |
| `get_dom_snapshot` tool | ⚠️ Defined, not executed |
| Delegation handoff | ⚠️ Card renders, buttons are placeholders |
| Backend tier validation | 🔴 Not started (Option C) |
| E2E tests | 🔴 Not started |

## Test Results

- **Frontend:** 53/53 passing, TypeScript clean
- **Backend:** 188/191 passing (3 pre-existing waterfall failures unrelated to changes), TypeScript clean
