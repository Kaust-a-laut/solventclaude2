# Agent Preview Capabilities V2 — Implementation Design

## Overview

Extend the coding agent's awareness beyond static HTML snapshots to include live runtime data, visual screenshots, and click-driven element context — while curating the model list so every capability lands on a model that can actually use it.

**Capabilities in scope:**
- **C — Console/DOM Runtime Awareness:** Agent sees live console errors and DOM state via hybrid push/pull
- **D — Visual Screenshots:** Multimodal-only models can request a rendered screenshot on demand
- **A — Click-to-Edit:** User clicks a preview element; agent resolves it to a source file/line
- **A+ — Delegation:** Capable model emits structured delegation blocks; UI renders an inline artifact card

**Deferred (B — Hover-Inspect):** Revisit after A is proven.

---

## Build Order

1. **Phase 1 — Model Curation** (foundation: tier schema, gating hook, model list)
2. **Phase 2 — Runtime Injection** (postMessage bridge, Zustand state, console buffer)
3. **Phase 3 — Backend Endpoints** (preview/events, preview/tool-result, SSE browser-tool, pull tools, TTL stash)
4. **Phase 4 — UI Patterns** (push summary, screenshot button, click-to-edit pill, delegate card, system prompt updates)
5. **Phase 5 — Delegation A+** (separate PR: `<delegate-candidate>` blocks, inline artifact card, model-swap handoff)

---

## Phase 1: Model Curation

### Trait Schema

```typescript
type ModelTier = 'full-agentic' | 'code-only';

interface AgentModelTraits {
  toolUse: 'strong' | 'basic';
  multimodal: boolean;
  contextWindow: number;
}

interface AgentModel {
  id: string;
  label: string;
  provider: string;
  tier: ModelTier;
  traits: AgentModelTraits;
}
```

### Model Assignments

**Full Agentic — Multimodal (C + D + A):**
| Model | Provider | Context |
|-------|----------|---------|
| Claude Sonnet 4 | openrouter | 200K |
| GPT-4o | openrouter | 128K |

**Full Agentic — Non-Multimodal (C + A):**
| Model | Provider | Context |
|-------|----------|---------|
| Kimi K2.5 | fireworks | 262K |
| Qwen3 Coder+ | dashscope | 131K |
| DeepSeek V3 | deepseek | 128K |
| Groq Compound | groq | 128K |
| Kimi K2 | groq | 128K |

**Code-Only (no C/D/A):**
| Model | Provider | Context |
|-------|----------|---------|
| Llama 4 Maverick | fireworks | 131K |
| MiniMax M2 | fireworks | 196K |
| Qwen3 32B | dashscope | 131K |
| Qwen3 235B | dashscope | 131K |
| Qwen3 Coder Flash | dashscope | 131K |
| GLM-4.7 | fireworks | 202K |
| GLM-5 | fireworks | 202K |

**Dropped entirely:** Llama 3.1 8B (too weak for useful boilerplate at this level)

### Feature Gating Hook

```typescript
// frontend/src/hooks/useModelCapabilities.ts
function useModelCapabilities() {
  const activeModel = useAppStore(s => s.activeAgentModel);
  return {
    canUseRuntimeTools: activeModel?.tier === 'full-agentic',
    canUseScreenshots: activeModel?.traits.multimodal === true,
    canUseClickToEdit: activeModel?.tier === 'full-agentic',
    tier: activeModel?.tier ?? 'code-only',
  };
}
```

### Tier Transport

**Decision:** Frontend sends `tier` and `traits` in the existing `/agent/chat` POST body alongside `provider` and `model`. Backend reads these to conditionally register pull tools (`get_console_logs`, `get_dom_snapshot`, `capture_screenshot`).

```typescript
// Existing payload extension
{
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
  messages: Message[];
  // NEW:
  tier: 'full-agentic' | 'code-only';
  traits: { toolUse: 'strong' | 'basic'; multimodal: boolean; contextWindow: number };
}
```

**Future hardening:** Backend maintains its own `MODEL_TIERS` map as a defense-in-depth fallback. If frontend omits tier (or sends an unknown value), backend derives it from model ID. This protects against malicious clients in multi-tenant scenarios. Not needed for current local-dev threat model, but cheap to add.

### Files

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/hooks/useModelCapabilities.ts` | New | Gating hook + trait schema |
| `frontend/src/components/ModelSelector.tsx` | Modify | Replace flat `AGENT_MODEL_OPTIONS` with tier-annotated list |
| `frontend/src/store/codingSlice.ts` | Modify | Add `activeAgentModel` field (or derive from `selectedCloudModel`/`selectedCloudProvider`) |
| `backend/src/routes/aiRoutes.ts` | Modify | Read `tier`/`traits` from request body, pass to tool registration |

---

## Phase 2: Runtime Injection

### Injection Strategy

**Decision:** Patch the user's `index.html` in the WebContainer's in-memory filesystem during `syncProjectToWebContainer`. Insert an inline `<script>` before `</head>`. Original files on disk are untouched — only the ephemeral WebContainer FS is modified.

### Injected Script

~150 lines of vanilla JS that runs inside the preview iframe:

```javascript
// === Console monkey-patch ===
const _origLog = console.log, _origWarn = console.warn, _origError = console.error;
['log', 'warn', 'error'].forEach(level => {
  const orig = console[level];
  console[level] = (...args) => {
    orig.apply(console, args);
    window.parent.postMessage({
      type: 'solvent:console',
      level,
      message: args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').slice(0, 2000),
      timestamp: Date.now()
    }, '*');
  };
});

// === Unhandled errors ===
window.onerror = (msg, url, line, col, err) => {
  window.parent.postMessage({
    type: 'solvent:error',
    message: String(msg),
    stack: err?.stack,
    timestamp: Date.now()
  }, '*');
};
window.addEventListener('unhandledrejection', e => {
  window.parent.postMessage({
    type: 'solvent:error',
    message: `Unhandled Promise Rejection: ${e.reason}`,
    timestamp: Date.now()
  }, '*');
});

// === DOM change observer ===
let domHashTimer;
function emitDomHash() {
  clearTimeout(domHashTimer);
  domHashTimer = setTimeout(() => {
    const body = document.body;
    const hash = simpleHash(body.innerHTML.slice(0, 50000));
    const bodyHTML = body.innerHTML.slice(0, 50000);
    window.parent.postMessage({
      type: 'solvent:dom-changed',
      hash,
      bodyHTML,
      timestamp: Date.now()
    }, '*');
  }, 250);
}
const observer = new MutationObserver(emitDomHash);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
emitDomHash(); // initial hash

// === Click capture (capture phase) ===
document.addEventListener('click', e => {
  const el = e.target;
  if (!el || el === document) return;
  const rect = el.getBoundingClientRect();
  const dataAttrs = {};
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-')) dataAttrs[attr.name] = attr.value;
  }
  window.parent.postMessage({
    type: 'solvent:click',
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    classes: [...el.classList],
    text: (el.textContent || '').trim().slice(0, 200),
    dataAttrs,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
  }, '*');
}, true);

// === html2canvas loader (lazy) ===
let html2canvasPromise = null;
function loadHtml2Canvas() {
  if (html2canvasPromise) return html2canvasPromise;
  html2canvasPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return html2canvasPromise;
}

// === Screenshot capture listener ===
window.addEventListener('message', e => {
  if (e.data?.type === 'solvent:capture-screenshot') {
    loadHtml2Canvas().then(() => {
      return window.html2canvas(document.body, { useCORS: true, logging: false });
    }).then(canvas => {
      const dataUrl = canvas.toDataURL('image/png');
      window.parent.postMessage({ type: 'solvent:screenshot-ready', dataUrl }, '*');
    }).catch(err => {
      window.parent.postMessage({ type: 'solvent:screenshot-error', error: err.message }, '*');
    });
  }
});

// === Utility ===
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36).slice(0, 8);
}
```

### Injection Point

In `CodingArea.tsx`, within `syncProjectToWebContainer`:

```typescript
// After mounting the file tree but before running the dev server:
const indexPath = findIndexHtml(tree); // e.g. 'index.html'
if (indexPath) {
  const existingContent = await wc.fs.readFile(indexPath, 'utf-8');
  // Try </head> first, fall back to </body>, then prepend to content
  const injected = existingContent.includes('</head>')
    ? existingContent.replace('</head>', `<script>${BRIDGE_SCRIPT}</script></head>`)
    : existingContent.includes('</body>')
      ? existingContent.replace('</body>', `<script>${BRIDGE_SCRIPT}</script></body>`)
      : `<script>${BRIDGE_SCRIPT}</script>${existingContent}`;
  if (injected !== existingContent) {
    await wc.fs.writeFile(indexPath, injected);
  }
}
```

### New Zustand State (coding slice additions)

```typescript
previewConsoleBuffer: ConsoleEntry[];      // ring buffer, max 200
previewBodyHash: string | null;
previewBodyHTML: string | null;           // truncated, last ~50KB
previewDomChanged: boolean;               // reset to false after each agent turn
previewSelectedElement: ElementInfo | null;
previewScreenshotUrl: string | null;      // set after screenshot upload
```

### Parent Listener

In `CodingArea.tsx`, register alongside the existing `server-ready` listener:

```typescript
useEffect(() => {
  const handler = (e: MessageEvent) => {
    const data = e.data;
    if (!data || typeof data !== 'object' || !String(data.type).startsWith('solvent:')) return;
    
    switch (data.type) {
      case 'solvent:console':
      case 'solvent:error':
        dispatch({ type: 'preview/appendConsole', payload: data });
        break;
      case 'solvent:dom-changed':
        dispatch({ type: 'preview/updateDom', payload: data });
        break;
      case 'solvent:click':
        dispatch({ type: 'preview/setSelectedElement', payload: data });
        break;
      case 'solvent:screenshot-ready':
        handleScreenshotReady(data.dataUrl);
        break;
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

### Files

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/lib/preview-bridge-script.ts` | New | Bridge script source (as a string constant) |
| `frontend/src/components/CodingArea.tsx` | Modify | Inject bridge script during `syncProjectToWebContainer`; register message listener |
| `frontend/src/store/codingSlice.ts` | Modify | Add preview state fields and reducer actions |

---

## Phase 3: Backend Endpoints

### POST /api/preview/events

Fire-and-forget. Stores full console buffer and DOM snapshot keyed by session ID.

```typescript
POST /api/preview/events
Content-Type: application/json
{
  sessionId: string;
  entries: ConsoleEntry[];       // full ring buffer, up to 200
  bodyHTML: string | null;
  bodyHash: string | null;
}
Response: 200 OK (always, unless payload > 500KB → 413)
```

### POST /api/preview/tool-result

Resolves a pending promise keyed by `callId`.

```typescript
POST /api/preview/tool-result
Content-Type: application/json
{
  callId: string;
  result: unknown;  // screenshot URL, or any tool result
}
Response: 200 OK
```

If no pending `callId` exists (expired or unknown), returns 200 with `{ status: 'ignored', reason: 'unknown callId' }`.

### PreviewStashStore (in-memory)

```typescript
class PreviewStashStore {
  private store = new Map<string, { data: PreviewStash; expiry: number }>();
  
  set(sessionId: string, data: PreviewStash, ttlMs = 600_000) { /* 10 min */ }
  get(sessionId: string): PreviewStash | null { /* null if expired or missing */ }
  delete(sessionId: string): void;
  
  private prune() { /* called every 60s, removes expired entries */ }
}
```

### Pull Tools

Registered only when `tier === 'full-agentic'`:

- **`get_console_logs(filter?: 'error'|'warn'|'log', limit?: number)`** — reads from session stash, returns matching entries
- **`get_dom_snapshot()`** — returns stored hash and body HTML; graceful message if no snapshot
- **`get_selected_element()`** — no parameters. Returns current `previewSelectedElement` and clears it to null. Returns `{ error: 'No element selected' }` if called when nothing is selected.
- **`capture_screenshot()`** — only registered when `traits.multimodal === true`; emits SSE `browser-tool` event

### SSE Browser-Tool Event

When the agent calls `capture_screenshot`:

1. Backend emits on SSE stream: `{ type: 'browser-tool', tool: 'capture_screenshot', callId: '<uuid>' }`
2. Frontend receives event, posts `{ type: 'solvent:capture-screenshot' }` to iframe
3. Iframe captures, posts `solvent:screenshot-ready` back to parent
4. Parent uploads PNG via `POST /api/files/upload`, gets URL
5. Parent posts `{ callId, url }` to `POST /api/preview/tool-result`
6. Backend resolves pending promise keyed by `callId`, injects URL as tool result, continues agent loop

**Timeout:** 8 seconds. If `POST /api/preview/tool-result` isn't called in time, backend resolves with `{ error: 'Screenshot capture timed out' }`. Agent continues gracefully.

### Files

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/previewStashStore.ts` | New | In-memory TTL store |
| `backend/src/routes/previewRoutes.ts` | New | `/api/preview/events`, `/api/preview/tool-result` |
| `backend/src/controllers/aiController.ts` | Modify | Register pull tools conditionally based on tier |
| `backend/src/server.ts` | Modify | Mount preview routes, start stash pruner |

---

## Phase 4: UI Patterns

### 4.1 Push Summary Block

Built in `AgentChatPanel.handleSend` before sending. Appended to the user message content:

```
<preview-runtime>
console: 3 errors, 1 warning | last-error: "TypeError: Cannot read properties of undefined (reading 'map')" (4s ago)
dom-hash: a3f9c2 | changed: true since last turn
preview: running
</preview-runtime>
```

If no preview is running, the block is omitted entirely (zero tokens). After each send, `previewDomChanged` is reset to `false` in Zustand.

### 4.2 Screenshot Button (refactored Camera button)

The existing `onSnap` in `PreviewPanel.tsx` currently captures iframe HTML as text. Refactor it to trigger the screenshot flow instead:

- Button remains in the same position (next to reload button)
- Icon changes from `Camera` to `Camera` (same icon, different behavior)
- Tooltip changes from "Share preview with agent" to "Capture screenshot"
- When clicked (and `canUseScreenshots === true`):
  1. Parent sends `capture_screenshot` tool call to backend
  2. Browser-tool round-trip executes
  3. Returned URL stored in `previewScreenshotUrl`
  4. Agent sees it in context on next turn

If `canUseScreenshots === false`, the button is hidden entirely (not disabled — absent).

### 4.3 Click-to-Edit Pill

Dismissable pill above the composer in `AgentChatPanel`:

```
Clicked: <button.btn-primary> "Submit"  [×]
```

Stored as `previewSelectedElement` in Zustand. Clicking the pill pre-fills the composer with:

> `I clicked the Submit button (btn-primary). Can you find and open that component?`

The system prompt includes a hint when `previewSelectedElement` is non-null:

> `The user has a selected preview element. Call get_selected_element() to see what they clicked.`

`get_selected_element()` is a tool that returns the stored element info and then clears `previewSelectedElement` to null in Zustand. Clearing on read means the hint disappears from `buildSystemPrompt` and the pill dismisses from the composer automatically on the next turn.

### 4.4 System Prompt Updates

`buildSystemPrompt` in `slashCommands.ts` gains two additions:

1. **Preview runtime paragraph** — describes the `<preview-runtime>` block format so the agent understands it and knows when to call pull tools for detail.

2. **Element selection hint** — when `previewSelectedElement` is non-null, appends:
   > `The user has a selected preview element. Call get_selected_element() to see what they clicked.`

### 4.5 Styling

All new UI components use existing Tailwind classes and design tokens:

- Card backgrounds: `bg-white/[0.03]` / `bg-black/30`
- Borders: `border-white/[0.05]`
- Typography: `text-[11px]` / `text-[12px]` (existing font scale)
- Corner radius: `rounded-xl` / `rounded-10`
- Accent colors: `text-jb-accent`, `text-emerald-400`, `text-amber-400`, `text-red-400`
- Animations: `animate-bounce`, `animate-spin` (existing utilities)

No custom inline styles.

### Files

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/components/coding/PreviewRuntimeSummary.tsx` | New | Builds `<preview-runtime>` block from Zustand state |
| `frontend/src/components/coding/ClickToEditPill.tsx` | New | Dismissable pill component |
| `frontend/src/components/coding/PreviewPanel.tsx` | Modify | Replace `onSnap` with screenshot flow; hide when `!canUseScreenshots` |
| `frontend/src/components/coding/AgentChatPanel.tsx` | Modify | Integrate push summary, pill, `get_selected_element` tool |
| `frontend/src/components/coding/slashCommands.ts` | Modify | Update `buildSystemPrompt` with runtime paragraph and element hint |

---

## Phase 5: Delegation A+

### Block Format

Models return `<delegate-candidate>` XML blocks in their response:

```xml
<delegate-candidate>
  <task>Add a loading spinner to SubmitButton while the form is submitting</task>
  <files>src/components/SubmitButton.tsx</files>
  <context>
    The button currently renders: <button className="btn-primary">{children}</button>
    Add a Loader2 icon from lucide-react when isLoading prop is true.
    Keep existing classes. isLoading should default to false.
  </context>
</delegate-candidate>
```

### Parser

```typescript
interface DelegateCandidate {
  task: string;
  files: string[];
  context: string;
}

function parseDelegateCandidate(text: string): DelegateCandidate | null {
  const match = text.match(/<delegate-candidate>([\s\S]*?)<\/delegate-candidate>/);
  if (!match) return null;
  const inner = match[1];
  return {
    task: extractTag(inner, 'task') ?? '',
    files: (extractTag(inner, 'files') ?? '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
    context: extractTag(inner, 'context') ?? '',
  };
}
```

Malformed XML is swallowed without throwing. Missing fields default gracefully.

### Inline Artifact Card

Renders inside the chat message stream:

**In Progress state:**
- Amber spinner + model name + task description + files
- User can continue sending messages to the main model

**Complete state:**
- Green checkmark + "N files changed"
- "Open result" button → navigates to changed files via existing diff/banner flow
- "Dismiss" button → collapses card

**Failed state:**
- Red error icon + error message
- "Retry" button

### Model-Swap Handoff

"Send to code model" (on the delegate card before it runs, or triggered by the capable model's block):

1. Switches active model to `preferredCodeModel` (Zustand + localStorage persist)
2. Creates a new backend chat session for the delegation
3. Injects task + context as the next user message
4. Sends immediately
5. Returns an artifact card to the main chat thread tracking progress

The capable model's full conversation history carries over — the cheap model sees everything. No context loss.

### `preferredCodeModel` Setting

Zustand-persisted preference (localStorage via existing persist middleware). Defaulted to the first Code-Only tier entry. Settable from the model selector via a "Set as delegation target" option in the Code-Only tier dropdown.

### Files

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/components/coding/DelegateCandidateCard.tsx` | New | Inline artifact card with three states |
| `frontend/src/components/coding/slashCommands.ts` | Modify | Add delegation instructions to `buildSystemPrompt` for Full Agentic models |
| `frontend/src/components/coding/AgentChatPanel.tsx` | Modify | Detect and render `<delegate-candidate>` blocks |
| `frontend/src/store/codingSlice.ts` | Modify | Add `preferredCodeModel` persisted field, delegation state |
| `backend/src/routes/aiRoutes.ts` | Modify | Support new chat session creation for delegation handoff |

---

## Testing Strategy

### Unit Tests (Vitest)

- `useModelCapabilities()` — assert correct flags for: Full Agentic multimodal, Full Agentic non-multimodal, Code-Only. Edge: undefined model → all false.
- `previewConsoleBuffer` ring buffer actions — max 200 entries, correct eviction, filter behavior.
- `<delegate-candidate>` parser — correct extraction of task/files/context; malformed XML swallowed without throwing; missing fields default gracefully.
- Push summary builder — empty string when no preview running; correct format with errors; `domChanged` true vs false; reset after send.
- Bridge script injection — verify `index.html` is patched during sync, original content preserved around `</head>`.

### Integration Tests (Vitest + supertest)

- `POST /api/preview/events` — stores keyed by session, returns 200, rejects oversized payloads (>500KB), TTL eviction works.
- `get_console_logs` tool — filter and limit params correct; empty array if no stash for session.
- `get_dom_snapshot` tool — returns stored hash and HTML; graceful message if no snapshot.
- `POST /api/preview/tool-result` — resolves pending callId promise; ignores unknown callIds; timeout after 8s returns error result to agent loop.
- `PreviewStashStore` — set/get/delete/prune, TTL expiry, concurrent access safety.

### Browser-Tool Round-Trip (integration, mocked iframe)

- Assert `capture_screenshot` tool call emits `browser-tool` event on SSE stream.
- Mock `POST /api/preview/tool-result` response; assert agent loop continues with screenshot URL as tool result.
- Timeout case: no result within 8s → agent receives error result, loop continues without hanging.

### Manual Verification Checklist

- Console errors from preview appear in `<preview-runtime>` block on next agent turn
- Full console buffer available via `get_console_logs` tool call
- `capture_screenshot` returns a usable image URL when multimodal model is active
- Non-multimodal model has no `capture_screenshot` in its tool list
- Clicking a preview element shows the pill above the composer
- Delegate card renders in chat and swaps model + sends on click
- Code-Only model shows no C/D/A capability controls in the UI
- Bridge script injected only once (not duplicated on re-sync)
- Original `index.html` on disk is not modified by injection

---

## Existing Patterns to Follow

- **State management:** Zustand slices in `codingSlice.ts` with persist middleware for localStorage
- **Component styling:** Tailwind CSS with existing tokens (`text-jb-accent`, `bg-white/[0.03]`, etc.)
- **Backend routes:** Express routers in `backend/src/routes/`, controllers in `backend/src/controllers/`
- **Tool registration:** Conditional tool lists based on model traits, following existing `TOOL_DEFINITIONS` pattern
- **SSE streaming:** Existing `/agent/chat` SSE loop — browser-tool events extend it
- **File injection:** `syncProjectToWebContainer` already modifies WebContainer FS — bridge script injection follows the same pattern
