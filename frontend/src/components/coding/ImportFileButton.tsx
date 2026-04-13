import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, FolderInput, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { BASE_URL } from '../../lib/config';
import { FolderPickerModal } from './FolderPickerModal';
import { ImportToast } from './ImportToast';
import { useAppStore } from '../../store/useAppStore';

// webkitRelativePath is non-standard but supported in all modern browsers
interface WebkitFile extends File {
  readonly webkitRelativePath: string;
}

interface ImportFileButtonProps {
  onImported: () => void; // callback to refresh file tree
}

interface ToastState {
  fileName: string;
  folder: string;
  filePath: string;
  fileContent: string;
}

interface FolderToastState {
  folderName: string;
  fileCount: number;
}

// Binary-safe check: skip files that are likely not text
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.avif', '.svg',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp4', '.mp3', '.wav', '.ogg', '.webm',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib',
  '.class', '.pyc',
  '.db', '.sqlite',
]);

// Directory segments that should never be uploaded (generated/dependency folders)
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build', '.next', '.nuxt',
  'out', '.cache', '.turbo', '.vercel', '__pycache__', '.venv', 'venv',
  'target', '.gradle', '.idea', '.vscode',
]);

function shouldSkipPath(relativePath: string): boolean {
  return relativePath.split('/').some(segment => SKIP_DIRS.has(segment));
}

function isTextFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return !BINARY_EXTS.has(ext);
}

/** Upload files in bounded batches to avoid overwhelming the browser + backend. */
async function uploadInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsText(file);
  });
}

export const ImportFileButton: React.FC<ImportFileButtonProps> = ({ onImported }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const isSubmittingRef = useRef(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [folderToast, setFolderToast] = useState<FolderToastState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderUploading, setFolderUploading] = useState<{ name: string; total: number } | null>(null);
  const currentProject = useAppStore((s) => s.currentProject);

  // Abort any in-progress FileReader on unmount
  useEffect(() => () => { readerRef.current?.abort(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    readerRef.current = reader;
    reader.onload = () => {
      setPendingFile({ name: file.name, content: reader.result as string });
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsText(file);
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert to plain Array BEFORE clearing — clearing the input mutates the
    // live FileList in-place, so rawFiles.length would always be 0 otherwise.
    const files = Array.from(e.target.files ?? []) as WebkitFile[];
    e.target.value = '';
    if (files.length === 0) return;

    // webkitRelativePath = "folderName/sub/file.ts" — strip the root folder prefix
    const rootPrefix = files[0]?.webkitRelativePath.split('/')[0] ?? '';

    // Filter: skip binary files AND generated/dependency directories
    const textFiles = files.filter(f => {
      const relative = rootPrefix
        ? f.webkitRelativePath.slice(rootPrefix.length + 1)
        : f.webkitRelativePath;
      return isTextFile(f.name) && !shouldSkipPath(relative);
    });

    if (textFiles.length === 0) {
      setError('No importable text files found (node_modules, dist, .git, etc. are skipped).');
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setFolderUploading({ name: rootPrefix || 'folder', total: textFiles.length });

    try {
      const results = await uploadInBatches(textFiles, 10, async (file) => {
        // Strip root folder name: "myProject/src/App.tsx" → "src/App.tsx"
        const stripped = rootPrefix
          ? file.webkitRelativePath.slice(rootPrefix.length + 1)
          : file.webkitRelativePath;
        if (!stripped) return; // skip if path is just the root folder itself

        // For scratchpad projects the backend resolves paths relative to the
        // projects directory, so prefix with the project name so files land at
        // projects/{projectName}/{stripped} instead of projects/{stripped}.
        const writePath =
          currentProject !== null && currentProject.type === 'scratchpad'
            ? `${currentProject.name}/${stripped}`
            : stripped;

        const content = await readFileAsText(file);
        await fetchWithRetry(`${BASE_URL}/api/files/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: writePath, content }),
        });
      });

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      onImported();
      setFolderToast({ folderName: rootPrefix || 'folder', fileCount: succeeded });
      if (failed > 0) {
        setError(`${failed} file${failed > 1 ? 's' : ''} failed to import.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Folder import failed');
    } finally {
      isSubmittingRef.current = false;
      setFolderUploading(null);
    }
  };

  const handleConfirm = async (folder: string) => {
    if (!pendingFile || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const relativePath = folder === '.' ? pendingFile.name : `${folder}/${pendingFile.name}`;
    const filePath =
      currentProject !== null && currentProject.type === 'scratchpad'
        ? `${currentProject.name}/${relativePath}`
        : relativePath;
    const { name, content } = pendingFile;
    setPendingFile(null);

    try {
      await fetchWithRetry(`${BASE_URL}/api/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      onImported();
      setToast({ fileName: name, folder, filePath, fileContent: content });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <>
      {/* Single-file input */}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />
      {/* Directory input — webkitdirectory puts the dialog into folder-selection mode */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error — webkitdirectory is not in React's HTMLInputElement typings but is widely supported
        webkitdirectory=""
        className="hidden"
        onChange={handleFolderChange}
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
      <button
        type="button"
        onClick={() => { setError(null); folderInputRef.current?.click(); }}
        disabled={!!folderUploading}
        className={cn('p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors', folderUploading && 'opacity-60 cursor-not-allowed')}
        title="Import folder to project"
        aria-label="Import folder to project"
      >
        {folderUploading ? <Loader2 size={11} className="animate-spin text-indigo-400" /> : <FolderInput size={11} />}
      </button>

      {/* Folder picker modal */}
      {pendingFile && (
        <FolderPickerModal
          fileName={pendingFile.name}
          onConfirm={handleConfirm}
          onClose={() => setPendingFile(null)}
        />
      )}

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl border border-rose-500/20 bg-[#0d0d18] shadow-2xl max-w-sm"
          >
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <p className="text-[11px] text-white/70">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 text-[11px] text-white/30 hover:text-white/60"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single-file success toast */}
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

      {/* Folder uploading progress toast */}
      <AnimatePresence>
        {folderUploading && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border border-indigo-500/20 bg-[#0d0d18] shadow-2xl max-w-sm"
          >
            <Loader2 size={14} className="text-indigo-400 shrink-0 animate-spin" />
            <p className="flex-1 min-w-0 text-[11px] text-white/70">
              Uploading{' '}
              <span className="font-mono text-white">"{folderUploading.name}"</span>
              {' '}—{' '}
              <span className="text-indigo-400">{folderUploading.total} file{folderUploading.total !== 1 ? 's' : ''}…</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder import success toast */}
      <AnimatePresence>
        {folderToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-[#0d0d18] shadow-2xl max-w-sm"
          >
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <p className="flex-1 min-w-0 text-[11px] font-bold text-white/80">
              <span className="font-mono text-white">"{folderToast.folderName}"</span>
              {' '}imported —{' '}
              <span className="text-emerald-400">{folderToast.fileCount} file{folderToast.fileCount !== 1 ? 's' : ''}</span>
            </p>
            <button
              type="button"
              onClick={() => setFolderToast(null)}
              className="p-1 hover:bg-white/10 rounded text-white/20 hover:text-white/50 shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
