import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentConfig } from './AgentCard';
import type { CollaborateMessage } from '../../store/collaborateSlice';

interface ConversationBubbleProps {
  message: CollaborateMessage;
  agentConfig?: AgentConfig;
  isHighlighted?: boolean;
}

export const ConversationBubble: React.FC<ConversationBubbleProps> = ({
  message,
  agentConfig,
  isHighlighted,
}) => {
  const isUser = message.agentId === 'user';
  const displayContent = message.isStreaming
    ? message.streamingContent || ''
    : message.content;

  // Resolve the effective type — streaming messages always render as "contribution"
  const effectiveType = message.isStreaming ? 'contribution' : (message.type || 'contribution');

  // Derive the agent color string for border/glow usage
  const agentBorderColor = agentConfig?.borderRgba ? `${agentConfig.borderRgba}0.5)` : undefined;

  // ── Type-specific style classes ────────────────────────────────────────────
  const typeStyles = (() => {
    if (isUser) return '';
    switch (effectiveType) {
      case 'agreement':
        return 'border-l-2 border-l-emerald-500/30';
      case 'disagreement':
        return 'border-l-4';
      case 'delegation':
        return 'border border-dashed border-white/10';
      default:
        return '';
    }
  })();

  // For disagreement, override border color with agent's color
  const disagreementBorderStyle = effectiveType === 'disagreement' && agentBorderColor
    ? { borderLeftColor: agentBorderColor }
    : undefined;

  // Highlight opacity for hover-to-highlight
  const highlightOpacity = isHighlighted === undefined
    ? 1
    : isHighlighted
      ? 1
      : 0.3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: highlightOpacity, y: 0 }}
      transition={{ duration: 0.3, opacity: { duration: 0.2 } }}
      className={cn(
        'flex gap-3 max-w-[85%]',
        isUser ? 'ml-auto flex-row-reverse' : '',
      )}
      style={isUser ? { filter: `drop-shadow(0 0 15px rgba(60,113,247,0.08))` } : undefined}
    >
      {/* Avatar */}
      {!isUser && agentConfig && (
        <div
          className={cn('flex-shrink-0 p-1.5 rounded-lg h-fit mt-0.5', agentConfig.bgColor)}
          style={{
            boxShadow: message.isStreaming
              ? `0 0 10px ${agentConfig.glowRgba}`
              : 'none',
          }}
        >
          <agentConfig.icon size={14} className={agentConfig.textColor} />
        </div>
      )}

      {/* Bubble content */}
      <div
        className={cn(
          'rounded-2xl px-4 py-3 space-y-1.5',
          isUser
            ? 'bg-jb-accent/15 border border-jb-accent/20'
            : 'glass-card',
          typeStyles,
        )}
        style={disagreementBorderStyle}
      >
        {/* Agent name + addressing */}
        <div className="flex items-center gap-2">
          {!isUser && agentConfig ? (
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{
                background: `linear-gradient(135deg, ${agentConfig.borderRgba}1) 0%, ${agentConfig.borderRgba}0.6) 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {message.agentName}
            </span>
          ) : (
            <span className={cn(
              'text-[9px] font-black uppercase tracking-widest',
              isUser ? 'text-jb-accent' : 'text-slate-400',
            )}>
              {message.agentName}
            </span>
          )}
          {message.addressing && (
            <span className="text-[8px] text-slate-600 font-medium">
              responding to <span className="text-slate-400">{message.addressing}</span>
            </span>
          )}
        </div>

        {/* Message text */}
        <p className={cn(
          'text-[13px] leading-relaxed whitespace-pre-wrap',
          effectiveType === 'agreement' ? 'italic text-slate-400' : 'text-slate-300',
        )}>
          {displayContent}
          {message.isStreaming && (
            <motion.span
              className="inline-block w-1.5 h-4 ml-0.5 rounded-sm align-middle"
              style={{ background: agentConfig?.borderRgba ? `${agentConfig.borderRgba}0.8)` : 'rgba(255,255,255,0.5)' }}
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            />
          )}
        </p>

        {/* Delegation badge */}
        {effectiveType === 'delegation' && message.addressing && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
              Handing off to {message.addressing}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
