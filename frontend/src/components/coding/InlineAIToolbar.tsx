import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { editor as MonacoEditor } from 'monaco-editor';
import { Sparkles, Wrench, BookOpen, TestTube, RefreshCw } from 'lucide-react';

interface SelectionPos {
  top: number;
  left: number;
}

interface Props {
  editorRef: React.MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  containerRef: React.RefObject<HTMLDivElement>;
  onCommand: (command: string, selection: string) => void;
}

const TOOLS = [
  { id: 'fix',      icon: Wrench,     label: 'Fix' },
  { id: 'explain',  icon: BookOpen,   label: 'Explain' },
  { id: 'test',     icon: TestTube,   label: 'Test' },
  { id: 'refactor', icon: RefreshCw,  label: 'Refactor' },
];

export const InlineAIToolbar: React.FC<Props> = ({ editorRef, containerRef, onCommand }) => {
  const [pos, setPos] = useState<SelectionPos | null>(null);
  const [showInlinePrompt, setShowInlinePrompt] = useState(false);
  const [promptText, setPromptText] = useState('');
  const promptRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Show toolbar on non-empty selection
    const disposable = editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        setPos(null);
        return;
      }
      // Get pixel coords of selection start
      const coords = editor.getScrolledVisiblePosition(selection.getStartPosition());
      if (!coords) return;
      const container = containerRef.current;
      if (!container) return;
      setPos({
        top: coords.top - 40,
        left: Math.min(coords.left, (container.clientWidth || 600) - 200),
      });
    });

    // ⌘K action — 2048 = KeyMod.CtrlCmd, 41 = KeyCode.KeyK
    const action = editor.addAction({
      id: 'inline-ai-prompt',
      label: 'AI: Inline Prompt (⌘K)',
      keybindings: [2048 | 41],
      run: () => {
        setShowInlinePrompt(true);
        setTimeout(() => promptRef.current?.focus(), 50);
      },
    });

    return () => {
      disposable.dispose();
      action.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- editorRef is stable; re-mount triggers re-run
  }, []);

  const handleToolClick = (toolId: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    const selectedText = selection ? editor.getModel()?.getValueInRange(selection) ?? '' : '';
    onCommand(toolId, selectedText);
    setPos(null);
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    const editor = editorRef.current;
    const selection = editor?.getSelection();
    const selectedText = selection ? editor?.getModel()?.getValueInRange(selection) ?? '' : '';
    onCommand('inline:' + promptText.trim(), selectedText);
    setPromptText('');
    setShowInlinePrompt(false);
  };

  return (
    <>
      {/* Selection toolbar — appears above selected code */}
      {pos && (
        <div
          className="absolute z-50 flex items-center gap-1 px-2 py-1 rounded-xl bg-[#0a0a18] border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
          style={{ top: pos.top, left: pos.left }}
        >
          <Sparkles size={11} className="text-jb-accent mr-1 shrink-0" />
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleToolClick(t.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label={t.label}
            >
              <t.icon size={10} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ⌘K inline prompt overlay — portaled to body so it covers both #root and #editor-portal */}
      {showInlinePrompt && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ pointerEvents: 'auto' }}
          onClick={() => setShowInlinePrompt(false)}
        >
          <form
            onSubmit={handlePromptSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0a0a18] border border-jb-accent/30 shadow-[0_8px_40px_rgba(0,0,0,0.8)] w-[420px]"
          >
            <Sparkles size={14} className="text-jb-accent shrink-0" />
            <input
              ref={promptRef}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setShowInlinePrompt(false); setPromptText(''); } }}
              placeholder="What should I change here?"
              className="flex-1 bg-transparent text-[13px] text-slate-200 placeholder-white/25 focus:outline-none"
            />
            <button type="submit" className="text-jb-accent hover:text-white transition-colors" aria-label="Submit">
              <Sparkles size={13} />
            </button>
          </form>
        </div>,
        document.body
      )}
    </>
  );
};
