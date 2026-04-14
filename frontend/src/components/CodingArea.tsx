import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import type { ConsoleEntry, ElementInfo } from '../store/codingSlice';
import { persistProjectOpenState, restoreProjectOpenState } from '../store/codingSlice';
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
  writeFileToWebContainer,
  toWcPath,
} from '../lib/webContainerBridge';
import { isImageFile } from './coding/editorUtils';
import { EditorToolbar } from './coding/EditorToolbar';
import { EditorContent } from './coding/EditorContent';
import { PreviewPanel } from './coding/PreviewPanel';
import { BRIDGE_SCRIPT } from '../lib/preview-bridge-script';

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
    setPreviewUrl, setPreviewSnapshot,
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
      setPreviewUrl: state.setPreviewUrl,
      setPreviewSnapshot: state.setPreviewSnapshot,
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

  // Auto-restore open files when a project is loaded and the editor is empty
  useEffect(() => {
    if (!currentProject || openFiles.length > 0) return;
    const key = `${currentProject.type}:${currentProject.path || currentProject.name}`;
    const saved = restoreProjectOpenState(key);
    if (!saved || saved.openFilePaths.length === 0) return;

    (async () => {
      addLog(`[SYSTEM]: Restoring ${saved.openFilePaths.length} file(s) from last session…`);
      const loaded: { path: string; content: string }[] = [];
      for (const path of saved.openFilePaths) {
        try {
          const data = await fetchWithRetry(
            `${BASE_URL}/api/files/read?path=${encodeURIComponent(path)}`
          ) as Record<string, string>;
          loaded.push({ path, content: data.content ?? '' });
        } catch { /* file may have been deleted — skip */ }
      }
      if (loaded.length > 0) {
        setOpenFiles(loaded);
        const preferred = saved.activeFile && loaded.find(f => f.path === saved.activeFile)
          ? saved.activeFile
          : (loaded[0]?.path ?? null);
        setActiveFile(preferred);
      }
    })();
  }, [currentProject]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save open file paths per project (debounced 1.5s)
  useEffect(() => {
    if (!currentProject || openFiles.length === 0) return;
    const key = `${currentProject.type}:${currentProject.path || currentProject.name}`;
    const timer = setTimeout(() => {
      persistProjectOpenState(key, openFiles.map(f => f.path), activeFile);
    }, 1500);
    return () => clearTimeout(timer);
  }, [openFiles, activeFile, currentProject]);

  // Re-register server-ready + error listeners whenever webContainer changes.
  // This handles both initial boot and hot-reload / singleton restore cases where
  // the old listeners pointed to a now-unmounted component's state setters.
  useEffect(() => {
    if (!webContainer) return;
    const offServerReady = webContainer.on('server-ready', (_port, url) => {
      setIframeUrl(url);
      setShowPreview(true);
      setPreviewUrl(url);
    });
    const offError = webContainer.on('error', (err: { message: string }) =>
      addLog(`[WC-ERROR]: ${err.message}`)
    );
    return () => { offServerReady(); offError(); };
  }, [webContainer, addLog, setPreviewUrl]);

  // Listen for preview events from iframe (console, DOM, clicks)
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
      // Listeners are registered by the useEffect above keyed on webContainer
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
      const wcPath = toWcPath(file.path, currentProject?.name);
      if (!wcPath) continue;
      const parts = wcPath.split('/').filter(Boolean);
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
  }, [webContainer, openFiles, currentProject?.name]);

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
    // Dispose Monaco text model to prevent memory leaks.
    const modelUri = monaco.editor.getModels().find((m) => m.uri.path.includes(path));
    modelUri?.dispose();
    const next = openFiles.filter((f) => f.path !== path);
    setOpenFiles(next);
    if (activeFile === path) setActiveFile(next.length > 0 ? (next[next.length - 1]?.path ?? null) : null);
  }, [openFiles, activeFile, setOpenFiles, setActiveFile]);

  const handleSave = useCallback(async () => {
    if (openFiles.length === 0) return;
    try {
      await Promise.all(openFiles.map(f =>
        fetchWithRetry(`${BASE_URL}/api/files/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: f.path, content: f.content }),
        })
      ));
      // Mirror each saved file into the WebContainer so the preview sees the change.
      await Promise.all(openFiles.map(f =>
        writeFileToWebContainer(toWcPath(f.path, currentProject?.name), f.content).catch(() => {})
      ));
      addLog(`[SYSTEM]: Saved ${openFiles.length} file(s)`);
      // Persist session state immediately on manual save
      if (currentProject) {
        const key = `${currentProject.type}:${currentProject.path || currentProject.name}`;
        persistProjectOpenState(key, openFiles.map(f => f.path), activeFile);
      }
    } catch { addLog(`[ERROR]: Save All failed`); }
  }, [openFiles, activeFile, currentProject, addLog]);

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
            // Canonical path stripping — WebContainer root = project root.
            // Must match what `sync_webcontainer` writes through `toWcPath`.
            const wcPath = toWcPath(filePath, currentProject.name);
            if (wcPath) { buildTree(wcPath, data.content ?? ''); synced++; }
          } catch { /* skip unreadable files (binaries, etc.) */ }
        })
      );
    }

    await wc.mount(tree as Parameters<typeof wc.mount>[0]);

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

  const handleApplyAll = useCallback(async () => {
    if (!pendingDiff) return;
    const { filePath, modified } = pendingDiff;
    setIsApplying(true);
    const existing = openFiles.find((f) => f.path === filePath);
    const updated = existing
      ? openFiles.map((f) => (f.path === filePath ? { ...f, content: modified } : f))
      : [...openFiles, { path: filePath, content: modified }];
    setOpenFiles(updated);
    clearPendingDiff();
    try {
      await fetchWithRetry(`${BASE_URL}/api/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: modified }),
      });
      await writeFileToWebContainer(toWcPath(filePath, currentProject?.name), modified).catch(() => {});
      addLog(`[SYSTEM]: Applied diff to ${filePath}`);
    } catch {
      addLog(`[ERROR]: Failed to persist ${filePath}`);
    } finally {
      setIsApplying(false);
    }
  }, [pendingDiff, openFiles, setOpenFiles, clearPendingDiff, currentProject, addLog]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'b') { e.preventDefault(); setFileTreeVisible(!fileTreeVisible); }
      if (mod && e.key === 'j') { e.preventDefault(); setTerminalVisible(!terminalVisible); }
      if (mod && e.shiftKey && e.key === 'I') { e.preventDefault(); setChatPanelVisible(!chatPanelVisible); }
      if (mod && e.key === 'e') { e.preventDefault(); setEditorVisible((v) => !v); }
      if (mod && e.key === 's') { e.preventDefault(); handleSave(); }
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

      {/* ── Center: Toolbar always visible; editor content collapses ── */}
      <div className={editorVisible ? 'flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden' : 'shrink-0 flex flex-col min-h-0 overflow-hidden'}>
        {/* Toolbar — always rendered so the toggle is always reachable */}
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

        {/* Editor content — hidden when editorVisible is false */}
        {editorVisible && (
          <>
            <EditorTabBar
              openFiles={openFiles}
              activeFile={activeFile}
              onTabClick={setActiveFile}
              onTabClose={closeFile}
            />

            {pendingDiff && (
              <DiffBanner
                description={pendingDiff.description}
                onApplyAll={handleApplyAll}
                onReject={clearPendingDiff}
              />
            )}

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

            {terminalVisible && (
              <CodingTerminal
                lines={terminalLines}
                onClear={clearTerminalLines}
              />
            )}

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
          </>
        )}
      </div>

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
