import React from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { Cpu } from 'lucide-react';
import { TIER_CONFIG } from '../../lib/performanceTier';
import type { PerformanceTier } from '../../lib/performanceTier';
import { isImageFile, getLang } from './editorUtils';
import { InlineAIToolbar } from './InlineAIToolbar';

interface EditorContentProps {
  pendingDiff: { filePath: string; description: string; original: string; modified: string } | null;
  currentFile: { path: string; content: string } | null;
  openFiles: { path: string; content: string }[];
  activeFile: string | null;
  activeTier: PerformanceTier;
  editorContainerRef: React.RefObject<HTMLDivElement>;
  editorRef: React.MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  onEditorMount: OnMount;
  onInlineCommand: (command: string, selection: string) => void;
  onFilesChange: (files: { path: string; content: string }[]) => void;
}

export const EditorContent: React.FC<EditorContentProps> = ({
  pendingDiff,
  currentFile,
  openFiles,
  activeFile,
  activeTier,
  editorContainerRef,
  editorRef,
  onEditorMount,
  onInlineCommand,
  onFilesChange,
}) => {
  const tierConfig = TIER_CONFIG[activeTier];

  if (pendingDiff) {
    return (
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 flex">
          <div className="flex-1 overflow-auto p-4 border-r border-white/[0.06]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">Original</div>
            <pre className="font-mono text-[13px] text-slate-400 whitespace-pre leading-[1.6]">{pendingDiff.original}</pre>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">Modified</div>
            <pre className="font-mono text-[13px] text-slate-300 whitespace-pre leading-[1.6]">{pendingDiff.modified}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (currentFile && isImageFile(currentFile.path)) {
    return (
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-auto flex items-center justify-center bg-[#0a0a12] p-8">
          <img
            src={currentFile.content}
            alt={currentFile.path}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      </div>
    );
  }

  if (currentFile) {
    return (
      <div ref={editorContainerRef} className="flex-1 min-h-0 relative overflow-hidden">
        <div className="absolute inset-0">
          <Editor
            theme="vs-dark"
            language={getLang(currentFile.path)}
            value={currentFile.content}
            path={currentFile.path}
            onChange={(value) =>
              onFilesChange(openFiles.map((f) =>
                f.path === activeFile ? { ...f, content: value ?? '' } : f
              ))
            }
            onMount={onEditorMount}
            options={{
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: tierConfig.monacoMinimap },
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              renderLineHighlight: 'gutter',
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'off',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              bracketPairColorization: { enabled: tierConfig.monacoBracketColors },
              quickSuggestionsDelay: activeTier === 'lite' ? 300 : 100,
              scrollbar: {
                alwaysConsumeMouseWheel: true,
              },
            }}
          />
        </div>
        <InlineAIToolbar
          editorRef={editorRef}
          containerRef={editorContainerRef}
          onCommand={onInlineCommand}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center opacity-10 gap-4">
      <Cpu size={48} strokeWidth={1} aria-hidden="true" />
      <span className="text-[11px] font-black uppercase tracking-[0.5em]">Open a file to begin</span>
    </div>
  );
};
