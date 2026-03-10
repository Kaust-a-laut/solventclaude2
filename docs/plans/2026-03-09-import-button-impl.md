# Import Button — Coding Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add import/attach file capability to the coding suite's FileTreePanel (import to project) and AgentChatPanel (attach to chat OR import to project).

**Architecture:** Four new components in `frontend/src/components/coding/` — `FolderPickerModal`, `ImportToast`, `ImportFileButton`, and `ChatImportButton`. `ImportFileButton` is wired into the FileTreePanel header. `ChatImportButton` (two icons: 📎 attach + ⬆️ import) is wired into the AgentChatPanel input toolbar. All file writes use the existing `POST /api/files/write` endpoint. Attach-to-chat uses client-side `FileReader` only — no server write.

**Tech Stack:** React, TypeScript, Zustand (`useAppStore`), Lucide icons, Framer Motion (for modal), `fetchWithRetry` from `../../lib/api-client`, Tailwind CSS (`cn` utility)

---

### Task 1: FolderPickerModal

Shared modal for choosing the destination folder when importing a file to the project. Fetches the file tree, filters to directories only, lets user pick one, then calls `onConfirm(folderPath)`.

**Files:**
- Create: `frontend/src/components/coding/FolderPickerModal.tsx`

**Step 1: Create the component**

```tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { BASE_URL } from '../../lib/config';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

function flattenDirs(nodes: FileNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === 'directory') {
      acc.push(n.path);
      if (n.children) flattenDirs(n.children, acc);
    }
  }
  return acc;
}

interface FolderPickerModalProps {
  fileName: string;
  onConfirm: (folder: string) => void;
  onClose: () => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({ fileName, onConfirm, onClose }) => {
  const [dirs, setDirs] = useState<string[]>(['.']);
  const [selected, setSelected] = useState('.');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithRetry(`${BASE_URL}/api/files/list?path=.`)
      .then((data) => {
        const nodes = Array.isArray(data) ? (data as FileNode[]) : [];
        setDirs(['.', ...flattenDirs(nodes)]);
      })
      .catch(() => { /* keep ['.'] as fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-80 rounded-2xl border border-white/10 bg-[#0d0d18] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <FolderOpen size={14} className="text-jb-accent" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white/60">Import to project</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>

          {/* File name label */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] text-white/40">
              Importing <span className="font-mono text-white/70">{fileName}</span>
            </p>
            <p className="text-[10px] text-white/30 mt-0.5">Choose destination folder:</p>
          </div>

          {/* Folder list */}
          <div className="mx-3 my-2 rounded-xl border border-white/[0.06] bg-white/[0.02] max-h-48 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="px-3 py-4 text-[10px] text-white/30 text-center">Loading folders…</div>
            ) : (
              dirs.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setSelected(dir)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] font-mono transition-colors',
                    selected === dir
                      ? 'bg-jb-accent/10 text-jb-accent'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  )}
                >
                  {selected === dir && <Check size={10} className="shrink-0" />}
                  {selected !== dir && <span className="w-[10px] shrink-0" />}
                  {dir === '.' ? '/ (project root)' : dir}
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-[10px] font-bold text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selected)}
              className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-jb-accent/15 border border-jb-accent/25 text-jb-accent hover:bg-jb-accent/25 transition-colors"
            >
              Import here
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
```

**Step 2: TypeScript check**

```bash
cd /home/caleb/BACKUP/solvent-ai-v1-production/.claude/worktrees/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | grep FolderPickerModal
```
Expected: no output (no errors for the new file).

**Step 3: Commit**

```bash
git add frontend/src/components/coding/FolderPickerModal.tsx
git commit -m "feat: add FolderPickerModal for choosing import destination"
```

---

### Task 2: ImportToast

Non-blocking toast shown after a successful project import. Auto-dismisses after 5 seconds. Shows an "Open in chat →" button that adds the file to `openFiles`, sets it as `activeFile`, and dismisses.

**Files:**
- Create: `frontend/src/components/coding/ImportToast.tsx`

**Step 1: Create the component**

```tsx
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, X, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface ImportToastProps {
  fileName: string;
  folder: string;
  filePath: string;
  fileContent: string;
  onDismiss: () => void;
}

export const ImportToast: React.FC<ImportToastProps> = ({
  fileName, folder, filePath, fileContent, onDismiss,
}) => {
  const { openFiles, setOpenFiles, setActiveFile } = useAppStore();

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const id = setTimeout(onDismiss, 5000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  const handleOpenInChat = () => {
    if (!openFiles.find((f) => f.path === filePath)) {
      setOpenFiles([...openFiles, { path: filePath, content: fileContent }]);
    }
    setActiveFile(filePath);
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-[#0d0d18] shadow-2xl max-w-sm"
    >
      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-white/80 truncate">
          <span className="font-mono text-white">{fileName}</span> imported
        </p>
        <p className="text-[9px] text-white/30 font-mono truncate">
          {folder === '.' ? '/' : folder}/
        </p>
      </div>
      <button
        type="button"
        onClick={handleOpenInChat}
        className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-jb-accent/15 border border-jb-accent/25 text-jb-accent hover:bg-jb-accent/25 transition-colors shrink-0 whitespace-nowrap"
      >
        Open in chat <ArrowRight size={9} />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 hover:bg-white/10 rounded text-white/20 hover:text-white/50 shrink-0"
        aria-label="Dismiss"
      >
        <X size={11} />
      </button>
    </motion.div>
  );
};
```

**Step 2: TypeScript check**

```bash
cd /home/caleb/BACKUP/solvent-ai-v1-production/.claude/worktrees/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | grep ImportToast
```
Expected: no output.

**Step 3: Commit**

```bash
git add frontend/src/components/coding/ImportToast.tsx
git commit -m "feat: add ImportToast with 'Open in chat' action"
```

---

### Task 3: ImportFileButton

Button used in FileTreePanel header. Handles the full import-to-project flow: file picker → FolderPickerModal → write to disk → refresh tree → show ImportToast.

**Files:**
- Create: `frontend/src/components/coding/ImportFileButton.tsx`

**Step 1: Create the component**

```tsx
import React, { useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { API_BASE_URL } from '../../lib/config';
import { FolderPickerModal } from './FolderPickerModal';
import { ImportToast } from './ImportToast';

interface ImportFileButtonProps {
  onImported: () => void; // callback to refresh file tree
}

interface ToastState {
  fileName: string;
  folder: string;
  filePath: string;
  fileContent: string;
}

export const ImportFileButton: React.FC<ImportFileButtonProps> = ({ onImported }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setPendingFile({ name: file.name, content });
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsText(file);
  };

  const handleConfirm = async (folder: string) => {
    if (!pendingFile) return;
    const filePath = folder === '.' ? pendingFile.name : `${folder}/${pendingFile.name}`;
    setPendingFile(null);

    try {
      await fetchWithRetry(`${API_BASE_URL}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: pendingFile.content }),
      });
      onImported();
      setToast({ fileName: pendingFile.name, folder, filePath, fileContent: pendingFile.content });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setError(msg);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => { setError(null); inputRef.current?.click(); }}
        className={cn('p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors')}
        title="Import file to project"
        aria-label="Import file to project"
      >
        <Upload size={11} />
      </button>

      {/* Error message (inline, auto-clears on next click) */}
      {error && (
        <span className="text-[8px] text-rose-400 font-mono px-1 truncate max-w-[100px]" title={error}>
          {error}
        </span>
      )}

      {/* Folder picker modal */}
      {pendingFile && (
        <FolderPickerModal
          fileName={pendingFile.name}
          onConfirm={handleConfirm}
          onClose={() => setPendingFile(null)}
        />
      )}

      {/* Success toast */}
      <AnimatePresence>
        {toast && (
          <ImportToast
            fileName={toast.fileName}
            folder={toast.folder}
            filePath={toast.filePath}
            fileContent={toast.fileContent}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
```

**Step 2: TypeScript check**

```bash
cd /home/caleb/BACKUP/solvent-ai-v1-production/.claude/worktrees/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | grep ImportFileButton
```
Expected: no output.

**Step 3: Commit**

```bash
git add frontend/src/components/coding/ImportFileButton.tsx
git commit -m "feat: add ImportFileButton for project file import flow"
```

---

### Task 4: ChatImportButton

Two-icon button for AgentChatPanel. 📎 Attach reads the file client-side and calls `onAttach(fileName, content)` for the parent to prepend to chat input. ⬆️ Import runs the full import-to-project flow (same as ImportFileButton).

**Files:**
- Create: `frontend/src/components/coding/ChatImportButton.tsx`

**Step 1: Create the component**

```tsx
import React, { useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Paperclip, Upload, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { API_BASE_URL } from '../../lib/config';
import { FolderPickerModal } from './FolderPickerModal';
import { ImportToast } from './ImportToast';

const MAX_ATTACH_BYTES = 500 * 1024; // 500 KB

interface ChatImportButtonProps {
  onAttach: (fileName: string, content: string) => void;
  onImported: () => void;
}

interface ToastState {
  fileName: string;
  folder: string;
  filePath: string;
  fileContent: string;
}

type Mode = 'attach' | 'import';

export const ChatImportButton: React.FC<ChatImportButtonProps> = ({ onAttach, onImported }) => {
  const attachInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; content: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const readFile = (file: File, mode: Mode): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsText(file);
    });

  const handleAttachChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setWarning(null);

    if (file.size > MAX_ATTACH_BYTES) {
      setWarning(`${file.name} is too large to attach (max 500 KB). Use Import to project instead.`);
      return;
    }

    try {
      const content = await readFile(file, 'attach');
      // Detect binary (null bytes or UTF-8 replacement char)
      if (content.includes('\u0000') || content.includes('\uFFFD')) {
        setWarning('Binary files cannot be attached as context.');
        return;
      }
      onAttach(file.name, content);
    } catch {
      setWarning('Could not read file.');
    }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setWarning(null);

    try {
      const content = await readFile(file, 'import');
      setPendingImport({ name: file.name, content });
    } catch {
      setWarning('Could not read file.');
    }
  };

  const handleConfirmImport = async (folder: string) => {
    if (!pendingImport) return;
    const filePath = folder === '.' ? pendingImport.name : `${folder}/${pendingImport.name}`;
    const { name, content } = pendingImport;
    setPendingImport(null);

    try {
      await fetchWithRetry(`${API_BASE_URL}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      onImported();
      setToast({ fileName: name, folder, filePath, fileContent: content });
    } catch (err: unknown) {
      setWarning(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input ref={attachInputRef} type="file" className="hidden" onChange={handleAttachChange} aria-hidden="true" />
      <input ref={importInputRef} type="file" className="hidden" onChange={handleImportChange} aria-hidden="true" />

      {/* Attach button */}
      <button
        type="button"
        onClick={() => { setWarning(null); attachInputRef.current?.click(); }}
        className={cn('p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors')}
        title="Attach file to chat (no project write)"
        aria-label="Attach file to chat"
      >
        <Paperclip size={12} />
      </button>

      {/* Import to project button */}
      <button
        type="button"
        onClick={() => { setWarning(null); importInputRef.current?.click(); }}
        className={cn('p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors')}
        title="Import file to project"
        aria-label="Import file to project"
      >
        <Upload size={12} />
      </button>

      {/* Inline warning */}
      {warning && (
        <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 flex items-start gap-1.5 p-2 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          <span className="text-[9px] leading-relaxed">{warning}</span>
        </div>
      )}

      {/* Folder picker modal */}
      {pendingImport && (
        <FolderPickerModal
          fileName={pendingImport.name}
          onConfirm={handleConfirmImport}
          onClose={() => setPendingImport(null)}
        />
      )}

      {/* Success toast */}
      <AnimatePresence>
        {toast && (
          <ImportToast
            fileName={toast.fileName}
            folder={toast.folder}
            filePath={toast.filePath}
            fileContent={toast.fileContent}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
```

**Step 2: TypeScript check**

```bash
cd /home/caleb/BACKUP/solvent-ai-v1-production/.claude/worktrees/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | grep ChatImportButton
```
Expected: no output.

**Step 3: Commit**

```bash
git add frontend/src/components/coding/ChatImportButton.tsx
git commit -m "feat: add ChatImportButton with attach and import modes"
```

---

### Task 5: Wire ImportFileButton into FileTreePanel

Add `ImportFileButton` to the FileTreePanel header toolbar, alongside the existing Refresh and Search buttons. Pass `fetchFiles` as the `onImported` callback so the tree refreshes after import.

**Files:**
- Modify: `frontend/src/components/coding/FileTreePanel.tsx`

**Step 1: Read the current header area (lines 85–98)**

Confirm current header structure:
```tsx
<div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.04] shrink-0">
  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Explorer</span>
  <div className="flex items-center gap-1">
    <button onClick={fetchFiles} ...><RefreshCw size={11} /></button>
    <button className="..."><Search size={11} /></button>
  </div>
</div>
```

**Step 2: Add import**

Add to the imports at the top of FileTreePanel.tsx:
```typescript
import { ImportFileButton } from './ImportFileButton';
```

**Step 3: Add button to the header toolbar**

Inside the `<div className="flex items-center gap-1">` (line 87), add `<ImportFileButton>` after the Search button:

```tsx
<div className="flex items-center gap-1">
  <button
    onClick={fetchFiles}
    className={cn('p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60', loading && 'animate-spin')}
  >
    <RefreshCw size={11} />
  </button>
  <button className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60">
    <Search size={11} />
  </button>
  <ImportFileButton onImported={fetchFiles} />
</div>
```

**Step 4: TypeScript check**

```bash
cd /home/caleb/BACKUP/solvent-ai-v1-production/.claude/worktrees/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | grep FileTreePanel
```
Expected: no output.

**Step 5: Commit**

```bash
git add frontend/src/components/coding/FileTreePanel.tsx
git commit -m "feat: wire ImportFileButton into FileTreePanel header"
```

---

### Task 6: Wire ChatImportButton into AgentChatPanel

Add `ChatImportButton` to the AgentChatPanel input toolbar. The `onAttach` callback prepends the file content to the chat textarea input. The `onImported` callback is a no-op stub since there's no tree to refresh from this panel (the tree panel handles its own refresh — the file will appear after next manual refresh or navigation).

**Files:**
- Modify: `frontend/src/components/coding/AgentChatPanel.tsx`

**Step 1: Add import**

Add to the imports at the top of AgentChatPanel.tsx:
```typescript
import { ChatImportButton } from './ChatImportButton';
```

**Step 2: Add `handleAttach` callback**

Add this function inside the `AgentChatPanel` component body, before `handleSend`:

```typescript
const handleAttach = (fileName: string, content: string) => {
  const ext = fileName.split('.').pop() ?? 'text';
  const block = `[Attached: ${fileName}]\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
  setInput((prev) => (prev ? `${block}\n${prev}` : block));
  inputRef.current?.focus();
};
```

**Step 3: Add `ChatImportButton` to the input toolbar**

The input area (lines 307–362) starts with the "Active file badge" section. Add the `ChatImportButton` in the `flex items-end gap-2` row that contains the textarea and send button. Place it to the left of the textarea:

```tsx
{/* Text input row */}
<div className="relative flex items-end gap-2">
  <ChatImportButton
    onAttach={handleAttach}
    onImported={() => { /* tree refreshes on its own */ }}
  />
  <textarea
    ref={inputRef}
    value={input}
    onChange={handleInputChange}
    onKeyDown={handleKeyDown}
    placeholder="/fix, /explain, /test…"
    rows={2}
    aria-expanded={showSlashMenu}
    aria-haspopup="listbox"
    className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-[12px] text-slate-200 placeholder-white/20 resize-none focus:outline-none focus:border-jb-accent/30 scrollbar-thin"
  />
  <button
    type="button"
    onClick={handleSend}
    disabled={!input.trim() || isGenerating}
    className="p-2.5 rounded-xl bg-jb-accent/15 border border-jb-accent/25 text-jb-accent hover:bg-jb-accent/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
    aria-label="Send message"
  >
    <Send size={14} />
  </button>
</div>
```

Note: The existing `<div className="flex items-end gap-2">` at line 327 needs to become `<div className="relative flex items-end gap-2">` (add `relative`) so the warning tooltip from `ChatImportButton` can position correctly with `bottom-full`.

**Step 4: TypeScript check**

```bash
cd /home/caleb/BACKUP/solvent-ai-v1-production/.claude/worktrees/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | grep AgentChatPanel
```
Expected: no output (only pre-existing unrelated errors).

**Step 5: Commit**

```bash
git add frontend/src/components/coding/AgentChatPanel.tsx
git commit -m "feat: wire ChatImportButton into AgentChatPanel input toolbar"
```

---

## Final Verification

```bash
cd /home/caleb/BACKUP/solvent-ai-v1-production/.claude/worktrees/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: same pre-existing errors as before (ChatInput.tsx, CodeBlock.tsx, NotepadPiP.tsx, SettingsService.ts). No new errors in the 4 new files or 2 modified files.

## Manual Smoke Test Checklist

- [ ] FileTreePanel header shows an Upload icon next to Refresh and Search
- [ ] Clicking Upload opens the OS file picker
- [ ] Selecting a file opens FolderPickerModal with directory list
- [ ] Selecting root and clicking "Import here" writes the file, tree refreshes, toast appears
- [ ] Toast "Open in chat" button opens file in editor + activates file context badge in AgentChatPanel
- [ ] AgentChatPanel input row shows 📎 and ⬆️ icons left of the textarea
- [ ] 📎 Attach on a small `.ts` file prepends content block to the textarea
- [ ] 📎 Attach on a file >500KB shows amber warning, no content added
- [ ] ⬆️ Import in chat panel opens FolderPickerModal, imports to chosen folder, shows toast
