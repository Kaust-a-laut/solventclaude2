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
const PROJECT_STATE_KEY = 'solvent-project-open-state';
const MAX_HISTORY = 10;

/** Persists which files were open for a project (paths only — content lives on the backend). */
export function persistProjectOpenState(
  projectKey: string,
  openFilePaths: string[],
  activeFile: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    const all = JSON.parse(localStorage.getItem(PROJECT_STATE_KEY) || '{}');
    all[projectKey] = { openFilePaths, activeFile, savedAt: Date.now() };
    localStorage.setItem(PROJECT_STATE_KEY, JSON.stringify(all));
  } catch {}
}

/** Returns the last-saved open file list for a project, or null if none. */
export function restoreProjectOpenState(
  projectKey: string
): { openFilePaths: string[]; activeFile: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const all = JSON.parse(localStorage.getItem(PROJECT_STATE_KEY) || '{}');
    return (all[projectKey] as { openFilePaths: string[]; activeFile: string | null }) ?? null;
  } catch { return null; }
}

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

// --- File Tree Node (shared between CodingSlice and FileTreePanel) ---

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
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

// --- Preview Runtime State Types (Phase 2) ---

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

  // File tree state (persisted across remounts)
  fileTreeNodes: FileNode[];
  fileTreeExpanded: Record<string, boolean>;
  fileTreeLoading: boolean;
  setFileTreeNodes: (nodes: FileNode[]) => void;
  setFileTreeExpanded: (expanded: Record<string, boolean>) => void;
  setFileTreeLoading: (loading: boolean) => void;
  toggleFileTreeFolder: (path: string) => void;

  // File tree refresh trigger (incremented to signal a refresh)
  fileTreeRefreshTrigger: number;
  triggerFileTreeRefresh: () => void;

  // Preview URL (the WebContainer server-ready URL) — shared so AgentChatPanel can read it
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  // Latest HTML snapshot of the preview, manually captured by user
  previewSnapshot: string | null;
  setPreviewSnapshot: (snapshot: string | null) => void;

  // Preview runtime state (Phase 2)
  previewConsoleBuffer: ConsoleEntry[];      // ring buffer, max 200
  previewBodyHash: string | null;
  previewBodyHTML: string | null;
  previewDomChanged: boolean;
  previewSelectedElement: ElementInfo | null;
  previewScreenshotUrl: string | null;

  appendConsoleEntry: (entry: ConsoleEntry) => void;
  updatePreviewDom: (data: { hash: string; bodyHTML: string }) => void;
  setSelectedElement: (element: ElementInfo | null) => void;
  setPreviewScreenshotUrl: (url: string | null) => void;
  resetDomChanged: () => void;

  // Preferred code-tier model for delegation
  preferredCodeModel: string | null;
  setPreferredCodeModel: (model: string) => void;

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

export const createCodingSlice: StateCreator<AppState, [], [], CodingSlice> = (set) => {
  const MAX_CONSOLE_BUFFER = 200;

  return ({
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

  fileTreeNodes: [],
  fileTreeExpanded: {},
  fileTreeLoading: false,
  setFileTreeNodes: (fileTreeNodes) => set({ fileTreeNodes }),
  setFileTreeExpanded: (fileTreeExpanded) => set({ fileTreeExpanded }),
  setFileTreeLoading: (fileTreeLoading) => set({ fileTreeLoading }),
  toggleFileTreeFolder: (path) => set((state) => ({
    fileTreeExpanded: { ...state.fileTreeExpanded, [path]: !state.fileTreeExpanded[path] },
  })),

  fileTreeRefreshTrigger: 0,
  triggerFileTreeRefresh: () => set((state) => ({ fileTreeRefreshTrigger: state.fileTreeRefreshTrigger + 1 })),

  previewUrl: null,
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  previewSnapshot: null,
  setPreviewSnapshot: (previewSnapshot) => set({ previewSnapshot }),

  previewConsoleBuffer: [],
  previewBodyHash: null,
  previewBodyHTML: null,
  previewDomChanged: false,
  previewSelectedElement: null,
  previewScreenshotUrl: null,

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

  preferredCodeModel: null,
  setPreferredCodeModel: (preferredCodeModel) => set({ preferredCodeModel }),

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
    set({ currentProject: null, openFiles: [], activeFile: null, fileTreeNodes: [], fileTreeExpanded: {} });
  },
  });
};
