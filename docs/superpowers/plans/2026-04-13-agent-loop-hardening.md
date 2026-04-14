# Agent Loop Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the agent tool-calling loop correct and resilient across all providers — fixing silent tool drop, think-tag pollution, context window overflow, and thin iteration budgets — then surface persistent chat history and an accurate preview workflow to the user.

**Architecture:** Backend providers are unified under `BaseOpenAIService` so the event-emitting tool loop applies to every model. `baseOpenAIService.ts` gains think-tag stripping and tier-aware iteration limits. `toolService.ts` caps output sizes. Frontend adds localStorage-backed chat history and a corrected SPA-aware system prompt.

**Tech Stack:** TypeScript, Vitest, Zustand (frontend state), React, localStorage

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/src/plugins/providers/groq.ts` | Modify | Extend BaseOpenAIService, remove duplicate complete() |
| `backend/src/plugins/providers/fireworks.ts` | Modify | Same |
| `backend/src/plugins/providers/cerebras.ts` | Modify | Same |
| `backend/src/plugins/providers/openrouter.ts` | Modify | Same + getExtraHeaders() + shouldSkipJsonMode() |
| `backend/src/services/baseOpenAIService.ts` | Modify | stripThinkTags(), shouldSkipJsonMode hook, tier-aware maxIterations |
| `backend/src/services/toolService.ts` | Modify | readFile truncation, listFiles entry cap |
| `backend/src/plugins/providers/providers.test.ts` | Modify | instanceof BaseOpenAIService assertions |
| `frontend/src/store/codingSlice.ts` | Modify | persistAgentMessages(), restoreAgentMessages() helpers |
| `frontend/src/components/coding/AgentChatPanel.tsx` | Modify | Restore on mount, debounced save on change |
| `frontend/src/components/coding/slashCommands.ts` | Modify | SPA-aware preview workflow in buildSystemPrompt() |

---

## Phase 1 — Correctness: Provider Inheritance + Think Tag Stripping

### Task 1: Add `shouldSkipJsonMode` hook to BaseOpenAIService

**Context:** OpenRouter's current `complete()` skips `jsonMode` for reasoning models (R1, thinking, reasoner pattern). When OpenRouter extends BaseOpenAIService, this logic must not be lost. The hook defaults to `false` (all other providers), OpenRouter overrides it.

**Files:**
- Modify: `backend/src/services/baseOpenAIService.ts`

- [ ] **Step 1: Add the protected hook method to BaseOpenAIService**

  In `baseOpenAIService.ts`, after the `getExtraHeaders` declaration at the bottom of the class (around line 410), add:

  ```typescript
  /**
   * Override in subclasses to suppress jsonMode for specific model families.
   * Example: OpenRouter suppresses it for reasoning models that use <think> blocks.
   */
  protected shouldSkipJsonMode(_model: string): boolean {
    return false;
  }
  ```

- [ ] **Step 2: Use the hook in both completion methods**

  In `generateChatCompletion` (around line 116), replace:
  ```typescript
  if (options.jsonMode) {
    payload.response_format = { type: "json_object" };
  }
  ```
  With:
  ```typescript
  if (options.jsonMode && !this.shouldSkipJsonMode(model)) {
    payload.response_format = { type: "json_object" };
  }
  ```

  Apply the same replacement in `generateChatCompletionWithEvents` (around line 216). Both blocks are identical.

- [ ] **Step 3: Verify build passes**

  ```bash
  cd backend && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/services/baseOpenAIService.ts
  git commit -m "feat: add shouldSkipJsonMode hook to BaseOpenAIService"
  ```

---

### Task 2: Convert Groq to extend BaseOpenAIService

**Context:** `aiService.ts:259` gates on `instanceof BaseOpenAIService`. Groq currently fails that check and falls through to a single-shot `complete()` with no tool execution. Compound Beta routes through Groq.

**Files:**
- Modify: `backend/src/plugins/providers/groq.ts`
- Modify: `backend/src/plugins/providers/providers.test.ts`

- [ ] **Step 1: Write the failing test**

  In `providers.test.ts`, add inside the existing `describe` block:

  ```typescript
  import { BaseOpenAIService } from '../../services/baseOpenAIService';
  import { FireworksProviderPlugin } from './fireworks';
  import { CerebrasProviderPlugin } from './cerebras';
  import { OpenRouterProviderPlugin } from './openrouter';

  it('groq should extend BaseOpenAIService for tool-calling loop', () => {
    const plugin = new GroqProviderPlugin();
    expect(plugin).toBeInstanceOf(BaseOpenAIService);
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd backend && npx vitest run src/plugins/providers/providers.test.ts
  ```
  Expected: FAIL — `GroqProviderPlugin is not an instance of BaseOpenAIService`

- [ ] **Step 3: Rewrite groq.ts**

  Replace the entire file content with:

  ```typescript
  import { IProviderPlugin, ProviderHealth } from '../../types/plugins';
  import { config } from '../../config';
  import { logger } from '../../utils/logger';
  import { BaseOpenAIService } from '../../services/baseOpenAIService';

  export class GroqProviderPlugin extends BaseOpenAIService implements IProviderPlugin {
    readonly name = 'Groq Cloud';
    protected baseUrl = 'https://api.groq.com/openai/v1';
    protected apiKey: string = '';

    id = 'groq';
    description = 'Groq cloud-based AI provider';
    version = '1.0.0';
    defaultModel = 'llama-3.3-70b-versatile';
    capabilities = {
      supportsVision: false,
      supportsStreaming: true,
      supportsEmbeddings: false,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsFunctionCalling: true,
      costPer1k: { input: 0.05, output: 0.08 },
    };

    private isInitialized = false;

    async initialize(options: Record<string, unknown>): Promise<void> {
      this.apiKey = (options.apiKey as string) || config.GROQ_API_KEY || '';
      this.isInitialized = true;
      logger.info(`[Groq] Provider initialized (API key present: ${!!this.apiKey})`);
    }

    isReady(): boolean {
      return this.isInitialized;
    }

    async healthCheck(): Promise<boolean> {
      try {
        if (!this.apiKey) return false;
        const response = await fetch(`${this.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        return response.ok;
      } catch (error) {
        logger.error('[Groq] Health check failed:', error);
        return false;
      }
    }

    async getHealth(): Promise<ProviderHealth> {
      const startTime = Date.now();
      const isHealthy = await this.healthCheck();
      return { isHealthy, lastChecked: Date.now(), latency: Date.now() - startTime, errorRate: 0 };
    }
  }

  export default GroqProviderPlugin;
  ```

- [ ] **Step 4: Run test to confirm it passes**

  ```bash
  cd backend && npx vitest run src/plugins/providers/providers.test.ts
  ```
  Expected: PASS

- [ ] **Step 5: Verify full build**

  ```bash
  cd backend && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/plugins/providers/groq.ts backend/src/plugins/providers/providers.test.ts
  git commit -m "feat: groq extends BaseOpenAIService for full tool-calling loop"
  ```

---

### Task 3: Convert Fireworks to extend BaseOpenAIService

**Files:**
- Modify: `backend/src/plugins/providers/fireworks.ts`
- Modify: `backend/src/plugins/providers/providers.test.ts`

- [ ] **Step 1: Write the failing test**

  In `providers.test.ts`, add inside the existing `describe` block:

  ```typescript
  it('fireworks should extend BaseOpenAIService for tool-calling loop', () => {
    const plugin = new FireworksProviderPlugin();
    expect(plugin).toBeInstanceOf(BaseOpenAIService);
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd backend && npx vitest run src/plugins/providers/providers.test.ts
  ```
  Expected: FAIL

- [ ] **Step 3: Rewrite fireworks.ts**

  Replace the entire file content with:

  ```typescript
  import { IProviderPlugin, ProviderHealth } from '../../types/plugins';
  import { config } from '../../config';
  import { logger } from '../../utils/logger';
  import { BaseOpenAIService } from '../../services/baseOpenAIService';

  export class FireworksProviderPlugin extends BaseOpenAIService implements IProviderPlugin {
    readonly name = 'Fireworks AI';
    protected baseUrl = 'https://api.fireworks.ai/inference/v1';
    protected apiKey: string = '';

    id = 'fireworks';
    description = 'Fireworks AI — fast inference for open models via OpenAI-compatible API';
    version = '1.0.0';
    defaultModel = 'accounts/fireworks/models/llama-v3p3-70b-instruct';
    capabilities = {
      supportsVision: false,
      supportsStreaming: true,
      supportsEmbeddings: false,
      contextWindow: 131072,
      maxOutputTokens: 16384,
      supportsFunctionCalling: true,
      costPer1k: { input: 0.0, output: 0.0 },
    };

    private isInitialized = false;

    async initialize(options: Record<string, unknown>): Promise<void> {
      this.apiKey = (options.apiKey as string) || config.FIREWORKS_API_KEY || '';
      this.isInitialized = true;
      logger.info(`[Fireworks] Provider initialized (API key present: ${!!this.apiKey})`);
    }

    isReady(): boolean {
      return this.isInitialized;
    }

    async healthCheck(): Promise<boolean> {
      try {
        if (!this.apiKey) return false;
        const response = await fetch(`${this.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        return response.ok;
      } catch (error) {
        logger.error('[Fireworks] Health check failed:', error);
        return false;
      }
    }

    async getHealth(): Promise<ProviderHealth> {
      const startTime = Date.now();
      const isHealthy = await this.healthCheck();
      return { isHealthy, lastChecked: Date.now(), latency: Date.now() - startTime, errorRate: 0 };
    }
  }

  export default FireworksProviderPlugin;
  ```

- [ ] **Step 4: Run test to confirm it passes**

  ```bash
  cd backend && npx vitest run src/plugins/providers/providers.test.ts
  ```
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/plugins/providers/fireworks.ts backend/src/plugins/providers/providers.test.ts
  git commit -m "feat: fireworks extends BaseOpenAIService for full tool-calling loop"
  ```

---

### Task 4: Convert Cerebras to extend BaseOpenAIService

**Files:**
- Modify: `backend/src/plugins/providers/cerebras.ts`
- Modify: `backend/src/plugins/providers/providers.test.ts`

- [ ] **Step 1: Write the failing test**

  In `providers.test.ts`, add inside the existing `describe` block:

  ```typescript
  it('cerebras should extend BaseOpenAIService for tool-calling loop', () => {
    const plugin = new CerebrasProviderPlugin();
    expect(plugin).toBeInstanceOf(BaseOpenAIService);
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd backend && npx vitest run src/plugins/providers/providers.test.ts
  ```
  Expected: FAIL

- [ ] **Step 3: Rewrite cerebras.ts**

  Replace the entire file content with:

  ```typescript
  import { IProviderPlugin, ProviderHealth } from '../../types/plugins';
  import { config } from '../../config';
  import { logger } from '../../utils/logger';
  import { BaseOpenAIService } from '../../services/baseOpenAIService';

  export class CerebrasProviderPlugin extends BaseOpenAIService implements IProviderPlugin {
    readonly name = 'Cerebras Cloud';
    protected baseUrl = 'https://api.cerebras.ai/v1';
    protected apiKey: string = '';

    id = 'cerebras';
    description = 'Cerebras wafer-scale inference — ultra-fast OpenAI-compatible API';
    version = '1.0.0';
    defaultModel = 'llama3.1-8b';
    capabilities = {
      supportsVision: false,
      supportsStreaming: true,
      supportsEmbeddings: false,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsFunctionCalling: false,
      costPer1k: { input: 0.0, output: 0.0 },
    };

    private isInitialized = false;

    async initialize(options: Record<string, unknown>): Promise<void> {
      this.apiKey = (options.apiKey as string) || config.CEREBRAS_API_KEY || '';
      this.isInitialized = true;
      logger.info(`[Cerebras] Provider initialized (API key present: ${!!this.apiKey})`);
    }

    isReady(): boolean {
      return this.isInitialized;
    }

    async healthCheck(): Promise<boolean> {
      try {
        if (!this.apiKey) return false;
        const response = await fetch(`${this.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        return response.ok;
      } catch (error) {
        logger.error('[Cerebras] Health check failed:', error);
        return false;
      }
    }

    async getHealth(): Promise<ProviderHealth> {
      const startTime = Date.now();
      const isHealthy = await this.healthCheck();
      return { isHealthy, lastChecked: Date.now(), latency: Date.now() - startTime, errorRate: 0 };
    }
  }

  export default CerebrasProviderPlugin;
  ```

- [ ] **Step 4: Run test to confirm it passes**

  ```bash
  cd backend && npx vitest run src/plugins/providers/providers.test.ts
  ```
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/plugins/providers/cerebras.ts backend/src/plugins/providers/providers.test.ts
  git commit -m "feat: cerebras extends BaseOpenAIService for full tool-calling loop"
  ```

---

### Task 5: Convert OpenRouter to extend BaseOpenAIService

**Context:** OpenRouter has two special requirements beyond the others:
1. Extra headers: `HTTP-Referer` and `X-Title` — use the `getExtraHeaders()` hook already on BaseOpenAIService
2. jsonMode suppression for reasoning models — use the `shouldSkipJsonMode()` hook added in Task 1

**Files:**
- Modify: `backend/src/plugins/providers/openrouter.ts`
- Modify: `backend/src/plugins/providers/providers.test.ts`

- [ ] **Step 1: Write the failing test**

  In `providers.test.ts`, add inside the existing `describe` block:

  ```typescript
  it('openrouter should extend BaseOpenAIService for tool-calling loop', () => {
    const plugin = new OpenRouterProviderPlugin();
    expect(plugin).toBeInstanceOf(BaseOpenAIService);
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd backend && npx vitest run src/plugins/providers/providers.test.ts
  ```
  Expected: FAIL

- [ ] **Step 3: Rewrite openrouter.ts**

  Replace the entire file content with:

  ```typescript
  import { IProviderPlugin, ProviderHealth } from '../../types/plugins';
  import { config } from '../../config';
  import { BaseOpenAIService } from '../../services/baseOpenAIService';

  const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

  export class OpenRouterProviderPlugin extends BaseOpenAIService implements IProviderPlugin {
    readonly name = 'OpenRouter';
    protected baseUrl = OPENROUTER_BASE_URL;
    protected apiKey: string = '';

    id = 'openrouter';
    description = 'OpenRouter — unified API for 200+ models including Claude, GPT-4o, DeepSeek, Llama';
    version = '1.0.0';
    defaultModel = 'openai/gpt-4o-mini';
    capabilities = {
      supportsVision: false,
      supportsStreaming: false,
      supportsEmbeddings: false,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsFunctionCalling: true,
      costPer1k: { input: 0.0, output: 0.0 },
    };

    private isInitialized = false;

    async initialize(options: Record<string, unknown>): Promise<void> {
      this.apiKey = (options.apiKey as string) || config.OPENROUTER_API_KEY || '';
      this.isInitialized = true;
    }

    isReady(): boolean {
      return this.isInitialized;
    }

    async healthCheck(): Promise<boolean> {
      try {
        if (!this.apiKey) return false;
        const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        return response.ok;
      } catch {
        return false;
      }
    }

    async getHealth(): Promise<ProviderHealth> {
      const startTime = Date.now();
      const isHealthy = await this.healthCheck();
      return { isHealthy, lastChecked: Date.now(), latency: Date.now() - startTime, errorRate: 0 };
    }

    protected getExtraHeaders(): Record<string, string> {
      return {
        'HTTP-Referer': 'https://solvent.ai',
        'X-Title': 'Solvent AI',
      };
    }

    protected shouldSkipJsonMode(model: string): boolean {
      return /deepseek.*r1|thinking|reasoner/i.test(model);
    }
  }

  export default OpenRouterProviderPlugin;
  ```

- [ ] **Step 4: Run test to confirm it passes**

  ```bash
  cd backend && npx vitest run src/plugins/providers/providers.test.ts
  ```
  Expected: all tests PASS

- [ ] **Step 5: Run full backend test suite**

  ```bash
  cd backend && npx vitest run
  ```
  Expected: no regressions

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/plugins/providers/openrouter.ts backend/src/plugins/providers/providers.test.ts
  git commit -m "feat: openrouter extends BaseOpenAIService with extra headers and reasoning-model jsonMode guard"
  ```

---

### Task 6: Strip `<think>` tags in BaseOpenAIService

**Context:** Qwen3, DeepSeek-R1, and other reasoning models emit `<think>...</think>` blocks in `message.content`. Without stripping: (1) the raw think block goes back into `currentMessages` and gets re-sent as context on every subsequent turn — wasting thousands of tokens; (2) if the final turn ends with a think block, users see raw XML as the response.

**Files:**
- Modify: `backend/src/services/baseOpenAIService.ts`

- [ ] **Step 1: Add the stripThinkTags helper at module level**

  After the closing brace of `parseXmlToolCalls` (around line 49), add:

  ```typescript
  /**
   * Strip <think>...</think> blocks emitted by reasoning models (Qwen3, DeepSeek-R1, etc.)
   * before processing content or returning it to the user.
   */
  function stripThinkTags(text: string): string {
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }
  ```

- [ ] **Step 2: Apply stripping in generateChatCompletion**

  In `generateChatCompletion`, after `const message = response.data.choices[0].message;`, replace:
  ```typescript
  const content = message.content || "";

  if (!message.tool_calls) {
    return typeof content === 'string' ? content : JSON.stringify(content);
  }

  // Handle Tool Calls
  logger.info(`[${this.name}] Tool calls detected: ${message.tool_calls.length}`);
  currentMessages.push(message);
  ```

  With:
  ```typescript
  const rawContent = message.content || "";
  const content = stripThinkTags(typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent));

  if (!message.tool_calls) {
    return content;
  }

  // Handle Tool Calls
  logger.info(`[${this.name}] Tool calls detected: ${message.tool_calls.length}`);
  currentMessages.push({ ...message, content });
  ```

- [ ] **Step 3: Apply stripping in generateChatCompletionWithEvents**

  In `generateChatCompletionWithEvents`, after `const message = response.data.choices[0].message;`, replace:
  ```typescript
  const content = message.content || "";
  ```

  With:
  ```typescript
  const rawContent = message.content || "";
  const content = stripThinkTags(typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent));
  ```

  Then find where `currentMessages.push(message)` appears in this method (the structured tool_calls branch, around line 308) and replace it with:
  ```typescript
  currentMessages.push({ ...message, content });
  ```

  This ensures the stripped version (not the raw think-tagged version) is what gets fed back into the model's context on subsequent turns.

- [ ] **Step 4: Verify build**

  ```bash
  cd backend && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 5: Run tests**

  ```bash
  cd backend && npx vitest run
  ```
  Expected: no regressions

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/services/baseOpenAIService.ts
  git commit -m "feat: strip <think> tags from reasoning model output before processing and display"
  ```

---

## Phase 2 — Hardening: Tool Output Truncation + Tier-Aware Iteration Budget

### Task 7: Truncate readFile and listFiles output

**Context:** `readFile` returns raw file content with no size limit. A 1,000-line file is ~40KB; on an 8K-token model that saturates the entire usable context. `listFiles` has no entry limit — a directory with node_modules symlinks would return thousands of entries. The truncation messages tell the model *how to recover*, preventing a failure spiral.

**Files:**
- Modify: `backend/src/services/toolService.ts`

- [ ] **Step 1: Add readFile truncation**

  Find the `readFile` method (around line 453). Replace:
  ```typescript
  private async readFile(filePath: string) {
    const fullPath = validatePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    vectorService.addEntry(content.slice(0, 5000), { path: filePath, type: 'file_read' }).catch(console.error);
    return content;
  }
  ```

  With:
  ```typescript
  private async readFile(filePath: string) {
    const fullPath = validatePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    vectorService.addEntry(content.slice(0, 5000), { path: filePath, type: 'file_read' }).catch(console.error);

    const MAX_FILE_CHARS = 8_000;
    if (content.length > MAX_FILE_CHARS) {
      return (
        content.slice(0, MAX_FILE_CHARS) +
        `\n\n[FILE TRUNCATED — ${content.length - MAX_FILE_CHARS} additional characters not shown. ` +
        `Use list_files to check line counts, or read a specific section by requesting a smaller path scope.]`
      );
    }
    return content;
  }
  ```

- [ ] **Step 2: Add listFiles entry cap**

  Find the `listFiles` method (around line 467). Replace:
  ```typescript
  private async listFiles(dirPath: string) {
    const fullPath = validatePath(dirPath);
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    return files.map(f => ({
      name: f.name,
      type: f.isDirectory() ? 'directory' : 'file'
    }));
  }
  ```

  With:
  ```typescript
  private async listFiles(dirPath: string) {
    const fullPath = validatePath(dirPath);
    const files = await fs.readdir(fullPath, { withFileTypes: true });

    const MAX_ENTRIES = 150;
    const visible = files.slice(0, MAX_ENTRIES);
    const result = visible.map(f => ({
      name: f.name,
      type: f.isDirectory() ? 'directory' : 'file',
    }));
    if (files.length > MAX_ENTRIES) {
      result.push({
        name: `[${files.length - MAX_ENTRIES} more entries — use a subdirectory path to narrow results]`,
        type: 'file',
      });
    }
    return result;
  }
  ```

- [ ] **Step 3: Verify build**

  ```bash
  cd backend && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/services/toolService.ts
  git commit -m "feat: cap readFile at 8K chars and listFiles at 150 entries to protect context window"
  ```

---

### Task 8: Tier-aware iteration budget

**Context:** 5 iterations is too low for multi-step coding tasks. A realistic full-agentic flow — `list_files` → `read_file × 2` → `write_file` → `run_shell` — is 5 tool calls, leaving zero margin for any recovery. The `tier` parameter is already threaded into `generateChatCompletionWithEvents`; it just isn't being used for the budget.

**Files:**
- Modify: `backend/src/services/baseOpenAIService.ts`

- [ ] **Step 1: Update maxIterations in generateChatCompletionWithEvents**

  In `generateChatCompletionWithEvents`, find:
  ```typescript
  let iteration = 0;
  const maxIterations = 5;
  ```

  Replace with:
  ```typescript
  let iteration = 0;
  const maxIterations = tier === 'full-agentic' ? 12 : 6;
  ```

- [ ] **Step 2: Update maxIterations in generateChatCompletion**

  In `generateChatCompletion`, find:
  ```typescript
  let iteration = 0;
  const maxIterations = 5;
  ```

  Replace with:
  ```typescript
  let iteration = 0;
  const maxIterations = 8;
  ```

  (This path has no `tier` param; 8 is a safe general default.)

- [ ] **Step 3: Verify build and tests**

  ```bash
  cd backend && npx tsc --noEmit && npx vitest run
  ```
  Expected: no errors, no regressions

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/services/baseOpenAIService.ts
  git commit -m "feat: tier-aware iteration budget — 12 for full-agentic, 6 for code-only"
  ```

---

## Phase 3 — UX/Quality: Chat History Persistence + SPA-Aware System Prompt

### Task 9: Add agent chat persistence helpers to codingSlice

**Context:** `agentMessages` lives in Zustand (in-memory). Page refresh or tool-switch wipes the conversation. The open files already survive via `persistProjectOpenState`/`restoreProjectOpenState`. This task adds the same pattern for chat messages. Tool event results are truncated on save to avoid bloating localStorage with large file reads.

**Files:**
- Modify: `frontend/src/store/codingSlice.ts`

- [ ] **Step 1: Add the persistence helpers after the existing project-state helpers**

  After the `restoreProjectOpenState` function (around line 41), add:

  ```typescript
  const AGENT_CHAT_KEY = 'solvent-agent-chat';
  const MAX_PERSISTED_MESSAGES = 50;

  /** Persists the last N agent messages for a project to localStorage. */
  export function persistAgentMessages(projectKey: string, messages: AgentMessage[]): void {
    if (typeof window === 'undefined') return;
    try {
      const toSave = messages
        .filter(m => !m.isStreaming)
        .slice(-MAX_PERSISTED_MESSAGES)
        .map(m => ({
          ...m,
          toolEvents: m.toolEvents?.map(e => ({
            ...e,
            result:
              typeof e.result === 'string' && e.result.length > 500
                ? e.result.slice(0, 500) + '… [truncated]'
                : e.result,
          })),
        }));
      const all = JSON.parse(localStorage.getItem(AGENT_CHAT_KEY) || '{}');
      all[projectKey] = { messages: toSave, savedAt: Date.now() };
      localStorage.setItem(AGENT_CHAT_KEY, JSON.stringify(all));
    } catch {}
  }

  /** Returns persisted agent messages for a project, or null if none. */
  export function restoreAgentMessages(projectKey: string): AgentMessage[] | null {
    if (typeof window === 'undefined') return null;
    try {
      const all = JSON.parse(localStorage.getItem(AGENT_CHAT_KEY) || '{}');
      return (all[projectKey]?.messages as AgentMessage[]) ?? null;
    } catch {
      return null;
    }
  }
  ```

  Note: `AgentMessage` is defined later in the same file. Move the `AgentMessage` interface above these helpers, or use a forward-reference — in TypeScript, types are hoisted so the `AgentMessage` type annotation in the helpers will resolve correctly even if the interface appears later in the file.

- [ ] **Step 2: Verify build**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/store/codingSlice.ts
  git commit -m "feat: add persistAgentMessages/restoreAgentMessages helpers to codingSlice"
  ```

---

### Task 10: Wire persistence into AgentChatPanel

**Context:** The helpers exist but nothing calls them. This task adds: (1) restore on mount/project-change when the message list is empty, (2) a debounced save whenever `agentMessages` changes.

**Files:**
- Modify: `frontend/src/components/coding/AgentChatPanel.tsx`

- [ ] **Step 1: Add imports**

  At the top of `AgentChatPanel.tsx`, add to the existing `codingSlice` import:
  ```typescript
  import {
    ..., // existing imports
    persistAgentMessages,
    restoreAgentMessages,
  } from '../../store/codingSlice';
  ```

- [ ] **Step 2: Add restore effect**

  Inside the component, after the existing store selector lines, add:

  ```typescript
  const currentProject = useAppStore(s => s.currentProject);

  // Restore persisted messages when opening a project with an empty chat
  useEffect(() => {
    if (!currentProject) return;
    if (agentMessages.length > 0) return; // don't overwrite an active session

    const projectKey = `${currentProject.type}:${currentProject.path}`;
    const saved = restoreAgentMessages(projectKey);
    if (saved && saved.length > 0) {
      clearAgentMessages();
      saved.forEach(m => addAgentMessage(m));
    }
  }, [currentProject?.path]);
  ```

- [ ] **Step 3: Add debounced save effect**

  ```typescript
  // Debounced save — write to localStorage 2s after messages settle
  useEffect(() => {
    if (!currentProject) return;
    if (agentMessages.length === 0) return;

    const projectKey = `${currentProject.type}:${currentProject.path}`;
    const timer = setTimeout(() => {
      persistAgentMessages(projectKey, agentMessages);
    }, 2000);
    return () => clearTimeout(timer);
  }, [agentMessages, currentProject?.path]);
  ```

- [ ] **Step 4: Verify build**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 5: Manual smoke test**

  1. Start the app
  2. Open a project in the coding suite
  3. Send a message to the agent, wait for response
  4. Hard-refresh the page
  5. Navigate back to the coding suite

  Expected: previous conversation is restored

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/components/coding/AgentChatPanel.tsx
  git commit -m "feat: persist and restore agent chat history across page refreshes"
  ```

---

### Task 11: SPA-aware preview workflow in buildSystemPrompt

**Context:** The current 5-step workflow tells the agent to use `fetch_preview_source` to inspect the app. For React/Vue/Svelte apps, that call returns `<div id="root"></div>` — the JS hasn't run. The agent gets an empty skeleton, misidentifies the structure, and starts guessing file paths. The fix: tell the agent that `fetch_preview_source` = raw HTML skeleton, `get_dom_snapshot` = actual rendered DOM, and adjust the workflow accordingly. `get_dom_snapshot` is only available in `full-agentic` tier, so the workflow branches on tier.

**Files:**
- Modify: `frontend/src/components/coding/slashCommands.ts`

- [ ] **Step 1: Replace the preview workflow block in buildSystemPrompt**

  In `buildSystemPrompt`, find the entire `if (previewUrl)` block (lines 49–61) and replace it with:

  ```typescript
  if (previewUrl) {
    parts.push(`\nApp preview URL: ${previewUrl}`);
    parts.push('The app is currently running at this URL.');
    parts.push('IMPORTANT: When the user asks to change, add, or fix something in the app, they are referring to the running preview.');
    parts.push('');
    parts.push('IMPORTANT — Preview rendering:');
    parts.push('This app uses a JavaScript framework (React/Vue/Svelte/etc). `fetch_preview_source` returns the raw HTML skeleton only — the JS has not run yet, so you will typically see an empty root div with no visible content.');

    if (tier === 'full-agentic') {
      parts.push('To inspect the actual rendered UI, use `get_dom_snapshot` — it captures the live DOM after JavaScript has executed.');
      parts.push('');
      parts.push('Workflow for UI changes:');
      parts.push('1. `get_dom_snapshot` — understand the rendered state and component tree');
      parts.push('2. Identify which source file(s) own the relevant component (check the open files list above)');
      parts.push('3. `read_file` — confirm the current implementation');
      parts.push('4. Make the change with `ide_show_diff` or `write_file`');
      parts.push('5. The preview auto-refreshes — verify with `get_dom_snapshot` if needed');
    } else {
      parts.push('');
      parts.push('Workflow for UI changes:');
      parts.push('1. Identify which source file(s) own the relevant component (check the open files list above)');
      parts.push('2. `read_file` — confirm the current implementation');
      parts.push('3. Make the change with `ide_show_diff` or `write_file`');
    }
  }
  ```

- [ ] **Step 2: Verify build**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/components/coding/slashCommands.ts
  git commit -m "feat: SPA-aware preview workflow — use get_dom_snapshot for rendered state, not fetch_preview_source"
  ```

---

## Self-Review

**Spec coverage check:**
- Provider inheritance (Groq, Fireworks, Cerebras, OpenRouter): Tasks 2–5 ✓
- `shouldSkipJsonMode` hook for OpenRouter reasoning models: Task 1 + Task 5 ✓
- Think tag stripping (both completion methods): Task 6 ✓
- `readFile` truncation at 8K chars: Task 7 ✓
- `listFiles` entry cap at 150: Task 7 ✓
- Tier-aware iteration budget (12/6/8): Task 8 ✓
- Chat history persistence helpers: Task 9 ✓
- Chat history restore on mount + save on change: Task 10 ✓
- SPA-aware system prompt (tier-branched workflow): Task 11 ✓

**Placeholder scan:** No TBD, TODO, or "similar to" references. All code blocks are complete. ✓

**Type consistency:**
- `AgentMessage` used in Tasks 9–10: defined in `codingSlice.ts` — same file as the helpers ✓
- `ProviderHealth` imported from `../../types/plugins` in all four provider rewrites ✓
- `BaseOpenAIService` imported consistently from `../../services/baseOpenAIService` ✓
- `tier` param in `generateChatCompletionWithEvents` already typed as `'full-agentic' | 'code-only'` — `maxIterations` ternary matches ✓
