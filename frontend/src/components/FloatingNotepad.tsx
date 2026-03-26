import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { NotepadPiP } from './NotepadPiP';
import { useAppStore } from '../store/useAppStore';
import { Rnd } from 'react-rnd';

export const FloatingNotepad = () => {
  const {
    notepadContent,
    isCommandCenterOpen: isOpen, setIsCommandCenterOpen: setIsOpen,
    setCommandCenterPiPOpen,
  } = useAppStore();

  const [lastContent, setLastContent] = useState(notepadContent);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const pipWindowRef = useRef<Window | null>(null);

  const [position, setPosition] = useState({
    x: typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 440) : 100,
    y: typeof window !== 'undefined' ? Math.max(0, Math.round((window.innerHeight - 56 - 650) / 2)) : 50,
  });
  const [size, setSize] = useState({ width: 420, height: 650 });

  // Auto-open panel when AI updates notepad content
  useEffect(() => {
    if (notepadContent !== lastContent) {
      setLastContent(notepadContent);
      if (isFirstLoad) { setIsFirstLoad(false); return; }
      if (!isOpen) setIsOpen(true);
    }
  }, [notepadContent, isFirstLoad, isOpen, lastContent, setIsOpen]);

  const openDocumentPiP = async () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.focus();
      return;
    }

    if (!('documentPictureInPicture' in window)) {
      console.warn('Document Picture-in-Picture not supported in this browser');
      return;
    }

    try {
      const pipWin: Window = await (window as any).documentPictureInPicture.requestWindow({
        width: 420,
        height: 650,
      });
      pipWindowRef.current = pipWin;

      [...document.styleSheets].forEach((sheet) => {
        try {
          if (sheet.href) {
            const link = pipWin.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            pipWin.document.head.appendChild(link);
          } else {
            const cssText = [...sheet.cssRules].map(r => r.cssText).join('\n');
            const style = pipWin.document.createElement('style');
            style.textContent = cssText;
            pipWin.document.head.appendChild(style);
          }
        } catch (_) {}
      });

      pipWin.document.body.style.cssText = 'margin:0;padding:0;background:#050508;color:white;';
      const container = pipWin.document.createElement('div');
      container.style.cssText = 'width:100vw;height:100vh;';
      pipWin.document.body.appendChild(container);

      const root = createRoot(container);
      root.render(<NotepadPiP />);

      setCommandCenterPiPOpen(true);
      setIsOpen(false);

      pipWin.addEventListener('pagehide', () => {
        root.unmount();
        setCommandCenterPiPOpen(false);
        pipWindowRef.current = null;
      });
    } catch (err) {
      console.error('Document PiP failed:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 top-14 z-50 pointer-events-none">
      <Rnd
        size={{ width: size.width, height: size.height }}
        position={{ x: position.x, y: position.y }}
        onDragStop={(_, d) => setPosition({ x: d.x, y: Math.max(0, d.y) })}
        onResizeStop={(_, _dir, ref, _delta, pos) => {
          setSize({ width: ref.offsetWidth, height: ref.offsetHeight });
          setPosition({ x: pos.x, y: Math.max(0, pos.y) });
        }}
        minWidth={320}
        minHeight={400}
        dragHandleClassName="drag-handle"
        bounds="parent"
        style={{ pointerEvents: 'auto' }}
      >
        <NotepadPiP
          onClose={() => setIsOpen(false)}
          onDetach={openDocumentPiP}
        />
      </Rnd>
    </div>
  );
};
