import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ConversationBubble } from './ConversationBubble';
import type { AgentConfig } from './AgentCard';
import type { CollaborateMessage } from '../../store/collaborateSlice';

interface ConversationFeedProps {
  messages: CollaborateMessage[];
  agentConfigs: AgentConfig[];
  activeAgentId: string | null;
  status: string;
  hoveredAgentId?: string | null;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  onVisibleAgentsChange?: (ids: Set<string>) => void;
}

export const ConversationFeed: React.FC<ConversationFeedProps> = ({
  messages,
  agentConfigs,
  activeAgentId,
  status,
  hoveredAgentId,
  scrollContainerRef,
  onVisibleAgentsChange,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const visibleAgentsRef = useRef<Set<string>>(new Set());

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeAgentId]);

  const getConfig = (agentId: string) =>
    agentConfigs.find(c => c.role === agentId);

  // ── IntersectionObserver for spatial anchoring ─────────────────────────────
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const current = new Set(visibleAgentsRef.current);
    let changed = false;

    for (const entry of entries) {
      const agentId = (entry.target as HTMLElement).dataset.agentId;
      if (!agentId) continue;

      if (entry.isIntersecting) {
        if (!current.has(agentId)) { current.add(agentId); changed = true; }
      } else {
        if (current.has(agentId)) { current.delete(agentId); changed = true; }
      }
    }

    if (changed) {
      visibleAgentsRef.current = current;
      onVisibleAgentsChange?.(new Set(current));
    }
  }, [onVisibleAgentsChange]);

  useEffect(() => {
    const root = scrollContainerRef?.current ?? null;
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root,
      threshold: 0.3,
    });

    const container = feedRef.current;
    if (container) {
      const bubbles = container.querySelectorAll('[data-agent-id]');
      bubbles.forEach(el => observerRef.current?.observe(el));
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleIntersection, messages.length, scrollContainerRef]);

  // Re-observe new bubbles when messages change
  useEffect(() => {
    if (!feedRef.current || !observerRef.current) return;
    const bubbles = feedRef.current.querySelectorAll('[data-agent-id]');
    bubbles.forEach(el => observerRef.current?.observe(el));
  }, [messages.length]);

  // Group messages by round for separators
  let lastRound = 0;

  return (
    <div ref={feedRef} className="space-y-4">
      {messages.length === 0 && status === 'active' && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-jb-purple"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-600 uppercase tracking-widest font-bold">
              Agents joining the roundtable...
            </p>
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg, idx) => {
          // Check if we need a round separator
          const currentMsgRound = Math.ceil(
            messages.filter((m, i) => i <= idx && m.agentId !== 'user').length /
            Math.max(1, agentConfigs.length)
          );
          let showRoundSep = false;
          if (currentMsgRound > lastRound && currentMsgRound > 1 && msg.agentId !== 'user') {
            showRoundSep = true;
            lastRound = currentMsgRound;
          }

          // Determine highlight state for hover-to-highlight
          let isHighlighted: boolean | undefined;
          if (hoveredAgentId != null) {
            isHighlighted = msg.agentId === hoveredAgentId;
          }

          return (
            <React.Fragment key={msg.id}>
              {showRoundSep && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 py-1"
                >
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                    Round {currentMsgRound}
                  </span>
                  <div className="flex-1 h-px bg-white/5" />
                </motion.div>
              )}
              <div data-agent-id={msg.agentId}>
                <ConversationBubble
                  message={msg}
                  agentConfig={getConfig(msg.agentId)}
                  isHighlighted={isHighlighted}
                />
              </div>
            </React.Fragment>
          );
        })}
      </AnimatePresence>

      {/* Thinking indicator for next agent */}
      {activeAgentId && !messages.some(m => m.agentId === activeAgentId && m.isStreaming) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-3"
        >
          {(() => {
            const config = getConfig(activeAgentId);
            const Icon = config?.icon;
            return (
              <>
                {config && Icon && (
                  <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
                    <Icon size={14} className={config.textColor} />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: config ? `${config.borderRgba}0.8)` : 'rgba(255,255,255,0.3)' }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <span className={cn('text-[11px] uppercase tracking-widest font-bold', config?.textColor || 'text-slate-500')}>
                  Thinking...
                </span>
              </>
            );
          })()}
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
