import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Play, Cpu, Loader2, Box, Globe, X } from 'lucide-react';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { fetchWithRetry, getSecret } from '../lib/api-client';
import { BASE_URL } from '../lib/config';
import { FileTreePanel } from './coding/FileTreePanel';
import { EditorTabBar } from './coding/EditorTabBar';
import { CodingTerminal } from './coding/CodingTerminal';
import { AgentChatPanel } from './coding/AgentChatPanel';
import { DiffBanner } from './coding/DiffBanner';
import { InlineAIToolbar } from './coding/InlineAIToolbar';
import { ReviewScorecard } from './ReviewScorecard';
import {
  getOrBootWebContainer,
  getWebContainerInstance,
  setWebContainerInstance,
  clearBootPromise,
} from '../lib/webContainerBridge';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif']);

function isImageFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.json': 'json', '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.md': 'markdown', '.py': 'python', '.rs': 'rust', '.go': 'go', '.yaml': 'yaml',
  '.yml': 'yaml', '.toml': 'toml', '.xml': 'xml', '.sql': 'sql', '.sh': 'shell',
  '.bash': 'shell', '.zsh': 'shell', '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.java': 'java', '.kt': 'kotlin', '.swift': 'swift', '.rb': 'ruby', '.php': 'php',
  '.lua': 'lua', '.r': 'r', '.dockerfile': 'dockerfile', '.graphql': 'graphql',
};

function getLang(filePath: string): string {
  const base = filePath.split('/').pop() ?? '';
  if (base === 'Dockerfile') return 'dockerfile';
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return EXT_TO_LANG[ext] ?? 'plaintext';
}

export const CodingArea = () => {
  const {
    openFiles, setOpenFiles, activeFile, setActiveFile,
    pendingDiff, clearPendingDiff,
    fileTreeVisible, chatPanelVisible, terminalVisible,
    setFileTreeVisible, setChatPanelVisible, setTerminalVisible,
    panelWidths,
    terminalLines, addTerminalLine, clearTerminalLines,
  } = useAppStore();
  const [bootStatus, setBootStatus] = useState<'idle' | 'booting' | 'ready' | 'error'>('idle');
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<unknown>(null);
  const [isApplying, setIsApplying] = useState(false);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Fix 1: ref-based boot guard for stable callback identity
  const isBootingRef = useRef(false);

  // Fix 2: ref to track the running WebContainer process
  const runningProcRef = useRef<WebContainerProcess | null>(null);

  // Restore singleton if it was already booted before this mount
  useEffect(() => {
    const existing = getWebContainerInstance();
    if (existing && !webContainer) {
      setWebContainer(existing);
      setBootStatus('ready');
      addLog('[SYSTEM]: Reconnected to existing WebContainer sandbox.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentFile = openFiles.find((f) => f.path === activeFile);

  // ── WebContainer ───────────────────────────────────────────────────────────

  const addLog = useCallback((line: string) =>
    addTerminalLine(line), [addTerminalLine]);

  const bootWebContainer = useCallback(async () => {
    if (isBootingRef.current) return;
    isBootingRef.current = true;
    setBootStatus('booting');

    // Pre-flight check
    if (!crossOriginIsolated) {
      addLog('[ERROR]: Page is not cross-origin isolated — SharedArrayBuffer unavailable.');
      addLog('[ERROR]: Ensure COOP/COEP headers are set. Sandbox cannot start.');
      setBootStatus('error');
      isBootingRef.current = false;
      return;
    }

    addLog('[SYSTEM]: Initiating WebContainer virtualization...');
    try {
      const instance = await Promise.race([
        getOrBootWebContainer(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('WebContainer boot timed out after 30s')), 30_000)
        ),
      ]);
      setWebContainerInstance(instance);
      setWebContainer(instance);
      setBootStatus('ready');
      addLog('[SYSTEM]: WebContainer sandbox is ready.');
      instance.on('server-ready', (_port, url) => {
        setIframeUrl(url);
        setShowPreview(true);
      });
      instance.on('error', (err: { message: string }) => addLog(`[WC-ERROR]: ${err.message}`));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Boot failed';
      addLog(`[ERROR]: ${msg}`);
      setBootStatus('error');
      isBootingRef.current = false;
      // Clear broken promise so retry can attempt fresh boot
      clearBootPromise();
    }
  }, [addLog]);

  useEffect(() => {
    if (!webContainer || openFiles.length === 0) return;
    const tree: Record<string, unknown> = {};
    for (const file of openFiles) {
      const parts = file.path.split('/');
      let cur = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(cur[parts[i]] as Record<string, unknown>)) {
          cur[parts[i]] = { directory: {} };
        }
        cur = (cur[parts[i]] as { directory: Record<string, unknown> }).directory;
      }
      cur[parts[parts.length - 1]] = { file: { contents: file.content } };
    }
    webContainer.mount(tree as Parameters<typeof webContainer.mount>[0]);
  }, [webContainer, openFiles]);

  // Fix 2: kill running process on unmount
  useEffect(() => {
    return () => {
      runningProcRef.current?.kill();
    };
  }, []);


  // ── File operations ────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (path: string) => {
    if (openFiles.find((f) => f.path === path)) { setActiveFile(path); return; }
    if (isImageFile(path)) {
      try {
        const secret = await getSecret();
        const res = await fetch(`${BASE_URL}/api/files/raw?path=${encodeURIComponent(path)}`, {
          headers: { 'X-Solvent-Secret': secret },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setOpenFiles([...openFiles, { path, content: blobUrl }]);
        setActiveFile(path);
      } catch {
        addLog(`[ERROR]: Could not load image ${path}`);
      }
      return;
    }
    try {
      const data = await fetchWithRetry(`${BASE_URL}/api/files/read?path=${encodeURIComponent(path)}`) as Record<string, string>;
      setOpenFiles([...openFiles, { path, content: data.content }]);
      setActiveFile(path);
    } catch { addLog(`[ERROR]: Could not open ${path}`); }
  }, [openFiles, setOpenFiles, setActiveFile, addLog]);

  const closeFile = useCallback((path: string) => {
    const closing = openFiles.find((f) => f.path === path);
    if (closing && isImageFile(path) && closing.content.startsWith('blob:')) {
      URL.revokeObjectURL(closing.content);
    }
    const next = openFiles.filter((f) => f.path !== path);
    setOpenFiles(next);
    if (activeFile === path) setActiveFile(next.length > 0 ? next[next.length - 1].path : null);
  }, [openFiles, activeFile, setOpenFiles, setActiveFile]);

  const handleSave = useCallback(async () => {
    if (!activeFile || !currentFile) return;
    try {
      await fetchWithRetry(`${BASE_URL}/api/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile, content: currentFile.content }),
      });
      addLog(`[SYSTEM]: Saved ${activeFile}`);
    } catch { addLog(`[ERROR]: Save failed for ${activeFile}`); }
  }, [activeFile, currentFile, addLog]);

  // Fix 2 applied: kill existing process before spawning a new one; store proc ref
  const handleRun = useCallback(async () => {
    setTerminalVisible(true);

    // Kill any existing process before starting a new one
    if (runningProcRef.current) {
      runningProcRef.current.kill();
      runningProcRef.current = null;
    }

    if (!webContainer) {
      if (!activeFile) return;
      try {
        const data = await fetchWithRetry(`${BASE_URL}/api/files/shell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `node ${activeFile}` }),
        }) as Record<string, string>;
        if (data.stdout) addLog(data.stdout);
        if (data.stderr) addLog(`[STDERR]: ${data.stderr}`);
      } catch { addLog('[ERROR]: Execution failed.'); }
      return;
    }
    setIsRunning(true);
    addLog('[SYSTEM]: Starting execution...');
    try {
      const pkgFile = openFiles.find((f) => f.path.endsWith('package.json'));
      if (pkgFile) {
        const proc = await webContainer.spawn('npm', ['install']);
        runningProcRef.current = proc;
        proc.output.pipeTo(new WritableStream({ write: (d) => addLog(d) }));
        if (await proc.exit !== 0) throw new Error('npm install failed');
      }
      const proc = await webContainer.spawn('node', [activeFile || 'index.js']);
      runningProcRef.current = proc;
      proc.output.pipeTo(new WritableStream({ write: (d) => addLog(d) }));
    } catch (err: unknown) {
      addLog(`[ERROR]: ${err instanceof Error ? err.message : 'Run failed'}`);
    } finally {
      setIsRunning(false);
    }
  }, [webContainer, activeFile, openFiles, addLog, setTerminalVisible]);

  // ── Diff Apply/Reject ──────────────────────────────────────────────────────

  const handleApplyAll = useCallback(() => {
    if (!pendingDiff) return;
    setIsApplying(true);
    const updated = openFiles.map((f) =>
      f.path === pendingDiff.filePath ? { ...f, content: pendingDiff.modified } : f
    );
    setOpenFiles(updated);
    clearPendingDiff();
    setTimeout(() => setIsApplying(false), 600);
  }, [pendingDiff, openFiles, setOpenFiles, clearPendingDiff]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'b') { e.preventDefault(); setFileTreeVisible(!fileTreeVisible); }
      if (mod && e.key === 'j') { e.preventDefault(); setTerminalVisible(!terminalVisible); }
      if (mod && e.shiftKey && e.key === 'I') { e.preventDefault(); setChatPanelVisible(!chatPanelVisible); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fileTreeVisible, terminalVisible, chatPanelVisible, setFileTreeVisible, setTerminalVisible, setChatPanelVisible]);

  // ── Monaco ──────────────────────────────────────────────────────────────────

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleInlineCommand = useCallback((command: string, selection: string) => {
    addLog(`[AI]: ${command} on "${selection.slice(0, 60)}…"`);
  }, [addLog]);

  // ── ReviewScorecard helper ─────────────────────────────────────────────────

  type ReviewStatus = 'analyzing' | 'approved' | 'rejected';
  interface ReviewBreakdown { syntax: number; security: number; logic: number; efficiency: number; }

  const getReviewScorecard = (): React.ReactNode => {
    if (!reviewState) return null;
    const rs = reviewState as Record<string, unknown>;
    const bd = rs.breakdown as ReviewBreakdown;
    const status = rs.status as ReviewStatus;
    return (
      <ReviewScorecard
        score={rs.score as number}
        breakdown={bd}
        issues={rs.issues as string[]}
        status={status}
        attempt={rs.attempt as number}
      />
    );
  };

  // suppress unused warning — isApplying is used for future animation states
  void isApplying;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden bg-[#020205] text-slate-300">
      {/* ── Left: File Tree ─────────────────────────────────────────── */}
      {fileTreeVisible && (
        <div
          className="shrink-0 border-r border-white/[0.04] overflow-hidden"
          style={{ width: panelWidths.fileTree }}
        >
          <FileTreePanel onFileSelect={handleFileSelect} />
        </div>
      )}

      {/* ── Center: Editor + Terminal ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="h-11 flex items-center px-4 gap-3 border-b border-white/[0.04] shrink-0">
          <button
            type="button"
            onClick={() => setFileTreeVisible(!fileTreeVisible)}
            className={cn('p-1.5 rounded-lg transition-colors', fileTreeVisible ? 'text-jb-accent bg-jb-accent/10' : 'text-white/30 hover:text-white/60')}
            title="Toggle file tree (⌘B)"
            aria-label="Toggle file tree"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="18" /><rect x="14" y="3" width="7" height="18" /></svg>
          </button>

          <div className="flex-1" />

          {/* Sandbox toggle */}
          {bootStatus === 'idle' && (
            <button
              type="button"
              onClick={bootWebContainer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-500/5 text-orange-400 text-[10px] font-bold hover:bg-orange-500/10 transition-colors"
            >
              <Box size={12} aria-hidden="true" /> Sandbox
            </button>
          )}
          {bootStatus === 'booting' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-orange-400/60 text-[10px] font-bold">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Booting…
            </div>
          )}
          {bootStatus === 'ready' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-[10px] font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Sandbox Active
            </div>
          )}
          {bootStatus === 'error' && (
            <button
              type="button"
              onClick={() => { isBootingRef.current = false; bootWebContainer(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 text-rose-400 text-[10px] font-bold hover:bg-rose-500/10 transition-colors"
            >
              <Box size={12} aria-hidden="true" /> Retry Sandbox
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!activeFile}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 disabled:opacity-20"
            aria-label="Save file"
          >
            {/* Fix 3: icon is decorative; button has aria-label */}
            <Save size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="p-1.5 rounded-lg text-jb-accent hover:bg-jb-accent/10 transition-colors disabled:opacity-40"
            aria-label="Run"
          >
            {/* Fix 3: icon is decorative; button has aria-label */}
            <Play size={15} fill="currentColor" fillOpacity={0.3} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setChatPanelVisible(!chatPanelVisible)}
            className={cn('p-1.5 rounded-lg transition-colors', chatPanelVisible ? 'text-jb-accent bg-jb-accent/10' : 'text-white/30 hover:text-white/60')}
            title="Toggle agent chat (⌘⇧I)"
            aria-label="Toggle agent chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </button>
        </div>

        {/* Tab bar */}
        <EditorTabBar
          openFiles={openFiles}
          activeFile={activeFile}
          onTabClick={setActiveFile}
          onTabClose={closeFile}
        />

        {/* Diff banner */}
        {pendingDiff && (
          <DiffBanner
            description={pendingDiff.description}
            onApplyAll={handleApplyAll}
            onReject={clearPendingDiff}
          />
        )}

        {/* Editor — plain textarea with line numbers, native browser scroll */}
        {pendingDiff ? (
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 flex">
              <div className="flex-1 overflow-auto p-4 border-r border-white/[0.06]">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">Original</div>
                <pre className="font-mono text-[13px] text-slate-400 whitespace-pre leading-[1.6]">{pendingDiff.original}</pre>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">Modified</div>
                <pre className="font-mono text-[13px] text-slate-300 whitespace-pre leading-[1.6]">{pendingDiff.modified}</pre>
              </div>
            </div>
          </div>
        ) : currentFile && isImageFile(currentFile.path) ? (
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 overflow-auto flex items-center justify-center bg-[#0a0a12] p-8">
              <img
                src={currentFile.content}
                alt={currentFile.path}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        ) : currentFile ? (
          <div ref={editorContainerRef} className="flex-1 min-h-0 relative overflow-hidden">
            <div className="absolute inset-0">
              <Editor
                theme="vs-dark"
                language={getLang(currentFile.path)}
                value={currentFile.content}
                path={currentFile.path}
                onChange={(value) =>
                  setOpenFiles(openFiles.map((f) =>
                    f.path === activeFile ? { ...f, content: value ?? '' } : f
                  ))
                }
                onMount={handleEditorMount}
                options={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  padding: { top: 16 },
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  renderLineHighlight: 'gutter',
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'off',
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  bracketPairColorization: { enabled: true },
                  scrollbar: {
                    alwaysConsumeMouseWheel: true,
                  },
                }}
              />
            </div>
            <InlineAIToolbar
              editorRef={editorRef}
              containerRef={editorContainerRef as React.RefObject<HTMLDivElement>}
              onCommand={handleInlineCommand}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center opacity-10 gap-4">
            <Cpu size={48} strokeWidth={1} aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Open a file to begin</span>
          </div>
        )}

        {/* Terminal (collapsible) */}
        {terminalVisible && (
          <CodingTerminal
            lines={terminalLines}
            onClear={clearTerminalLines}
          />
        )}

        {/* Terminal toggle pill — Fix 3: aria-label + sr-only error span */}
        {!terminalVisible && (
          <button
            type="button"
            onClick={() => setTerminalVisible(true)}
            aria-label="Show terminal"
            className="mx-4 mb-2 mt-1 flex items-center gap-2 px-3 py-1 rounded-lg border border-white/[0.04] text-white/20 hover:text-white/50 text-[10px] font-mono hover:bg-white/5 transition-colors shrink-0"
          >
            <span>▸ CONSOLE</span>
            {terminalLines.some((l) => l.startsWith('[ERROR]')) && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                <span className="sr-only">Errors present</span>
              </>
            )}
          </button>
        )}

        {/* Preview panel */}
        <AnimatePresence>
          {showPreview && iframeUrl && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: '40%', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/[0.04] flex flex-col bg-white overflow-clip shrink-0"
            >
              <div className="h-8 bg-slate-100 flex items-center px-3 gap-2 shrink-0">
                <Globe size={12} className="text-slate-400" aria-hidden="true" />
                <span className="text-[10px] font-mono text-slate-500 flex-1 truncate">{iframeUrl}</span>
                <button type="button" onClick={() => setShowPreview(false)} aria-label="Close preview">
                  <X size={14} className="text-slate-400 cursor-pointer" aria-hidden="true" />
                </button>
              </div>
              <iframe src={iframeUrl} className="flex-1 border-none" title="Preview" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right: Agent Chat ───────────────────────────────────────── */}
      {chatPanelVisible && (
        <div
          className="shrink-0 border-l border-white/[0.04] overflow-clip"
          style={{ width: panelWidths.chat }}
        >
          <AgentChatPanel />
        </div>
      )}

      {/* Review scorecard overlay */}
      <AnimatePresence>
        {Boolean(reviewState) && getReviewScorecard()}
      </AnimatePresence>
    </div>
  );
};
