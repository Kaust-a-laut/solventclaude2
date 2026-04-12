# Agent Preview Capabilities V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add console/DOM runtime awareness, visual screenshots, click-to-edit, and delegation to the coding agent's preview capabilities.

**Architecture:** 5-phase sequential build. Each phase produces testable, committable software. Frontend sends `tier`+`traits` in chat payload (Option B). Bridge script injected via index.html patch in WebContainer FS.

**Tech Stack:** React + TypeScript (frontend), Express + TypeScript (backend), Zustand (state), WebContainer (sandbox), SSE (streaming), Tailwind CSS (styling).

**Spec:** `docs/superpowers/specs/2026-04-12-agent-preview-capabilities-v2-design.md`

---

## File Structure

### New Files

| File | Phase | Responsibility |
|------|-------|----------------|
| `frontend/src/hooks/useModelCapabilities.ts` | 1 | Feature gating hook + trait schema |
| `frontend/src/lib/preview-bridge-script.ts` | 2 | Bridge script source (string constant) |
| `backend/src/services/previewStashStore.ts` | 3 | In-memory TTL store for console/DOM data |
| `backend/src/routes/previewRoutes.ts` | 3 | `/api/preview/events`, `/api/preview/tool-result` |
| `frontend/src/components/coding/PreviewRuntimeSummary.tsx` | 4 | Builds `<preview-runtime>` block from Zustand state |
| `frontend/src/components/coding/ClickToEditPill.tsx` | 4 | Dismissable pill for click-to-edit |
| `frontend/src/components/coding/DelegateCandidateCard.tsx` | 5 | Inline artifact card for delegation |

### Modified Files

| File | Phase | Change |
|------|-------|--------|
| `frontend/src/store/codingSlice.ts` | 1, 2, 5 | Add `activeAgentModel`, preview state, delegation state |
| `frontend/src/components/ModelSelector.tsx` | 1 | Add tier annotations to `AGENT_MODEL_OPTIONS` |
| `frontend/src/components/coding/AgentChatPanel.tsx` | 4, 5 | Push summary, pill, delegate card rendering |
| `frontend/src/components/coding/slashCommands.ts` | 4, 5 | `buildSystemPrompt` updates |
| `frontend/src/components/CodingArea.tsx` | 2 | Inject bridge script, register message listener |
| `frontend/src/components/coding/PreviewPanel.tsx` | 4 | Replace `onSnap` with screenshot flow |
| `backend/src/routes/aiRoutes.ts` | 1 | Mount preview routes |
| `backend/src/controllers/aiController.ts` | 1, 3 | Read `tier`/`traits`, pass to tool registration |
| `backend/src/server.ts` | 3 | Mount preview routes, start stash pruner |
| `backend/src/constants/tools.ts` | 3 | Add new tool definitions |
| `backend/src/services/baseOpenAIService.ts` | 3 | Support `browser-tool` SSE event emission |

---

## Phase 1: Model Curation

### Task 1.1: Create `useModelCapabilities` hook

**Files:**
- Create: `frontend/src/hooks/useModelCapabilities.ts`
- Test: `frontend/src/hooks/useModelCapabilities.test.ts`

- [ ] **Step 1: Write the hook**

```typescript
// frontend/src/hooks/useModelCapabilities.ts
import { useAppStore } from '../store/useAppStore';
import { AGENT_MODEL_OPTIONS, type ModelOption } from '../components/ModelSelector';

export type ModelTier = 'full-agentic' | 'code-only';

export interface AgentModelTraits {
  toolUse: 'strong' | 'basic';
  multimodal: boolean;
  contextWindow: number;
}

export interface AgentModel extends Omit<ModelOption, 'sublabel' | 'color' | 'bgColor' | 'icon'> {
  tier: ModelTier;
  traits: AgentModelTraits;
}

export function useModelCapabilities() {
  const selectedModel = useAppStore((s) => s.selectedCloudModel);
  const selectedProvider = useAppStore((s) => s.selectedCloudProvider);

  const activeModel = AGENT_MODEL_OPTIONS.find(
    (m) => m.model === selectedModel && m.provider === selectedProvider
  );

  const tier = getModelTier(activeModel);
  const traits = getModelTraits(activeModel);

  return {
    canUseRuntimeTools: tier === 'full-agentic',
    canUseScreenshots: traits.multimodal === true,
    canUseClickToEdit: tier === 'full-agentic',
    tier,
    traits,
    activeModel: activeModel ?? null,
  };
}

function getModelTier(model: ModelOption | undefined): ModelTier {
  if (!model) return 'code-only';
  // Full agentic: Kimi K2.5, Qwen3 Coder+, Claude Sonnet 4, GPT-4o,
  // GLM-4.7, GLM-5, Qwen 3.6 Plus, Groq Compound, Kimi K2, DeepSeek V3, Qwen3 Coder Flash
  const fullAgentic = [
    'accounts/fireworks/models/kimi-k2p5',
    'qwen3-coder-plus',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'accounts/fireworks/models/glm-4p7',
    'accounts/fireworks/models/glm-5',
    'qwen3.6-plus',
    'compound-beta',
    'moonshotai/kimi-k2-instruct-0905',
    'deepseek-chat',
    'qwen3-coder-flash',
  ];
  return fullAgentic.includes(model.model) ? 'full-agentic' : 'code-only';
}

function getModelTraits(model: ModelOption | undefined): AgentModelTraits {
  if (!model) return { toolUse: 'basic', multimodal: false, contextWindow: 8192 };

  const multimodalModels = [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
  ];

  return {
    toolUse: getModelTier(model) === 'full-agentic' ? 'strong' : 'basic',
    multimodal: multimodalModels.includes(model.model),
    contextWindow: getContextWindow(model.model),
  };
}

function getContextWindow(modelId: string): number {
  const limits: Record<string, number> = {
    'anthropic/claude-sonnet-4': 200000,
    'openai/gpt-4o': 128000,
    'accounts/fireworks/models/kimi-k2p5': 262144,
    'qwen3-coder-plus': 131072,
    'accounts/fireworks/models/glm-4p7': 202800,
    'accounts/fireworks/models/glm-5': 202800,
    'qwen3.6-plus': 131072,
    'compound-beta': 128000,
    'moonshotai/kimi-k2-instruct-0905': 128000,
    'deepseek-chat': 128000,
    'qwen3-coder-flash': 131072,
    'accounts/fireworks/models/llama4-maverick-instruct-basic': 131072,
    'accounts/fireworks/models/minimax-m2': 196608,
    'qwen/qwen3-32b': 131072,
    'qwen-3-235b-a22b-instruct-2507': 131072,
    'qwen3-next-80b-a3b-instruct': 131072,
    'llama-3.3-70b-versatile': 128000,
  };
  return limits[modelId] ?? 8192;
}
```

- [ ] **Step 2: Write tests**

```typescript
// frontend/src/hooks/useModelCapabilities.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { useModelCapabilities } from './useModelCapabilities';

describe('useModelCapabilities', () => {
  beforeEach(() => {
    useAppStore.setState({
      selectedCloudModel: 'compound-beta',
      selectedCloudProvider: 'groq',
    });
  });

  it('returns full-agentic for Claude Sonnet 4', () => {
    useAppStore.setState({ selectedCloudModel: 'anthropic/claude-sonnet-4', selectedCloudProvider: 'openrouter' });
    const result = useModelCapabilities();
    expect(result.tier).toBe('full-agentic');
    expect(result.canUseRuntimeTools).toBe(true);
    expect(result.canUseScreenshots).toBe(true);
    expect(result.canUseClickToEdit).toBe(true);
    expect(result.traits.multimodal).toBe(true);
  });

  it('returns full-agentic non-multimodal for Groq Compound', () => {
    const result = useModelCapabilities();
    expect(result.tier).toBe('full-agentic');
    expect(result.canUseRuntimeTools).toBe(true);
    expect(result.canUseScreenshots).toBe(false);
    expect(result.canUseClickToEdit).toBe(true);
  });

  it('returns code-only for Llama 4 Maverick', () => {
    useAppStore.setState({ selectedCloudModel: 'accounts/fireworks/models/llama4-maverick-instruct-basic', selectedCloudProvider: 'fireworks' });
    const result = useModelCapabilities();
    expect(result.tier).toBe('code-only');
    expect(result.canUseRuntimeTools).toBe(false);
    expect(result.canUseScreenshots).toBe(false);
    expect(result.canUseClickToEdit).toBe(false);
  });

  it('returns all false for unknown model', () => {
    useAppStore.setState({ selectedCloudModel: 'unknown-model', selectedCloudProvider: 'unknown' });
    const result = useModelCapabilities();
    expect(result.tier).toBe('code-only');
    expect(result.canUseRuntimeTools).toBe(false);
    expect(result.canUseScreenshots).toBe(false);
    expect(result.canUseClickToEdit).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify**

```bash
cd frontend && npx vitest src/hooks/useModelCapabilities.test.ts --run
```

Expected: All 4 tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley
git add frontend/src/hooks/useModelCapabilities.ts frontend/src/hooks/useModelCapabilities.test.ts
git commit -m "feat: add useModelCapabilities hook for feature gating

Adds tier schema, gating hook, and model trait detection.
Full-agentic vs code-only tiers with multimodal flag."
```

---

### Task 1.2: Add tier annotations to AGENT_MODEL_OPTIONS

**Files:**
- Modify: `frontend/src/components/ModelSelector.tsx`

- [ ] **Step 1: Add tier to each model option**

Add a `tier` field to each entry in `AGENT_MODEL_OPTIONS`. The existing array has ~20 entries. Add `tier: 'full-agentic'` or `tier: 'code-only'` to each:

```typescript
// Add import at top
import type { ModelTier } from '../hooks/useModelCapabilities';

// Extend the interface
export interface ModelOption {
  provider: 'gemini' | 'groq' | 'deepseek' | 'openrouter' | 'ollama' | 'dashscope' | 'cerebras' | 'fireworks';
  model: string;
  displayName: string;
  sublabel: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  tier?: ModelTier;  // NEW
}

// Add tier to each entry in AGENT_MODEL_OPTIONS:
// Full agentic:
{ ..., tier: 'full-agentic' },  // Kimi K2.5
{ ..., tier: 'full-agentic' },  // Qwen3 Coder+
{ ..., tier: 'full-agentic' },  // Claude Sonnet 4
{ ..., tier: 'full-agentic' },  // GPT-4o
{ ..., tier: 'full-agentic' },  // Groq Compound
{ ..., tier: 'full-agentic' },  // Kimi K2
{ ..., tier: 'full-agentic' },  // DeepSeek V3
{ ..., tier: 'full-agentic' },  // Qwen3 Coder Flash
// Code-only:
{ ..., tier: 'code-only' },     // GPT-OSS 120B
{ ..., tier: 'code-only' },     // Llama 4 Maverick
{ ..., tier: 'code-only' },     // MiniMax M2
{ ..., tier: 'code-only' },     // Qwen3 32B
{ ..., tier: 'code-only' },     // Compound Mini
{ ..., tier: 'code-only' },     // Qwen3 235B
{ ..., tier: 'code-only' },     // Qwen3 Coder Next
{ ..., tier: 'code-only' },     // Llama 3.3 70B
// Note: Llama 3.1 8B is DROPPED entirely (remove it from the array)
```

**Also remove** `LLama 3.1 8B` from the array entirely (it was previously at the bottom).

- [ ] **Step 2: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ModelSelector.tsx
git commit -m "feat: annotate model tiers in AGENT_MODEL_OPTIONS

Drops Llama 3.1 8B entirely. Tags full-agentic vs code-only."
```

---

### Task 1.3: Transport tier in chat payload

**Files:**
- Modify: `frontend/src/components/coding/AgentChatPanel.tsx:170-230` (handleSend body construction)
- Modify: `backend/src/controllers/aiController.ts:36` (Zod schema)

- [ ] **Step 1: Update frontend to send tier in payload**

In `AgentChatPanel.tsx`, in the `handleSend` function, find the fetch call to `${API_BASE_URL}/agent/chat`. Extend the body with `tier` and `traits` from the hook:

```typescript
// In handleSend, before the fetch call, get tier info:
const { tier, traits } = useModelCapabilities();

// Extend the fetch body:
body: JSON.stringify({
  provider: selectedCloudProvider || 'groq',
  model: selectedCloudModel,
  apiKeys,
  tier,           // NEW
  traits,         // NEW
  messages,
}),
```

- [ ] **Step 2: Update backend Zod schema**

In `aiController.ts`, extend `chatRequestSchema` to accept the new fields:

```typescript
const chatRequestSchema = z.object({
  // ... existing fields ...
  tier: z.enum(['full-agentic', 'code-only']).optional(),  // NEW
  traits: z.object({
    toolUse: z.enum(['strong', 'basic']),
    multimodal: z.boolean(),
    contextWindow: z.number(),
  }).optional(),  // NEW
  sessionId: z.string().optional()
});
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit && cd ../backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/coding/AgentChatPanel.tsx backend/src/controllers/aiController.ts
git commit -m "feat: transport tier and traits in agent chat payload

Frontend sends tier+traits in POST /agent/chat body.
Backend validates with Zod schema. Option B transport."
```

---

## Phase 2: Runtime Injection

### Task 2.1: Add preview state to Zustand store

**Files:**
- Modify: `frontend/src/store/codingSlice.ts`
- Test: `frontend/src/store/codingSlice.test.ts` (add tests for new state)

- [ ] **Step 1: Add new state fields to the CodingSlice interface**

```typescript
// In frontend/src/store/codingSlice.ts, add to the interface:

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface ElementInfo {
  tag: string;
  id?: string;
  classes: string[];
  text: string;
  dataAttrs: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
}

export interface CodingSlice {
  // ... existing fields ...
  
  // NEW: Preview runtime state
  previewConsoleBuffer: ConsoleEntry[];      // ring buffer, max 200
  previewBodyHash: string | null;
  previewBodyHTML: string | null;           // truncated, last ~50KB
  previewDomChanged: boolean;               // reset to false after each agent turn
  previewSelectedElement: ElementInfo | null;
  previewScreenshotUrl: string | null;

  // NEW actions
  appendConsoleEntry: (entry: ConsoleEntry) => void;
  updatePreviewDom: (data: { hash: string; bodyHTML: string }) => void;
  setSelectedElement: (element: ElementInfo | null) => void;
  setPreviewScreenshotUrl: (url: string | null) => void;
  resetDomChanged: () => void;
}
```

- [ ] **Step 2: Add initial state and actions in createCodingSlice**

```typescript
// In the (set) => ({ ... }) body:
const MAX_CONSOLE_BUFFER = 200;

previewConsoleBuffer: [],
previewBodyHash: null,
previewBodyHTML: null,
previewDomChanged: false,
previewSelectedElement: null,
previewScreenshotUrl: null,

appendConsoleEntry: (entry) => set((state) => {
  const buffer = [...state.previewConsoleBuffer, entry];
  return { previewConsoleBuffer: buffer.slice(-MAX_CONSOLE_BUFFER) };
}),
updatePreviewDom: (data) => set({
  previewBodyHash: data.hash,
  previewBodyHTML: data.bodyHTML.slice(0, 50000),
  previewDomChanged: true,
}),
setSelectedElement: (element) => set({ previewSelectedElement: element }),
setPreviewScreenshotUrl: (url) => set({ previewScreenshotUrl: url }),
resetDomChanged: () => set({ previewDomChanged: false }),
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/codingSlice.ts
git commit -m "feat: add preview runtime state to Zustand store

Console buffer (ring, max 200), DOM hash/HTML, selected element,
screenshot URL. All required for Phase 2 runtime injection."
```

---

### Task 2.2: Create bridge script source

**Files:**
- Create: `frontend/src/lib/preview-bridge-script.ts`

- [ ] **Step 1: Write the bridge script**

```typescript
// frontend/src/lib/preview-bridge-script.ts
/**
 * Bridge script injected into the WebContainer preview iframe.
 * Captures console events, DOM changes, element clicks, and screenshot requests.
 * Posts all events to the parent window via postMessage.
 *
 * This is exported as a string constant for injection into the iframe.
 */
export const BRIDGE_SCRIPT = `
(function() {
  // === Console monkey-patch ===
  var _origLog = console.log, _origWarn = console.warn, _origError = console.error;
  ['log', 'warn', 'error'].forEach(function(level) {
    var orig = console[level];
    console[level] = function() {
      orig.apply(console, arguments);
      var args = Array.prototype.slice.call(arguments);
      var msg = args.map(function(a) {
        return typeof a === 'string' ? a : JSON.stringify(a);
      }).join(' ').slice(0, 2000);
      window.parent.postMessage({
        type: 'solvent:console',
        level: level,
        message: msg,
        timestamp: Date.now()
      }, '*');
    };
  });

  // === Unhandled errors ===
  window.onerror = function(msg, url, line, col, err) {
    window.parent.postMessage({
      type: 'solvent:error',
      message: String(msg),
      stack: err ? err.stack : undefined,
      timestamp: Date.now()
    }, '*');
  };
  window.addEventListener('unhandledrejection', function(e) {
    window.parent.postMessage({
      type: 'solvent:error',
      message: 'Unhandled Promise Rejection: ' + e.reason,
      timestamp: Date.now()
    }, '*');
  });

  // === DOM change observer ===
  var domHashTimer;
  function emitDomHash() {
    clearTimeout(domHashTimer);
    domHashTimer = setTimeout(function() {
      var body = document.body;
      var html = body.innerHTML.slice(0, 50000);
      var hash = simpleHash(html);
      window.parent.postMessage({
        type: 'solvent:dom-changed',
        hash: hash,
        bodyHTML: html,
        timestamp: Date.now()
      }, '*');
    }, 250);
  }
  var observer = new MutationObserver(emitDomHash);
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, characterData: true
  });
  emitDomHash();

  // === Click capture (capture phase) ===
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!el || el === document) return;
    var rect = el.getBoundingClientRect();
    var dataAttrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      if (attr.name.startsWith('data-')) dataAttrs[attr.name] = attr.value;
    }
    window.parent.postMessage({
      type: 'solvent:click',
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: Array.from(el.classList),
      text: (el.textContent || '').trim().slice(0, 200),
      dataAttrs: dataAttrs,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    }, '*');
  }, true);

  // === html2canvas loader (lazy) ===
  var html2canvasPromise = null;
  function loadHtml2Canvas() {
    if (html2canvasPromise) return html2canvasPromise;
    html2canvasPromise = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return html2canvasPromise;
  }

  // === Screenshot capture listener ===
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'solvent:capture-screenshot') {
      loadHtml2Canvas().then(function() {
        return window.html2canvas(document.body, { useCORS: true, logging: false });
      }).then(function(canvas) {
        var dataUrl = canvas.toDataURL('image/png');
        window.parent.postMessage({ type: 'solvent:screenshot-ready', dataUrl: dataUrl }, '*');
      }).catch(function(err) {
        window.parent.postMessage({ type: 'solvent:screenshot-error', error: err.message }, '*');
      });
    }
  });

  // === Utility ===
  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36).slice(0, 8);
  }
})();
`;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/preview-bridge-script.ts
git commit -m "feat: add bridge script for iframe postMessage runtime

Captures console, errors, DOM changes, clicks, and screenshot requests.
Injected into WebContainer preview iframe during sync."
```

---

### Task 2.3: Inject bridge script during WebContainer sync

**Files:**
- Modify: `frontend/src/components/CodingArea.tsx`

- [ ] **Step 1: Add injection logic to syncProjectToWebContainer**

After the file tree is mounted to WebContainer but before the dev server starts, inject the bridge script:

```typescript
// Import at top
import { BRIDGE_SCRIPT } from '../lib/preview-bridge-script';

// Inside syncProjectToWebContainer, after wc.mount(tree), before running dev server:

// Inject bridge script into index.html
try {
  const indexContent = await wc.fs.readFile('index.html', 'utf-8');
  if (indexContent && indexContent.includes('</head>')) {
    const injected = indexContent.replace(
      '</head>',
      `<script>${BRIDGE_SCRIPT}</script></head>`
    );
    if (injected !== indexContent) {
      await wc.fs.writeFile('index.html', injected);
    }
  } else if (indexContent && indexContent.includes('</body>')) {
    const injected = indexContent.replace(
      '</body>',
      `<script>${BRIDGE_SCRIPT}</script></body>`
    );
    await wc.fs.writeFile('index.html', injected);
  }
} catch {
  // No index.html — non-HTML project, skip injection
}
```

- [ ] **Step 2: Register parent message listener**

Add a `useEffect` in CodingArea that listens for `solvent:*` events from the iframe:

```typescript
// In CodingArea component, add new store actions:
const { appendConsoleEntry, updatePreviewDom, setSelectedElement } = useAppStore();

useEffect(() => {
  const handler = (e: MessageEvent) => {
    const data = e.data;
    if (!data || typeof data !== 'object' || !String(data.type).startsWith('solvent:')) return;

    switch (data.type) {
      case 'solvent:console':
      case 'solvent:error':
        appendConsoleEntry({
          level: data.level || 'error',
          message: data.message,
          timestamp: data.timestamp,
        });
        break;
      case 'solvent:dom-changed':
        updatePreviewDom({ hash: data.hash, bodyHTML: data.bodyHTML });
        break;
      case 'solvent:click':
        setSelectedElement({
          tag: data.tag,
          id: data.id,
          classes: data.classes || [],
          text: data.text || '',
          dataAttrs: data.dataAttrs || {},
          rect: data.rect || { x: 0, y: 0, width: 0, height: 0 },
        });
        break;
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, [appendConsoleEntry, updatePreviewDom, setSelectedElement]);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CodingArea.tsx
git commit -m "feat: inject bridge script into WebContainer preview iframe

Patches index.html during sync, registers postMessage listener
for console, DOM, and click events from the preview."
```

---

## Phase 3: Backend Endpoints

### Task 3.1: Create PreviewStashStore

**Files:**
- Create: `backend/src/services/previewStashStore.ts`
- Test: `backend/src/services/previewStashStore.test.ts`

- [ ] **Step 1: Write the store**

```typescript
// backend/src/services/previewStashStore.ts
export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface PreviewStash {
  entries: ConsoleEntry[];
  bodyHTML: string | null;
  bodyHash: string | null;
  updatedAt: number;
}

class PreviewStashStore {
  private store = new Map<string, { data: PreviewStash; expiry: number }>();
  private pruneInterval: ReturnType<typeof setInterval>;

  constructor(private ttlMs: number = 600_000, private pruneIntervalMs: number = 60_000) {
    this.pruneInterval = setInterval(() => this.prune(), pruneIntervalMs);
    this.pruneInterval.unref(); // Don't keep process alive
  }

  set(sessionId: string, data: PreviewStash): void {
    this.store.set(sessionId, {
      data: { ...data, updatedAt: Date.now() },
      expiry: Date.now() + this.ttlMs,
    });
  }

  get(sessionId: string): PreviewStash | null {
    const entry = this.store.get(sessionId);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(sessionId);
      return null;
    }
    return entry.data;
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) this.store.delete(key);
    }
  }

  destroy(): void {
    clearInterval(this.pruneInterval);
    this.store.clear();
  }
}

export const previewStashStore = new PreviewStashStore();
```

- [ ] **Step 2: Write tests**

```typescript
// backend/src/services/previewStashStore.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { PreviewStashStore } from './previewStashStore';

describe('PreviewStashStore', () => {
  afterEach(() => {
    // Use short TTL to speed up tests
  });

  it('stores and retrieves stash', () => {
    const store = new PreviewStashStore(1000, 10000);
    const stash = { entries: [], bodyHTML: null, bodyHash: null, updatedAt: 0 };
    store.set('session-1', stash);
    expect(store.get('session-1')).toEqual(stash);
    store.destroy();
  });

  it('returns null for unknown session', () => {
    const store = new PreviewStashStore(1000, 10000);
    expect(store.get('unknown')).toBeNull();
    store.destroy();
  });

  it('returns null after TTL expires', () => {
    const store = new PreviewStashStore(50, 10000);
    const stash = { entries: [], bodyHTML: null, bodyHash: null, updatedAt: 0 };
    store.set('session-1', stash);
    expect(store.get('session-1')).not.toBeNull();
    // Wait for TTL
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(store.get('session-1')).toBeNull();
        store.destroy();
        resolve();
      }, 100);
    });
  });

  it('prunes expired entries', () => {
    const store = new PreviewStashStore(50, 50);
    const stash = { entries: [], bodyHTML: null, bodyHash: null, updatedAt: 0 };
    store.set('session-1', stash);
    store.set('session-2', stash);
    expect(store.get('session-1')).not.toBeNull();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // After prune interval, expired entries should be gone
        expect(store.get('session-1')).toBeNull();
        expect(store.get('session-2')).toBeNull();
        store.destroy();
        resolve();
      }, 150);
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npx vitest src/services/previewStashStore.test.ts --run
```

Expected: All 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/previewStashStore.ts backend/src/services/previewStashStore.test.ts
git commit -m "feat: add PreviewStashStore for console/DOM data

In-memory TTL store with automatic pruning.
10-min TTL, 60s prune interval."
```

---

### Task 3.2: Add new tool definitions

**Files:**
- Modify: `backend/src/constants/tools.ts`

- [ ] **Step 1: Add new tool definitions to TOOL_DEFINITIONS array**

Append to the existing `TOOL_DEFINITIONS` array:

```typescript
  {
    name: "get_console_logs",
    description: "Get recent console logs from the preview. Call this to dig into specific errors beyond the push summary.",
    parameters: {
      type: "OBJECT",
      properties: {
        filter: { type: "STRING", description: "Filter by level: 'error', 'warn', or 'log'", enum: ["error", "warn", "log"] },
        limit: { type: "NUMBER", description: "Max entries to return (default 20)" }
      },
      required: []
    }
  },
  {
    name: "get_dom_snapshot",
    description: "Get the current DOM body hash and truncated body HTML from the preview.",
    parameters: {
      type: "OBJECT",
      properties: {},
      required: []
    }
  },
  {
    name: "get_selected_element",
    description: "Get the element the user clicked in the preview. Returns the element info and clears the selection.",
    parameters: {
      type: "OBJECT",
      properties: {},
      required: []
    }
  },
  {
    name: "capture_screenshot",
    description: "Capture a screenshot of the current preview as a PNG image. Only available for multimodal models.",
    parameters: {
      type: "OBJECT",
      properties: {},
      required: []
    }
  },
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/constants/tools.ts
git commit -m "feat: add preview-aware tool definitions

get_console_logs, get_dom_snapshot, get_selected_element,
capture_screenshot. All gated by tier at registration time."
```

---

### Task 3.3: Create preview routes

**Files:**
- Create: `backend/src/routes/previewRoutes.ts`

- [ ] **Step 1: Write the routes**

```typescript
// backend/src/routes/previewRoutes.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { previewStashStore } from '../services/previewStashStore';
import { handleRouteError } from '../utils/routeErrors';

const router = Router();

const MAX_PAYLOAD_SIZE = 500 * 1024; // 500KB

const eventPayloadSchema = z.object({
  sessionId: z.string(),
  entries: z.array(z.object({
    level: z.enum(['log', 'warn', 'error']),
    message: z.string(),
    timestamp: z.number(),
  })).max(200),
  bodyHTML: z.string().nullable().optional(),
  bodyHash: z.string().nullable().optional(),
});

const toolResultSchema = z.object({
  callId: z.string(),
  result: z.unknown(),
});

// Pending call promises: Map<callId, { resolve, reject, timeout }>
const pendingCalls = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

/**
 * Create a pending call that will be resolved when POST /tool-result is called.
 * Times out after 8 seconds.
 */
export function createPendingCall(callId: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCalls.delete(callId);
      resolve({ error: 'Screenshot capture timed out' });
    }, 8000);
    pendingCalls.set(callId, { resolve, reject, timeout });
  });
}

/**
 * Resolve a pending call with the tool result.
 */
function resolvePendingCall(callId: string, result: unknown): boolean {
  const entry = pendingCalls.get(callId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  pendingCalls.delete(callId);
  entry.resolve(result);
  return true;
}

// POST /api/preview/events — fire-and-forget
router.post('/events', (req: Request, res: Response) => {
  // Check payload size
  const rawBody = JSON.stringify(req.body);
  if (rawBody.length > MAX_PAYLOAD_SIZE) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const parseResult = eventPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.errors });
  }

  const { sessionId, entries, bodyHTML, bodyHash } = parseResult.data;
  previewStashStore.set(sessionId, {
    entries,
    bodyHTML: bodyHTML ?? null,
    bodyHash: bodyHash ?? null,
    updatedAt: Date.now(),
  });

  res.status(200).json({ status: 'ok' });
});

// POST /api/preview/tool-result — resolve pending promise
router.post('/tool-result', (req: Request, res: Response) => {
  const parseResult = toolResultSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const { callId, result } = parseResult.data;
  const resolved = resolvePendingCall(callId, result);

  res.status(200).json({ status: resolved ? 'resolved' : 'ignored', reason: resolved ? undefined : 'unknown callId' });
});

export { pendingCalls };
export default router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/previewRoutes.ts
git commit -m "feat: add preview event and tool-result routes

POST /api/preview/events stores console/DOM data.
POST /api/preview/tool-result resolves pending screenshot promises.
8s timeout on pending calls."
```

---

### Task 3.4: Mount preview routes and integrate with AI controller

**Files:**
- Modify: `backend/src/server.ts`
- Modify: `backend/src/routes/aiRoutes.ts`
- Modify: `backend/src/controllers/aiController.ts`

- [ ] **Step 1: Mount preview routes in server.ts**

```typescript
// Add import
import previewRoutes from './routes/previewRoutes';

// In the API Routes section, add:
app.use('/api/v1/preview', previewRoutes);
```

- [ ] **Step 2: Mount preview routes in aiRoutes.ts**

```typescript
// Add import
import previewRoutes from './previewRoutes';

// Add to router:
router.use('/preview', previewRoutes);
```

Note: The routes are mounted in BOTH places for backward compatibility — `server.ts` mounts at `/api/v1/preview` and `aiRoutes.ts` at `/api/v1/agent/preview`. The frontend will use `/api/v1/preview`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts backend/src/routes/aiRoutes.ts
git commit -m "feat: mount preview routes in server and aiRoutes

Routes available at /api/v1/preview/events and /api/v1/preview/tool-result."
```

---

### Task 3.5: Conditionally register tools based on tier

**Files:**
- Modify: `backend/src/services/baseOpenAIService.ts`
- Modify: `backend/src/services/aiService.ts:243-270`

- [ ] **Step 1: Pass tier/traits to tool registration**

In `aiService.ts`, in `processAgentChat`, extract tier from the data:

```typescript
async processAgentChat(
  data: ChatRequestData,
  onEvent: (event: AgentEvent) => void
): Promise<string> {
  const { provider, model, temperature, maxTokens, apiKeys, tier, traits } = data;
  // ... rest of method
```

Then pass tier/traits to the provider:

```typescript
if (selectedProvider instanceof BaseOpenAIService) {
  return selectedProvider.generateChatCompletionWithEvents(
    finalMessages,
    {
      model: model || selectedProvider.defaultModel,
      temperature,
      maxTokens,
      apiKey: apiKeys?.[provider],
    },
    onEvent,
    tier,     // NEW
    traits    // NEW
  );
}
```

- [ ] **Step 2: Update BaseOpenAIService to accept tier/traits**

In `baseOpenAIService.ts`, update the method signature:

```typescript
async generateChatCompletionWithEvents(
  messages: ChatMessage[],
  options: CompletionOptions,
  onEvent: (event: AgentEvent) => void,
  tier?: 'full-agentic' | 'code-only',  // NEW
  traits?: { toolUse: 'strong' | 'basic'; multimodal: boolean; contextWindow: number }  // NEW
): Promise<string> {
```

Then filter tools based on tier:

```typescript
// Replace: payload.tools = this.getToolDefinitions();
// With:
const allTools = this.getToolDefinitions();
const filteredTools = this.filterToolsByTier(allTools, tier, traits);
payload.tools = filteredTools;
payload.tool_choice = "auto";
```

Add the filter method:

```typescript
protected filterToolsByTier(
  tools: unknown[],
  tier?: 'full-agentic' | 'code-only',
  traits?: { toolUse: string; multimodal: boolean; contextWindow: number }
): unknown[] {
  if (tier !== 'full-agentic') {
    // Code-only: exclude preview tools
    const excludeNames = ['get_console_logs', 'get_dom_snapshot', 'get_selected_element', 'capture_screenshot'];
    return (tools as Array<{ function: { name: string } }>).filter(
      t => !excludeNames.includes(t.function.name)
    );
  }

  // Full-agentic: exclude capture_screenshot if not multimodal
  if (!traits?.multimodal) {
    return (tools as Array<{ function: { name: string } }>).filter(
      t => t.function.name !== 'capture_screenshot'
    );
  }

  return tools;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/aiService.ts backend/src/services/baseOpenAIService.ts
git commit -m "feat: conditionally register tools based on model tier

Code-only models don't see preview tools.
Non-multimodal full-agentic models don't see capture_screenshot."
```

---

### Task 3.6: Handle browser-tool SSE event for screenshots

**Files:**
- Modify: `backend/src/services/toolService.ts`
- Modify: `backend/src/services/baseOpenAIService.ts`

- [ ] **Step 1: Add browser-tool handling in toolService**

In `toolService.ts`, add a special case for `capture_screenshot`:

```typescript
// In the executeTool method, add:
if (name === 'capture_screenshot') {
  // This is a browser-tool — emit SSE event and wait for result
  // The actual execution happens via the browser-tool round-trip
  throw new Error('BROWSER_TOOL:capture_screenshot');
}
```

- [ ] **Step 2: Handle the BROWSER_TOOL error in baseOpenAIService**

In the tool execution loop in `generateChatCompletionWithEvents`:

```typescript
try {
  const result = await toolService.executeTool(name, args);
  onEvent({ type: 'tool_result', tool: name, result, iteration, callId });
  // ... push to currentMessages
} catch (toolError: unknown) {
  const toolErr = toolError as Error;
  
  // Check if this is a browser-tool round-trip
  if (toolErr.message.startsWith('BROWSER_TOOL:')) {
    const browserToolName = toolErr.message.split(':')[1];
    const browserCallId = randomUUID();
    
    // Emit browser-tool event
    onEvent({
      type: 'browser-tool',
      tool: browserToolName,
      callId: browserCallId,
    } as AgentEvent);
    
    // Wait for result from POST /api/preview/tool-result
    const { createPendingCall } = await import('../routes/previewRoutes');
    const result = await createPendingCall(browserCallId);
    
    onEvent({ type: 'tool_result', tool: browserToolName, result, iteration, callId });
    currentMessages.push({
      role: "tool",
      tool_call_id: callId,
      name: browserToolName,
      content: JSON.stringify(result)
    });
    continue; // Continue the loop with the result
  }
  
  // Normal error handling...
}
```

- [ ] **Step 3: Add browser-tool to AgentEvent type**

In `backend/src/types/agentEvents.ts` (create if doesn't exist, or modify existing):

```typescript
export type AgentEvent =
  | { type: 'tool_start'; tool: string; args: Record<string, unknown>; iteration: number; callId: string }
  | { type: 'tool_result'; tool: string; result: unknown; iteration: number; callId: string }
  | { type: 'tool_error'; tool: string; error: string; iteration: number; callId: string }
  | { type: 'text_complete'; content: string }
  | { type: 'error'; message: string }
  | { type: 'done' }
  | { type: 'browser-tool'; tool: string; callId: string };  // NEW
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/toolService.ts backend/src/services/baseOpenAIService.ts backend/src/types/agentEvents.ts
git commit -m "feat: add browser-tool SSE round-trip for screenshots

Agent calls capture_screenshot → emits browser-tool event →
frontend captures screenshot → POST /api/preview/tool-result →
backend resolves promise → agent loop continues with result."
```

---

## Phase 4: UI Patterns

### Task 4.1: Build push summary component

**Files:**
- Create: `frontend/src/components/coding/PreviewRuntimeSummary.tsx`
- Modify: `frontend/src/components/coding/AgentChatPanel.tsx` (handleSend integration)

- [ ] **Step 1: Write the summary builder**

```typescript
// frontend/src/components/coding/PreviewRuntimeSummary.tsx
import { useAppStore } from '../../store/useAppStore';

export function buildPreviewRuntimeBlock(): string {
  const {
    previewConsoleBuffer,
    previewBodyHash,
    previewDomChanged,
    previewUrl,
  } = useAppStore.getState();

  if (!previewUrl) return '';

  const errorCount = previewConsoleBuffer.filter(e => e.level === 'error').length;
  const warnCount = previewConsoleBuffer.filter(e => e.level === 'warn').length;
  const lastError = [...previewConsoleBuffer].reverse().find(e => e.level === 'error');
  const lastErrorAge = lastError ? formatAge(Date.now() - lastError.timestamp) : null;

  const parts: string[] = [];

  // Console summary
  if (errorCount > 0 || warnCount > 0) {
    let summary = `console: ${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`;
    if (lastError) {
      const msg = lastError.message.slice(0, 120);
      summary += ` | last-error: "${msg}" (${lastErrorAge ?? 'just now'})`;
    }
    parts.push(summary);
  } else {
    parts.push(`console: clean`);
  }

  // DOM hash
  if (previewBodyHash) {
    parts.push(`dom-hash: ${previewBodyHash} | changed: ${previewDomChanged} since last turn`);
  }

  parts.push(`preview: running`);

  return `\n\n<preview-runtime>\n${parts.join('\n')}\n</preview-runtime>`;
}

function formatAge(ms: number): string {
  if (ms < 1000) return 'just now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
}
```

- [ ] **Step 2: Integrate into AgentChatPanel handleSend**

In `AgentChatPanel.tsx`, in `handleSend`, after building the user message, append the preview runtime block:

```typescript
// Import at top
import { buildPreviewRuntimeBlock } from './PreviewRuntimeSummary';
import { resetDomChanged } from '../../store/codingSlice'; // or use store action

// In handleSend, after creating userMsg:
const runtimeBlock = buildPreviewRuntimeBlock();
if (runtimeBlock) {
  userMsg.content = userMsg.content + runtimeBlock;
}

// After sending, reset domChanged:
useAppStore.getState().resetDomChanged();
```

Actually, since `content` is appended to the user message, we need to be careful. The runtime block should be appended to the content that gets sent to the backend, not to what the user sees. Let me adjust:

```typescript
// In handleSend, when building the messages array for the API call:
const runtimeBlock = buildPreviewRuntimeBlock();

const messages = [
  { role: 'system', content: slashCmd ? slashCmd.systemInstruction + '\n\n' + effectiveSystemPrompt : effectiveSystemPrompt },
  ...currentMessages
    .filter((m) => m.id !== assistantId)
    .map((m) => {
      // Append runtime block to the last user message only
      if (m.role === 'user' && runtimeBlock) {
        return { ...m, content: m.content + runtimeBlock };
      }
      return { role: m.role, content: m.content };
    }),
  { role: 'user', content: parsed?.rest || text },
];
```

Actually — the cleanest approach is to append it to the user message that's being sent right now, not to historical messages:

```typescript
// After the parsed command:
const userContent = parsed?.rest || text;
const runtimeBlock = buildPreviewRuntimeBlock();
const finalUserContent = runtimeBlock ? `${userContent}\n${runtimeBlock}` : userContent;

const messages = [
  { role: 'system', content: slashCmd ? slashCmd.systemInstruction + '\n\n' + effectiveSystemPrompt : effectiveSystemPrompt },
  ...currentMessages
    .filter((m) => m.id !== assistantId)
    .map((m) => ({ role: m.role, content: m.content })),
  { role: 'user', content: finalUserContent },
];
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/coding/PreviewRuntimeSummary.tsx frontend/src/components/coding/AgentChatPanel.tsx
git commit -m "feat: add push summary runtime block to user messages

Appends <preview-runtime> with console errors/warnings, DOM hash,
and preview status. Zero tokens when no preview running."
```

---

### Task 4.2: Add screenshot button to PreviewPanel

**Files:**
- Modify: `frontend/src/components/coding/PreviewPanel.tsx`

- [ ] **Step 1: Refactor onSnap to use screenshot flow**

Replace the existing `onSnap` prop with a screenshot capture flow. The button should only appear when `canUseScreenshots === true`.

```typescript
// Add import
import { useModelCapabilities } from '../../hooks/useModelCapabilities';

// In the component:
const { canUseScreenshots } = useModelCapabilities();

// Replace the Camera button section:
{canUseScreenshots && (
  <button
    type="button"
    onClick={handleCaptureScreenshot}
    className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors shrink-0"
    aria-label="Capture screenshot"
    title="Capture screenshot"
  >
    <Camera size={11} />
  </button>
)}

// The handler:
const handleCaptureScreenshot = () => {
  // Post message to iframe to trigger screenshot capture
  iframeRef.current?.contentWindow?.postMessage(
    { type: 'solvent:capture-screenshot' },
    '*'
  );
};
```

Wait — the spec says the agent calls `capture_screenshot` as a tool, not the user clicking a button. The button in the PreviewPanel should trigger the tool call flow. But the user doesn't directly call tools — the agent does.

Re-reading the spec: "When clicked (and `canUseScreenshots === true`): Parent sends `capture_screenshot` tool call to backend." This means clicking the button in the PreviewPanel sends a message to the agent to call the tool, or directly triggers the browser-tool round-trip.

Actually the simplest approach: the user clicks the screenshot button → it captures via iframe postMessage → uploads → the result is available for the agent's next turn. The agent can also call `capture_screenshot` as a tool (which triggers the browser-tool SSE flow).

So the PreviewPanel button is a user-initiated screenshot capture that works independently of the agent tool loop. Let me adjust:

```typescript
const handleCaptureScreenshot = async () => {
  if (!iframeRef.current?.contentWindow) return;
  
  // Create a promise that resolves when the iframe posts back
  const screenshotPromise = new Promise<string>((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'solvent:screenshot-ready') {
        window.removeEventListener('message', handler);
        resolve(e.data.dataUrl);
      } else if (e.data?.type === 'solvent:screenshot-error') {
        window.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    window.addEventListener('message', handler);
    // Timeout
    setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Screenshot timed out'));
    }, 10000);
  });

  // Trigger capture
  iframeRef.current.contentWindow.postMessage(
    { type: 'solvent:capture-screenshot' },
    '*'
  );

  try {
    const dataUrl = await screenshotPromise;
    // Upload the screenshot
    const blob = await (await fetch(dataUrl)).blob();
    const formData = new FormData();
    formData.append('file', blob, 'screenshot.png');
    
    const res = await fetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    
    // Store URL in Zustand
    useAppStore.getState().setPreviewScreenshotUrl(data.url);
    addTerminalLine(`[SCREENSHOT]: Captured preview screenshot`);
  } catch (err) {
    addTerminalLine(`[SCREENSHOT]: ${err instanceof Error ? err.message : 'Failed'}`);
  }
};
```

Also need to add `addTerminalLine` from the store.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/coding/PreviewPanel.tsx
git commit -m "feat: replace onSnap with screenshot capture in PreviewPanel

User-initiated screenshot via html2canvas in iframe.
Uploads to backend, stores URL in Zustand."
```

---

### Task 4.3: Build click-to-edit pill

**Files:**
- Create: `frontend/src/components/coding/ClickToEditPill.tsx`
- Modify: `frontend/src/components/coding/AgentChatPanel.tsx` (render pill)
- Modify: `frontend/src/components/coding/slashCommands.ts` (system prompt hint)

- [ ] **Step 1: Write the pill component**

```typescript
// frontend/src/components/coding/ClickToEditPill.tsx
import React from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const ClickToEditPill: React.FC = () => {
  const { previewSelectedElement, setSelectedElement } = useAppStore();

  if (!previewSelectedElement) return null;

  const { tag, classes, text } = previewSelectedElement;
  const classStr = classes.slice(0, 2).join('.');
  const label = classStr ? `<${tag}.${classStr}>` : `<${tag}>`;
  const textPreview = text ? `"${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"` : '';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-jb-accent/10 border border-jb-accent/20">
      <span className="text-[11px] text-jb-accent/80 font-mono">
        Clicked: {label} {textPreview}
      </span>
      <button
        type="button"
        onClick={() => setSelectedElement(null)}
        className="p-0.5 hover:bg-white/10 rounded text-white/30 hover:text-white/60"
        aria-label="Dismiss"
      >
        <X size={10} />
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Render pill in AgentChatPanel**

In `AgentChatPanel.tsx`, above the composer input area, render the pill:

```typescript
// Import
import { ClickToEditPill } from './ClickToEditPill';

// In the return, before the input area:
<ClickToEditPill />
```

- [ ] **Step 3: Update system prompt**

In `slashCommands.ts`, update `buildSystemPrompt` to accept `previewSelectedElement`:

```typescript
export function buildSystemPrompt(
  filePath: string | null,
  fileContent: string | null,
  selection: string | null,
  openFiles?: Array<{ path: string; content: string }>,
  projectName?: string | null,
  previewUrl?: string | null,
  previewSelectedElement?: { tag: string; classes: string[]; text: string } | null,  // NEW
): string {
  // ... existing parts ...

  if (previewSelectedElement) {
    const { tag, classes, text } = previewSelectedElement;
    const classStr = classes.join('.');
    parts.push(
      `\nSelected element: <${tag}${classStr ? ' class="' + classStr + '"' : ''}>${text}</${tag}>`,
      `The user has selected this element from the preview. Call get_selected_element() to see its full details.`
    );
  }

  return parts.join('\n');
}
```

- [ ] **Step 4: Pass element info to buildSystemPrompt in handleSend**

In `AgentChatPanel.tsx`, in `handleSend`:

```typescript
const previewSelectedElement = useAppStore.getState().previewSelectedElement;

const systemPrompt = buildSystemPrompt(
  !allFilesContext && fileContextActive ? activeFile : null,
  !allFilesContext && fileContextActive ? activeFileContent : null,
  null,
  allFilesContext ? openFiles : undefined,
  currentProject?.name ?? null,
  previewUrl,
  previewSelectedElement,  // NEW
);
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/coding/ClickToEditPill.tsx frontend/src/components/coding/AgentChatPanel.tsx frontend/src/components/coding/slashCommands.ts
git commit -m "feat: add click-to-edit pill and system prompt hint

Pill appears when user clicks preview element. Auto-dismisses on read.
System prompt hints agent to call get_selected_element()."
```

---

### Task 4.4: Wire preview data flush on message send

**Files:**
- Modify: `frontend/src/components/coding/AgentChatPanel.tsx` (handleSend)

- [ ] **Step 1: Add fire-and-forget flush in handleSend**

After the message is sent, flush the full console buffer to the backend:

```typescript
// In handleSend, after the fetch call (fire-and-forget, don't await):
const { previewConsoleBuffer, previewBodyHTML, previewBodyHash } = useAppStore.getState();
const sessionId = useAppStore.getState().currentProject?.name ?? 'default';

fetch(`${API_BASE_URL}/preview/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    entries: previewConsoleBuffer,
    bodyHTML: previewBodyHTML,
    bodyHash: previewBodyHash,
  }),
}).catch(() => {}); // Fire-and-forget
```

Note: The frontend needs to know the session ID. The existing codebase doesn't have a clear session concept for the agent chat — we'll use the project name as the session key. If no project is open, use 'default'.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/coding/AgentChatPanel.tsx
git commit -m "feat: flush preview data to backend on message send

Fire-and-forget POST to /api/preview/events with full console
buffer and DOM snapshot. Enables pull tools for agent."
```

---

## Phase 5: Delegation A+

### Task 5.1: Create delegate candidate parser and card

**Files:**
- Create: `frontend/src/components/coding/DelegateCandidateCard.tsx`
- Test: `frontend/src/components/coding/DelegateCandidateCard.test.tsx`

- [ ] **Step 1: Write the parser**

```typescript
// frontend/src/components/coding/DelegateCandidateCard.tsx (top of file)

export interface DelegateCandidate {
  task: string;
  files: string[];
  context: string;
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.trim() ?? null;
}

export function parseDelegateCandidate(text: string): DelegateCandidate | null {
  const match = text.match(/<delegate-candidate>([\s\S]*?)<\/delegate-candidate>/);
  if (!match) return null;
  const inner = match[1];
  const task = extractTag(inner, 'task') ?? '';
  const filesRaw = extractTag(inner, 'files') ?? '';
  const files = filesRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const context = extractTag(inner, 'context') ?? '';
  return { task, files, context };
}
```

- [ ] **Step 2: Write the card component**

```typescript
interface DelegateCandidateCardProps {
  candidate: DelegateCandidate;
  onSend: () => void;
  onDismiss: () => void;
  status?: 'pending' | 'running' | 'complete' | 'failed';
  resultMessage?: string;
}

export const DelegateCandidateCard: React.FC<DelegateCandidateCardProps> = ({
  candidate,
  onSend,
  onDismiss,
  status = 'pending',
  resultMessage,
}) => {
  return (
    <div className={cn(
      'rounded-xl border p-3 text-[12px]',
      status === 'pending' && 'bg-black/30 border-amber-500/30',
      status === 'running' && 'bg-black/30 border-amber-500/30',
      status === 'complete' && 'bg-black/30 border-emerald-500/30',
      status === 'failed' && 'bg-black/30 border-red-500/30',
    )}>
      {status === 'pending' && (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Delegate to code-tier model
            </span>
          </div>
          <p className="text-slate-300 mb-1">{candidate.task}</p>
          <p className="text-[11px] text-slate-500 font-mono mb-2">
            {candidate.files.join(', ')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onSend}
              className="px-2.5 py-1 rounded-md bg-jb-accent/20 text-jb-accent text-[11px] font-bold hover:bg-jb-accent/30 transition-colors"
            >
              Send to code model
            </button>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1 rounded-md bg-white/5 text-slate-400 text-[11px] font-bold hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </>
      )}
      {status === 'running' && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-amber-400 text-[11px] font-bold uppercase">Delegating</span>
        </div>
      )}
      {status === 'complete' && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-emerald-400 text-[11px] font-bold uppercase">Complete</span>
          </div>
          <p className="text-slate-300 mb-2">{resultMessage ?? 'Task completed'}</p>
          <div className="flex gap-2">
            <button className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
              Open result
            </button>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1 rounded-md bg-white/5 text-slate-400 text-[11px] font-bold hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {status === 'failed' && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-red-400 text-[11px] font-bold uppercase">Failed</span>
          </div>
          <p className="text-slate-400 mb-2">{resultMessage ?? 'Delegation failed'}</p>
          <button
            onClick={onSend}
            className="px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 text-[11px] font-bold border border-red-500/30"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Write tests**

```typescript
// frontend/src/components/coding/DelegateCandidateCard.test.tsx
import { describe, it, expect } from 'vitest';
import { parseDelegateCandidate } from './DelegateCandidateCard';

describe('parseDelegateCandidate', () => {
  it('parses valid delegate block', () => {
    const text = `Some text before
<delegate-candidate>
  <task>Add loading spinner</task>
  <files>src/components/SubmitButton.tsx</files>
  <context>Current button code</context>
</delegate-candidate>
Some text after`;
    const result = parseDelegateCandidate(text);
    expect(result).not.toBeNull();
    expect(result!.task).toBe('Add loading spinner');
    expect(result!.files).toEqual(['src/components/SubmitButton.tsx']);
    expect(result!.context).toBe('Current button code');
  });

  it('returns null for malformed XML', () => {
    expect(parseDelegateCandidate('<delegate-candidate>unclosed')).toBeNull();
    expect(parseDelegateCandidate('no delegate block')).toBeNull();
  });

  it('handles missing fields gracefully', () => {
    const result = parseDelegateCandidate('<delegate-candidate></delegate-candidate>');
    expect(result).not.toBeNull();
    expect(result!.task).toBe('');
    expect(result!.files).toEqual([]);
    expect(result!.context).toBe('');
  });

  it('handles multiple files', () => {
    const result = parseDelegateCandidate(
      '<delegate-candidate><files>src/a.ts, src/b.ts\nsrc/c.ts</files></delegate-candidate>'
    );
    expect(result!.files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest src/components/coding/DelegateCandidateCard.test.tsx --run
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/coding/DelegateCandidateCard.tsx frontend/src/components/coding/DelegateCandidateCard.test.tsx
git commit -m "feat: add delegate candidate parser and card component

Parses <delegate-candidate> XML blocks. Card shows pending/running/
complete/failed states. Malformed XML swallowed without throwing."
```

---

### Task 5.2: Render delegate cards in AgentChatPanel

**Files:**
- Modify: `frontend/src/components/coding/AgentChatPanel.tsx` (renderMessageContent)

- [ ] **Step 1: Detect and render delegate blocks**

In `renderMessageContent`, detect `<delegate-candidate>` blocks:

```typescript
import { parseDelegateCandidate, DelegateCandidateCard } from './DelegateCandidateCard';

function renderMessageContent(msg: AgentMessage) {
  const parts = msg.content.split(/(\[\[CODE_BLOCK:[^\]]+\]\])/);

  return (
    <>
      {msg.toolEvents && msg.toolEvents.length > 0 && (
        <ToolActivityFeed events={msg.toolEvents} />
      )}

      {parts.map((part, i) => {
        const blockMatch = part.match(/\[\[CODE_BLOCK:([^\]]+)\]\]/);
        if (blockMatch) {
          // ... existing code block rendering
        }

        // Check for delegate candidate
        const delegate = parseDelegateCandidate(part);
        if (delegate) {
          return (
            <DelegateCandidateCard
              key={`delegate-${i}`}
              candidate={delegate}
              onSend={handleDelegateSend}
              onDismiss={() => {/* dismiss logic */}}
            />
          );
        }

        return part ? (
          <p key={i} className="...">{part}</p>
        ) : null;
      })}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/coding/AgentChatPanel.tsx
git commit -m "feat: render delegate candidate cards in chat messages

Detects <delegate-candidate> blocks and replaces with interactive card."
```

---

### Task 5.3: Add delegation instructions to system prompt

**Files:**
- Modify: `frontend/src/components/coding/slashCommands.ts`

- [ ] **Step 1: Add delegation paragraph to buildSystemPrompt**

```typescript
// At the end of buildSystemPrompt, after all existing parts:
if (tier === 'full-agentic') {
  parts.push(`
When a task is self-contained, file-scoped, and doesn't require reasoning about broader system state,
use the <delegate-candidate> format to delegate to a code-tier model:

<delegate-candidate>
  <task>Brief description of the task</task>
  <files>src/components/FileName.tsx</files>
  <context>Relevant context for the code-tier model</context>
</delegate-candidate>

Use this for boilerplate, UI scaffolding, and isolated component changes.
`);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/coding/slashCommands.ts
git commit -m "feat: add delegation instructions for full-agentic models

Teaches models the <delegate-candidate> XML format for code-tier handoff."
```

---

### Task 5.4: Add preferredCodeModel setting

**Files:**
- Modify: `frontend/src/store/codingSlice.ts`

- [ ] **Step 1: Add preferredCodeModel to state**

```typescript
// In the interface:
preferredCodeModel: string | null;
setPreferredCodeModel: (model: string) => void;

// In initial state:
preferredCodeModel: null,

// In actions:
setPreferredCodeModel: (preferredCodeModel) => set({ preferredCodeModel }),
```

- [ ] **Step 2: Add persist middleware**

The existing Zustand store already uses persist middleware. Add `preferredCodeModel` to the persist config.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/codingSlice.ts
git commit -m "feat: add preferredCodeModel persisted setting

Defaults to null (first code-only model). Settable from model selector."
```

---

### Task 5.5: Final integration — flush preview data on send

**Files:**
- Modify: `frontend/src/components/coding/AgentChatPanel.tsx`

This was already done in Task 4.4. Verify the flush is correctly wired.

- [ ] **Step 1: Verify end-to-end flow**

Run the full app and verify:
1. Console errors in preview appear in `<preview-runtime>` block
2. Clicking preview element shows pill
3. Screenshot button works with multimodal model
4. No preview controls shown with code-only model

---

## Testing

### Task 6.1: Run full test suite

```bash
cd frontend && npx vitest --run
cd ../backend && npx vitest --run
```

Expected: All existing tests pass + new tests added above.

### Task 6.2: TypeScript check

```bash
cd frontend && npx tsc --noEmit
cd ../backend && npx tsc --noEmit
```

Expected: No errors.

### Task 6.3: Build check

```bash
cd frontend && npm run build
```

Expected: Clean build.

---

## Spec Coverage Checklist

| Spec Section | Task |
|---|---|
| Model curation (tier schema, gating hook) | 1.1, 1.2 |
| Tier transport (Option B) | 1.3 |
| Bridge script injection | 2.1, 2.2, 2.3 |
| Zustand preview state | 2.1 |
| POST /api/preview/events | 3.3 |
| POST /api/preview/tool-result | 3.3 |
| PreviewStashStore (TTL, prune) | 3.1 |
| Pull tools (get_console_logs, get_dom_snapshot, get_selected_element) | 3.2, 3.5 |
| capture_screenshot browser-tool round-trip | 3.6 |
| Tool gating by tier | 3.5 |
| Push summary block | 4.1 |
| Screenshot button (replaces onSnap) | 4.2 |
| Click-to-edit pill | 4.3 |
| System prompt updates | 4.3, 5.3 |
| Delegate candidate parser | 5.1 |
| Delegate card component | 5.1, 5.2 |
| preferredCodeModel setting | 5.4 |
| Backend validation (Option C) deferred | Noted in spec |
