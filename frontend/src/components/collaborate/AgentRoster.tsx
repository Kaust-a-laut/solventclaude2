import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentConfig } from './AgentCard';

interface AgentRosterProps {
  agents: Array<{ id: string; name: string; role: string }>;
  agentConfigs: AgentConfig[];
  activeAgentId: string | null;
  currentRound: number;
  maxRounds: number;
  consensusScore: number;
  status: string;
  visibleAgentIds?: Set<string>;
  onAgentHover?: (agentId: string | null) => void;
}

export const AgentRoster: React.FC<AgentRosterProps> = ({
  agents,
  agentConfigs,
  activeAgentId,
  currentRound,
  maxRounds,
  consensusScore,
  status,
  visibleAgentIds,
  onAgentHover,
}) => {
  const getConfig = (agentId: string) =>
    agentConfigs.find(c => c.role === agentId);

  return (
    <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-4 flex-shrink-0">
      {/* Agent icons */}
      <div className="flex items-center gap-3">
        {agents.map(agent => {
          const config = getConfig(agent.role || agent.id);
          const Icon = config?.icon;
          const isActive = activeAgentId === agent.id;
          const isVisible = visibleAgentIds?.has(agent.id) ?? false;
          const showVisibilityGlow = isVisible && !isActive;

          return (
            <div
              key={agent.id}
              className="flex items-center gap-1.5 cursor-pointer"
              onMouseEnter={() => onAgentHover?.(agent.id)}
              onMouseLeave={() => onAgentHover?.(null)}
            >
              <div className="relative">
                <div
                  className={cn(
                    'p-1.5 rounded-lg transition-all duration-300',
                    config?.bgColor || 'bg-white/5',
                    isActive && 'ring-1 ring-offset-1 ring-offset-transparent',
                  )}
                  style={{
                    boxShadow: isActive
                      ? `0 0 12px ${config?.glowRgba || 'rgba(255,255,255,0.1)'}`
                      : showVisibilityGlow
                        ? `0 0 8px ${config?.glowRgba || 'rgba(255,255,255,0.1)'}`
                        : 'none',
                  }}
                >
                  {Icon && <Icon size={12} className={config?.textColor || 'text-slate-400'} />}
                </div>
                {/* Active speaking dot */}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                    style={{ background: `${config?.borderRgba || 'rgba(255,255,255,'}0.9)` }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                )}
                {/* Visibility pulsing ring (when visible in feed but not actively speaking) */}
                {showVisibilityGlow && (
                  <motion.div
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    style={{
                      boxShadow: `0 0 0 1.5px ${config?.borderRgba || 'rgba(255,255,255,'}0.4)`,
                    }}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  />
                )}
              </div>
              <span className={cn(
                'text-[11px] font-black uppercase tracking-wider',
                isActive ? (config?.textColor || 'text-white') : 'text-slate-600',
              )}>
                {agent.name.split(' ').pop()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-white/10" />

      {/* Round indicator */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
          Round
        </span>
        <div className="flex items-center gap-1">
          {Array.from({ length: maxRounds }, (_, i) => (
            <div
              key={i}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all duration-300',
                i < currentRound ? 'bg-jb-purple' : 'bg-white/10',
              )}
            />
          ))}
        </div>
      </div>

      {/* Consensus bar */}
      {status !== 'idle' && consensusScore > 0 && (
        <>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex-shrink-0">
              Consensus
            </span>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: consensusScore >= 80
                    ? 'rgb(16, 185, 129)'
                    : consensusScore >= 50
                    ? 'rgb(157, 91, 210)'
                    : 'rgb(251, 146, 60)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${consensusScore}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className={cn(
              'text-[11px] font-black tabular-nums',
              consensusScore >= 80 ? 'text-emerald-400' : 'text-slate-500',
            )}>
              {consensusScore}%
            </span>
          </div>
        </>
      )}
    </div>
  );
};
