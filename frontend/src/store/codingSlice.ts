import { StateCreator } from 'zustand';
import { AppState } from './types';

// --- Project Management Types ---

export interface ProjectInfo {
  name: string;
  path: string;
  type: 'scratchpad' | 'folder';
  createdAt: number;
  lastOpenedAt: number;
}

const PROJECT_HISTORY_KEY = 'solvent-project-history';
const MAX_HISTORY = 10;

const savedHistory = typeof window !== 'undefined'
  ? (() => {
      try {
        return JSON.parse(localStorage.getItem(PROJECT_HISTORY_KEY) || '[]');
      } catch {
        return [];
      }
    })()
  : [];

function persistHistory(history: ProjectInfo[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PROJECT_HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }
}

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
  currentProject: ProjectInfo | null;
  projectHistory: ProjectInfo[];

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
  createNewProject: (name: string) => void;
  openProject: (name: string) => void;
  openFolder: (path: string) => void;
  closeProject: () => void;
}

const MAX_TERMINAL_LINES = 1000;

export const createCodingSlice: StateCreator<AppState, [], [], CodingSlice> = (set) => ({
  pendingDiff: null,
  agentMessages: [],
  panelWidths: { fileTree: 240, chat: 360 },
  fileTreeVisible: true,
  chatPanelVisible: true,
  terminalVisible: false,
  currentProject: null,
  projectHistory: savedHistory,

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

  createNewProject: (name) => {
    const now = Date.now();
    const newProject: ProjectInfo = {
      name,
      path: `projects/${name}`,
      type: 'scratchpad',
      createdAt: now,
      lastOpenedAt: now,
    };
    set((state) => {
      const filtered = state.projectHistory.filter((p) => p.name !== name);
      const updated = [newProject, ...filtered].slice(0, MAX_HISTORY);
      persistHistory(updated);
      return { currentProject: newProject, projectHistory: updated };
    });
  },

  openProject: (name) => {
    set((state) => {
      const now = Date.now();
      const existing = state.projectHistory.find((p) => p.name === name);
      let project: ProjectInfo;
      if (existing) {
        project = { ...existing, lastOpenedAt: now };
        const filtered = state.projectHistory.filter((p) => p.name !== name);
        const updated = [project, ...filtered].slice(0, MAX_HISTORY);
        persistHistory(updated);
        return { currentProject: project, projectHistory: updated };
      } else {
        project = {
          name,
          path: `projects/${name}`,
          type: 'scratchpad',
          createdAt: now,
          lastOpenedAt: now,
        };
        const updated = [project, ...state.projectHistory].slice(0, MAX_HISTORY);
        persistHistory(updated);
        return { currentProject: project, projectHistory: updated };
      }
    });
  },

  openFolder: (path) => {
    const now = Date.now();
    const pathParts = path.split('/');
    const name = pathParts[pathParts.length - 1] || path;
    const newProject: ProjectInfo = {
      name,
      path,
      type: 'folder',
      createdAt: now,
      lastOpenedAt: now,
    };
    set((state) => {
      const filtered = state.projectHistory.filter((p) => p.path !== path);
      const updated = [newProject, ...filtered].slice(0, MAX_HISTORY);
      persistHistory(updated);
      return { currentProject: newProject, projectHistory: updated };
    });
  },

  closeProject: () => {
    set({ currentProject: null, openFiles: [], activeFile: null });
  },
});
