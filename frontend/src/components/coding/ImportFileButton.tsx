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
    const { name, content } = pendingFile;
    setPendingFile(null);

    try {
      await fetchWithRetry(`${API_BASE_URL}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      onImported();
      setToast({ fileName: name, folder, filePath, fileContent: content });
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
