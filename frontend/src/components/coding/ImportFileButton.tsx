import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, FolderInput, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { BASE_URL } from '../../lib/config';
import { FolderPickerModal } from './FolderPickerModal';
import { ImportToast } from './ImportToast';

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

function isTextFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return !BINARY_EXTS.has(ext);
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
    const rawFiles = e.target.files;
    e.target.value = '';
    if (!rawFiles || rawFiles.length === 0) return;

    const files = Array.from(rawFiles) as WebkitFile[];
    // webkitRelativePath = "folderName/sub/file.ts" — strip the root folder prefix
    const rootPrefix = files[0]?.webkitRelativePath.split('/')[0] ?? '';
    const textFiles = files.filter(f => isTextFile(f.name));

    if (textFiles.length === 0) {
      setError('No text files found in the selected folder.');
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    try {
      const results = await Promise.allSettled(
        textFiles.map(async (file) => {
          // Strip root folder name: "myProject/src/App.tsx" → "src/App.tsx"
          const relativePath = rootPrefix
            ? file.webkitRelativePath.slice(rootPrefix.length + 1)
            : file.webkitRelativePath;
          if (!relativePath) return; // skip if path is just the root folder itself

          const content = await readFileAsText(file);
          await fetchWithRetry(`${BASE_URL}/api/files/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: relativePath, content }),
          });
        })
      );

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
    }
  };

  const handleConfirm = async (folder: string) => {
    if (!pendingFile || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const filePath = folder === '.' ? pendingFile.name : `${folder}/${pendingFile.name}`;
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
        className={cn('p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors')}
        title="Import folder to project"
        aria-label="Import folder to project"
      >
        <FolderInput size={11} />
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
