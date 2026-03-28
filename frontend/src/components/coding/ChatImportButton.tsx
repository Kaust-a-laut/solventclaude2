import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Paperclip, Upload, AlertCircle } from 'lucide-react';
import { fetchWithRetry } from '../../lib/api-client';
import { BASE_URL } from '../../lib/config';
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

export const ChatImportButton: React.FC<ChatImportButtonProps> = ({ onAttach, onImported }) => {
  const attachInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const isSubmittingRef = useRef(false);
  const [pendingImport, setPendingImport] = useState<{ name: string; content: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Abort any in-progress FileReader on unmount
  useEffect(() => () => { readerRef.current?.abort(); }, []);

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      readerRef.current = reader;
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
      setWarning('File too large to attach. Use Import to project instead.');
      return;
    }

    try {
      const content = await readFile(file);
      // Detect binary (null bytes or UTF-8 replacement char)
      if (content.includes('\u0000') || content.includes('\uFFFD')) {
        setWarning("Binary files can't be attached as context.");
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
      const content = await readFile(file);
      setPendingImport({ name: file.name, content });
    } catch {
      setWarning('Could not read file.');
    }
  };

  const handleConfirmImport = async (folder: string) => {
    if (!pendingImport || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const filePath = folder === '.' ? pendingImport.name : `${folder}/${pendingImport.name}`;
    const { name, content } = pendingImport;
    setPendingImport(null);

    try {
      await fetchWithRetry(`${BASE_URL}/api/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      onImported();
      setToast({ fileName: name, folder, filePath, fileContent: content });
    } catch (err: unknown) {
      setWarning(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input ref={attachInputRef} type="file" className="hidden" onChange={handleAttachChange} aria-hidden="true" />
      <input ref={importInputRef} type="file" className="hidden" onChange={handleImportChange} aria-hidden="true" />

      {/* Attach button — orange */}
      <button
        type="button"
        onClick={() => { setWarning(null); attachInputRef.current?.click(); }}
        className="p-1 rounded text-orange-400/70 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
        title="Attach file to chat (no project write)"
        aria-label="Attach file to chat"
      >
        <Paperclip size={12} />
      </button>

      {/* Import to project button — blue */}
      <button
        type="button"
        onClick={() => { setWarning(null); importInputRef.current?.click(); }}
        className="p-1 rounded text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
        title="Import file to project"
        aria-label="Import file to project"
      >
        <Upload size={12} />
      </button>

      {/* Inline warning */}
      {warning && (
        <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 flex items-start gap-1.5 p-2 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          <span className="text-[11px] leading-relaxed">{warning}</span>
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
