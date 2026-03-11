import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import type { AgentMessage, CodeSuggestion } from '../../store/codingSlice';
import { fetchWithRetry } from '../../lib/api-client';
import { API_BASE_URL } from '../../lib/config';
import { AgentCodeBlock } from './AgentCodeBlock';
import { ChatImportButton } from './ChatImportButton';
import { MODEL_OPTIONS } from '../ModelSelector';
import {
  SLASH_COMMANDS,
  parseSlashCommand,
  buildSystemPrompt,
} from './slashCommands';

// Extracts fenced code blocks from AI response text
function extractCodeBlocks(text: string): { cleanText: string; blocks: CodeSuggestion[] } {
  const blocks: CodeSuggestion[] = [];
  let idx = 0;
  const cleanText = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = `cb-${Date.now()}-${idx++}`;
    blocks.push({ id, language: lang || 'text', code: code.trim(), applied: false, rejected: false });
    return `[[CODE_BLOCK:${id}]]`;
  });
  return { cleanText, blocks };
}

export const AgentChatPanel: React.FC = () => {
  const {
    addAgentMessage, clearAgentMessages, updateAgentMessage,
    activeFile, openFiles, selectedCloudModel, selectedCloudProvider, apiKeys,
    setPendingDiff, setSelectedCloudModel, setSelectedCloudProvider,
  } = useAppStore();

  // Read agentMessages from store for rendering (not for closure capture)
  const agentMessages = useAppStore((s) => s.agentMessages);

  const [input, setInput] = useState('');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [fileContextActive, setFileContextActive] = useState(true);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeFileContent = openFiles.find((f) => f.path === activeFile)?.content ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  // Cleanup: abort any in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleAttach = useCallback((fileName: string, content: string) => {
    const ext = fileName.split('.').pop() ?? 'text';
    const block = `[Attached: ${fileName}]\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
    setInput((prev) => (prev ? `${block}\n${prev}` : block));
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput('');
    setShowSlashMenu(false);

    // Abort any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const parsed = parseSlashCommand(text);
    const slashCmd = parsed ? SLASH_COMMANDS.find((c) => c.id === parsed.command) : null;

    const userMsg: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      fileContext: fileContextActive && activeFile ? activeFile : undefined,
    };
    addAgentMessage(userMsg);

    setIsGenerating(true);
    try {
      const systemPrompt = buildSystemPrompt(
        fileContextActive ? activeFile : null,
        fileContextActive ? activeFileContent : null,
        null
      );

      // Read current messages from store at call time to avoid stale closure
      const currentMessages = useAppStore.getState().agentMessages;

      const messages = [
        { role: 'system', content: slashCmd ? slashCmd.systemInstruction + '\n\n' + systemPrompt : systemPrompt },
        ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: parsed?.rest || text },
      ];

      const data = await fetchWithRetry(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          provider: selectedCloudProvider || 'groq',
          model: selectedCloudModel,
          messages,
          apiKeys,
        }),
      }) as Record<string, unknown>;

      const rawResponse: string = (data.response as string) ?? '';
      const { cleanText, blocks } = extractCodeBlocks(rawResponse);

      const assistantMsg: AgentMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: cleanText,
        codeBlocks: blocks,
      };
      addAgentMessage(assistantMsg);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      addAgentMessage({ id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ Error: ${message}` });
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, activeFile, activeFileContent, fileContextActive,
      addAgentMessage, selectedCloudModel, selectedCloudProvider, apiKeys, setPendingDiff]);

  const handleApply = (msgId: string, blockId: string) => {
    const msg = agentMessages.find((m) => m.id === msgId);
    const block = msg?.codeBlocks?.find((b) => b.id === blockId);
    if (!msg || !block || !activeFile || !activeFileContent) return;
    setPendingDiff({
      original: activeFileContent,
      modified: block.code,
      filePath: activeFile,
      description: 'AI suggestion from chat',
    });
    updateAgentMessage(msgId, {
      codeBlocks: (msg.codeBlocks ?? []).map((b) => b.id === blockId ? { ...b, applied: true } : b),
    });
  };

  const handleReject = (msgId: string, blockId: string) => {
    const msg = agentMessages.find((m) => m.id === msgId);
    if (!msg?.codeBlocks) return;
    updateAgentMessage(msgId, {
      codeBlocks: msg.codeBlocks.map((b) => b.id === blockId ? { ...b, rejected: true } : b),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      const filtered = SLASH_COMMANDS.filter((c) => input === '/' || c.id.startsWith(input.slice(1)));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenuIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenuIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && filtered.length > 0)) {
        const selected = filtered[slashMenuIndex];
        if (selected) {
          e.preventDefault();
          setInput(selected.label + ' ');
          setShowSlashMenu(false);
          setSlashMenuIndex(0);
          inputRef.current?.focus();
          return;
        }
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === '/') {
      setShowSlashMenu(true);
    } else if (e.key === 'Escape') {
      setShowSlashMenu(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setShowSlashMenu(e.target.value.startsWith('/') && e.target.value.length < 20);
    setSlashMenuIndex(0);
  };

  const renderMessageContent = (msg: AgentMessage) => {
    const parts = msg.content.split(/(\[\[CODE_BLOCK:[^\]]+\]\])/);
    return (
      <>
        {parts.map((part, i) => {
          const blockMatch = part.match(/\[\[CODE_BLOCK:([^\]]+)\]\]/);
          if (blockMatch) {
            const block = msg.codeBlocks?.find((b) => b.id === blockMatch[1]);
            if (block) {
              return (
                <AgentCodeBlock
                  key={block.id}
                  suggestion={block}
                  onApply={(id) => handleApply(msg.id, id)}
                  onReject={(id) => handleReject(msg.id, id)}
                />
              );
            }
          }
          return part ? (
            <p key={i} className="text-[12px] leading-relaxed text-slate-300 whitespace-pre-wrap">{part}</p>
          ) : null;
        })}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-jb-accent" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Agent</span>
          <span className="text-[10px] text-white/20">·</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelMenu((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
              aria-label="Select model"
            >
              <span className="truncate max-w-[100px]">
                {MODEL_OPTIONS.find((m) => m.model === selectedCloudModel)?.displayName ?? selectedCloudModel ?? 'auto'}
              </span>
              <ChevronDown size={10} />
            </button>
            {showModelMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} aria-hidden="true" />
                <div className="absolute top-full left-0 mt-1 w-52 rounded-xl border border-white/[0.07] bg-[#0a0a14] overflow-hidden z-50 shadow-xl">
                  {MODEL_OPTIONS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.model}
                        type="button"
                        onClick={() => {
                          setSelectedCloudModel(m.model);
                          setSelectedCloudProvider(m.provider as Parameters<typeof setSelectedCloudProvider>[0]);
                          setShowModelMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors',
                          selectedCloudModel === m.model && 'bg-white/[0.04]'
                        )}
                      >
                        <Icon size={12} className={m.color} aria-hidden="true" />
                        <div className="flex flex-col min-w-0">
                          <span className={cn('text-[11px] font-medium leading-tight', m.color)}>{m.displayName}</span>
                          <span className="text-[9px] text-white/30 leading-tight">{m.sublabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={clearAgentMessages}
          className="p-1 hover:bg-white/10 rounded text-white/20 hover:text-white/50 transition-colors"
          title="Clear chat"
          aria-label="Clear chat"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {agentMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-20 gap-3">
            <Sparkles size={28} strokeWidth={1} />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Ask the agent anything</p>
          </div>
        )}
        {agentMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-xl px-3 py-2',
              msg.role === 'user'
                ? 'bg-jb-accent/[0.08] border border-jb-accent/15 ml-4'
                : 'bg-white/[0.03] border border-white/[0.05]'
            )}
          >
            {msg.fileContext && (
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[9px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/40 font-mono">
                  📄 {msg.fileContext.split('/').pop()}
                </span>
              </div>
            )}
            {renderMessageContent(msg)}
          </div>
        ))}
        {isGenerating && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-jb-accent/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Slash command menu */}
      {showSlashMenu && (
        <div role="listbox" className="mx-3 mb-1 rounded-xl border border-white/[0.07] bg-[#0a0a14] overflow-hidden">
          {SLASH_COMMANDS.filter((c) => input === '/' || c.id.startsWith(input.slice(1))).map((cmd, idx) => (
            <button
              key={cmd.id}
              role="option"
              aria-selected={idx === slashMenuIndex}
              type="button"
              onClick={() => { setInput(cmd.label + ' '); setShowSlashMenu(false); setSlashMenuIndex(0); inputRef.current?.focus(); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                idx === slashMenuIndex ? "bg-white/8" : "hover:bg-white/5"
              )}
            >
              <span className="text-[11px] font-mono text-jb-accent font-bold w-20 shrink-0">{cmd.label}</span>
              <span className="text-[10px] text-white/40">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t border-white/[0.04] shrink-0">
        {/* Active file badge */}
        {activeFile && (
          <div className="flex items-center gap-1 mb-2">
            <button
              type="button"
              onClick={() => setFileContextActive(!fileContextActive)}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-mono transition-colors border',
                fileContextActive
                  ? 'bg-jb-accent/10 border-jb-accent/20 text-jb-accent/80'
                  : 'bg-white/5 border-white/10 text-white/30 line-through'
              )}
            >
              📄 {activeFile.split('/').pop()}
            </button>
          </div>
        )}
        {/* Text input */}
        <div className="relative flex items-end gap-2">
          <div className="relative flex-1">
            <div className="absolute left-2 bottom-[7px] flex items-center gap-0.5 z-10">
              <ChatImportButton
                onAttach={handleAttach}
                onImported={() => { /* tree panel refreshes on its own */ }}
              />
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="/fix, /explain, /test…"
              rows={2}
              aria-expanded={showSlashMenu}
              aria-haspopup="listbox"
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-14 pr-3 py-2 text-[12px] text-slate-200 placeholder-white/20 resize-none focus:outline-none focus:border-jb-accent/30 scrollbar-thin"
            />
          </div>
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
        {/* Slash command chips */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {['/fix', '/explain', '/test'].map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => { setInput(cmd + ' '); inputRef.current?.focus(); }}
              className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-[9px] font-mono text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
