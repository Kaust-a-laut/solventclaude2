import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { BASE_URL } from '../../lib/config';
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
  const readerRef = useRef<FileReader | null>(null);
  const isSubmittingRef = useRef(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
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
