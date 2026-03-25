import { StateCreator } from 'zustand';
import { AppState } from './types';

// --- Tool Event Types (mirror backend AgentEvent types) ---

export interface ToolEvent {
  type: 'tool_start' | 'tool_result' | 'tool_error';
  tool: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  iteration: number;
  callId: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileContext?: string;
  codeBlocks?: CodeSuggestion[];
  toolEvents?: ToolEvent[];
  isStreaming?: boolean;
}

export interface CodeSuggestion {
  id: string;
  language: string;
  code: string;
  applied: boolean;
  rejected: boolean;
}

export interface PendingDiff {
  original: string;
  modified: string;
  filePath: string;
  description: string;
}

export interface CodingSlice {
  pendingDiff: PendingDiff | null;
  agentMessages: AgentMessage[];
  panelWidths: { fileTree: number; chat: number };
  fileTreeVisible: boolean;
  chatPanelVisible: boolean;
  terminalVisible: boolean;

  // Terminal lines (shared across CodingArea + agent)
  terminalLines: string[];
  addTerminalLine: (line: string) => void;
  clearTerminalLines: () => void;

  // File tree refresh trigger (incremented to signal a refresh)
  fileTreeRefreshTrigger: number;
  triggerFileTreeRefresh: () => void;

  setPendingDiff: (diff: PendingDiff) => void;
  clearPendingDiff: () => void;
  addAgentMessage: (msg: AgentMessage) => void;
  updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void;
  appendToolEvent: (msgId: string, event: ToolEvent) => void;
  clearAgentMessages: () => void;
  setPanelWidths: (widths: { fileTree: number; chat: number }) => void;
  setFileTreeVisible: (v: boolean) => void;
  setChatPanelVisible: (v: boolean) => void;
  setTerminalVisible: (v: boolean) => void;
}

const MAX_TERMINAL_LINES = 1000;

export const createCodingSlice: StateCreator<AppState, [], [], CodingSlice> = (set) => ({
  pendingDiff: null,
  agentMessages: [],
  panelWidths: { fileTree: 240, chat: 360 },
  fileTreeVisible: true,
  chatPanelVisible: true,
  terminalVisible: false,

  terminalLines: ['[SYSTEM]: Agentic IDE Core Initialized.'],
  addTerminalLine: (line) => set((state) => {
    const lines = [...state.terminalLines, line];
    if (lines.length > MAX_TERMINAL_LINES) {
      return { terminalLines: lines.slice(-MAX_TERMINAL_LINES) };
    }
    return { terminalLines: lines };
  }),
  clearTerminalLines: () => set({ terminalLines: [] }),

  fileTreeRefreshTrigger: 0,
  triggerFileTreeRefresh: () => set((state) => ({ fileTreeRefreshTrigger: state.fileTreeRefreshTrigger + 1 })),

  setPendingDiff: (diff) => set({ pendingDiff: diff }),
  clearPendingDiff: () => set({ pendingDiff: null }),
  addAgentMessage: (msg) => set((state) => ({ agentMessages: [...state.agentMessages, msg] })),
  updateAgentMessage: (id, updates) =>
    set((state) => ({
      agentMessages: state.agentMessages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  appendToolEvent: (msgId, event) =>
    set((state) => ({
      agentMessages: state.agentMessages.map((m) =>
        m.id === msgId ? { ...m, toolEvents: [...(m.toolEvents ?? []), event] } : m
      ),
    })),
  clearAgentMessages: () => set({ agentMessages: [] }),
  setPanelWidths: (panelWidths) => set({ panelWidths }),
  setFileTreeVisible: (fileTreeVisible) => set({ fileTreeVisible }),
  setChatPanelVisible: (chatPanelVisible) => set({ chatPanelVisible }),
  setTerminalVisible: (terminalVisible) => set({ terminalVisible }),
});
