import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { fetchWithRetry, getSecret } from '../lib/api-client';
import { BASE_URL } from '../lib/config';
import { FileTreePanel } from './coding/FileTreePanel';
import { EditorTabBar } from './coding/EditorTabBar';
import { CodingTerminal } from './coding/CodingTerminal';
import { AgentChatPanel } from './coding/AgentChatPanel';
import { DiffBanner } from './coding/DiffBanner';
import { ReviewScorecard } from './ReviewScorecard';
import {
  getOrBootWebContainer,
  getWebContainerInstance,
  setWebContainerInstance,
  clearBootPromise,
} from '../lib/webContainerBridge';
import { isImageFile } from './coding/editorUtils';
import { EditorToolbar } from './coding/EditorToolbar';
import { EditorContent } from './coding/EditorContent';
import { PreviewPanel } from './coding/PreviewPanel';

export const CodingArea = () => {
  const {
    openFiles, setOpenFiles, activeFile, setActiveFile,
    pendingDiff, clearPendingDiff,
    fileTreeVisible, chatPanelVisible, terminalVisible,
    setFileTreeVisible, setChatPanelVisible, setTerminalVisible,
    panelWidths,
    terminalLines, addTerminalLine, clearTerminalLines,
    activeTier,
    currentProject, createNewProject, openFolder,
  } = useAppStore(
    useShallow((state) => ({
      openFiles: state.openFiles,
      setOpenFiles: state.setOpenFiles,
      activeFile: state.activeFile,
      setActiveFile: state.setActiveFile,
      pendingDiff: state.pendingDiff,
      clearPendingDiff: state.clearPendingDiff,
      fileTreeVisible: state.fileTreeVisible,
      chatPanelVisible: state.chatPanelVisible,
      terminalVisible: state.terminalVisible,
      setFileTreeVisible: state.setFileTreeVisible,
      setChatPanelVisible: state.setChatPanelVisible,
      setTerminalVisible: state.setTerminalVisible,
      panelWidths: state.panelWidths,
      terminalLines: state.terminalLines,
      addTerminalLine: state.addTerminalLine,
      clearTerminalLines: state.clearTerminalLines,
      activeTier: state.activeTier,
      currentProject: state.currentProject,
      createNewProject: state.createNewProject,
      openFolder: state.openFolder,
    }))
  );
  const [editorVisible, setEditorVisible] = useState(true);
  const [bootStatus, setBootStatus] = useState<'idle' | 'booting' | 'ready' | 'error'>('idle');
  const [bootRequested, setBootRequested] = useState(false);
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<unknown>(null);
  const [isApplying, setIsApplying] = useState(false);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const isBootingRef = useRef(false);
  const runningProcRef = useRef<WebContainerProcess | null>(null);
  const currentFile = openFiles.find((f) => f.path === activeFile);

  const addLog = useCallback((line: string) => addTerminalLine(line), [addTerminalLine]);

  // Restore singleton if already booted before this mount
  useEffect(() => {
    const existing = getWebContainerInstance();
    if (existing && !webContainer) { setWebContainer(existing); setBootStatus('ready'); addLog('[SYSTEM]: Reconnected to existing WebContainer sandbox.'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Deferred boot: only boot WebContainer when explicitly requested
  useEffect(() => {
    if (bootRequested && bootStatus === 'idle') {
      bootWebContainer();
    }
  }, [bootRequested, bootStatus, bootWebContainer]);

  useEffect(() => {
    if (!webContainer || openFiles.length === 0) return;
    const tree: Record<string, unknown> = {};
    for (const file of openFiles) {
      const parts = file.path.split('/');
      let cur = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part === undefined) continue;
        if (!(cur[part] as Record<string, unknown>)) cur[part] = { directory: {} };
        cur = (cur[part] as { directory: Record<string, unknown> }).directory;
      }
      const lastPart = parts[parts.length - 1];
      if (lastPart !== undefined) cur[lastPart] = { file: { contents: file.content } };
    }
    webContainer.mount(tree as Parameters<typeof webContainer.mount>[0]);
  }, [webContainer, openFiles]);

  useEffect(() => { return () => { runningProcRef.current?.kill(); }; }, []);


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
      setOpenFiles([...openFiles, { path, content: data.content ?? '' }]);
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
    if (activeFile === path) setActiveFile(next.length > 0 ? (next[next.length - 1]?.path ?? null) : null);
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

  // Syncs all backend project files into the WebContainer so the user never has
  // to manually re-import after a page refresh.
  const syncProjectToWebContainer = useCallback(async (wc: WebContainer) => {
    if (!currentProject) return;
    addLog('[SYSTEM]: Syncing project files to sandbox...');

    type FNode = { name: string; type: 'file' | 'directory'; path: string; children?: FNode[] };
    const listUrl = currentProject.type === 'scratchpad'
      ? `${BASE_URL}/api/files/list?project=${encodeURIComponent(currentProject.name)}`
      : `${BASE_URL}/api/files/list?path=.`;

    const nodes = await fetchWithRetry(listUrl) as FNode[];

    const filePaths: string[] = [];
    const flatten = (ns: FNode[]) => {
      for (const n of ns) {
        if (n.type === 'file') filePaths.push(n.path);
        if (n.children) flatten(n.children);
      }
    };
    flatten(nodes);
    if (filePaths.length === 0) return;

    const tree: Record<string, unknown> = {};
    const buildTree = (wcPath: string, content: string) => {
      const parts = wcPath.split('/').filter(Boolean);
      let cur = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (!cur[part]) cur[part] = { directory: {} };
        cur = (cur[part] as { directory: Record<string, unknown> }).directory;
      }
      const last = parts[parts.length - 1];
      if (last) cur[last] = { file: { contents: content } };
    };

    // Read files in batches of 10 to avoid overwhelming the backend
    const BATCH = 10;
    let synced = 0;
    for (let i = 0; i < filePaths.length; i += BATCH) {
      await Promise.allSettled(
        filePaths.slice(i, i + BATCH).map(async (filePath) => {
          try {
            const data = await fetchWithRetry(
              `${BASE_URL}/api/files/read?path=${encodeURIComponent(filePath)}`
            ) as { content: string };
            // Strip project-name prefix — WebContainer root = project root
            const wcPath = currentProject.type === 'scratchpad' && currentProject.name
              ? filePath.slice(currentProject.name.length + 1)
              : filePath;
            if (wcPath) { buildTree(wcPath, data.content ?? ''); synced++; }
          } catch { /* skip unreadable files (binaries, etc.) */ }
        })
      );
    }

    await wc.mount(tree as Parameters<typeof wc.mount>[0]);
    addLog(`[SYSTEM]: Synced ${synced} project files to sandbox.`);
  }, [currentProject, addLog]);

  const handleRun = useCallback(async () => {
    setTerminalVisible(true);
    if (bootStatus === 'idle') setBootRequested(true);
    if (runningProcRef.current) { runningProcRef.current.kill(); runningProcRef.current = null; }
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
      // Sync all backend project files so the user never has to re-import after a refresh
      await syncProjectToWebContainer(webContainer);

      // Find package.json — check open tabs first, then fall back to reading from backend.
      // After a refresh openFiles is empty so the backend fetch ensures we still detect it.
      let pkgContent: string | null =
        openFiles.find((f) => f.path.endsWith('package.json'))?.content ?? null;
      if (!pkgContent && currentProject) {
        const pkgPath = currentProject.type === 'scratchpad'
          ? `${currentProject.name}/package.json`
          : 'package.json';
        try {
          const d = await fetchWithRetry(
            `${BASE_URL}/api/files/read?path=${encodeURIComponent(pkgPath)}`
          ) as { content: string };
          pkgContent = d.content;
        } catch { /* no package.json in this project */ }
      }

      if (pkgContent) {
        const installProc = await webContainer.spawn('npm', ['install']);
        runningProcRef.current = installProc;
        installProc.output.pipeTo(new WritableStream({ write: (d) => addLog(d) }));
        if (await installProc.exit !== 0) throw new Error('npm install failed');

        // Pick the right npm script: prefer 'dev', fall back to 'start'
        let runScript = 'start';
        try {
          const pkg = JSON.parse(pkgContent) as { scripts?: Record<string, string> };
          if (pkg.scripts?.dev) runScript = 'dev';
          else if (!pkg.scripts?.start) throw new Error('No dev or start script in package.json');
        } catch (e: unknown) {
          if (e instanceof Error && e.message.includes('No dev or start script')) throw e;
          // malformed package.json — fall through with 'start'
        }

        addLog(`[SYSTEM]: Running npm run ${runScript}...`);
        const devProc = await webContainer.spawn('npm', ['run', runScript]);
        runningProcRef.current = devProc;
        devProc.output.pipeTo(new WritableStream({ write: (d) => addLog(d) }));
        // Don't await exit — server runs indefinitely; server-ready event sets the preview URL
      } else {
        // No package.json — run as a plain Node script
        if (!activeFile) { addLog('[ERROR]: No file selected to run.'); return; }
        const proc = await webContainer.spawn('node', [activeFile]);
        runningProcRef.current = proc;
        proc.output.pipeTo(new WritableStream({ write: (d) => addLog(d) }));
      }
    } catch (err: unknown) {
      addLog(`[ERROR]: ${err instanceof Error ? err.message : 'Run failed'}`);
    } finally {
      setIsRunning(false);
    }
  }, [webContainer, activeFile, openFiles, addLog, setTerminalVisible, bootStatus]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'b') { e.preventDefault(); setFileTreeVisible(!fileTreeVisible); }
      if (mod && e.key === 'j') { e.preventDefault(); setTerminalVisible(!terminalVisible); }
      if (mod && e.shiftKey && e.key === 'I') { e.preventDefault(); setChatPanelVisible(!chatPanelVisible); }
      if (mod && e.key === 'e') { e.preventDefault(); setEditorVisible((v) => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fileTreeVisible, terminalVisible, chatPanelVisible, setFileTreeVisible, setTerminalVisible, setChatPanelVisible]);

  const handleEditorMount: OnMount = useCallback((editor) => { editorRef.current = editor; }, []);
  const handleInlineCommand = useCallback((command: string, selection: string) => {
    addLog(`[AI]: ${command} on "${selection.slice(0, 60)}…"`);
  }, [addLog]);

  void isApplying; // used for future animation states

  type ReviewStatus = 'analyzing' | 'approved' | 'rejected';
  interface ReviewBreakdown { syntax: number; security: number; logic: number; efficiency: number; }

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
      {editorVisible && (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Toolbar */}
        <EditorToolbar
          editorVisible={editorVisible}
          setEditorVisible={setEditorVisible}
          fileTreeVisible={fileTreeVisible}
          chatPanelVisible={chatPanelVisible}
          terminalVisible={terminalVisible}
          setFileTreeVisible={setFileTreeVisible}
          setTerminalVisible={setTerminalVisible}
          setChatPanelVisible={setChatPanelVisible}
          bootStatus={bootStatus}
          isRunning={isRunning}
          activeFile={activeFile}
          currentProject={currentProject}
          onBootWebContainer={bootWebContainer}
          onRetryBoot={() => { isBootingRef.current = false; bootWebContainer(); }}
          onSave={handleSave}
          onRun={handleRun}
          onNewProject={() => {
            const name = prompt('Enter project name:');
            if (name?.trim()) createNewProject(name.trim());
          }}
          onOpenFolder={() => {
            const path = prompt('Enter absolute path to folder:');
            if (path?.trim()) openFolder(path.trim());
          }}
        />

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

        {/* Editor content */}
        <EditorContent
          pendingDiff={pendingDiff}
          currentFile={currentFile ?? null}
          openFiles={openFiles}
          activeFile={activeFile}
          activeTier={activeTier}
          editorContainerRef={editorContainerRef}
          editorRef={editorRef}
          onEditorMount={handleEditorMount}
          onInlineCommand={handleInlineCommand}
          onFilesChange={setOpenFiles}
        />

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
            className="mx-4 mb-2 mt-1 flex items-center gap-2 px-3 py-1 rounded-lg border border-white/[0.04] text-white/20 hover:text-white/50 text-[11px] font-mono hover:bg-white/5 transition-colors shrink-0"
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

      </div>
      )} {/* end editorVisible */}

      {/* ── Right: Preview ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPreview && iframeUrl && (
          <PreviewPanel
            iframeUrl={iframeUrl}
            onClose={() => setShowPreview(false)}
            editorVisible={editorVisible}
            onToggleEditor={() => setEditorVisible((v) => !v)}
          />
        )}
      </AnimatePresence>

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
        {Boolean(reviewState) && (() => {
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
        })()}
      </AnimatePresence>
    </div>
  );
};
