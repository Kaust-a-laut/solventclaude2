import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { API_BASE_URL } from '../lib/config';
import { getSecret } from '../lib/api-client';
import { Swords, Sparkles, RefreshCw, AlertCircle, GitMerge } from 'lucide-react';
import { ModelPickerDropdown } from './ModelPickerDropdown';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_MODELS, toKey, fromKey } from '../lib/allModels';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DebateState {
  proponent: string | null;
  critic:    string | null;
  synthesis: string | null;
}

const EMPTY_DEBATE: DebateState = { proponent: null, critic: null, synthesis: null };

// ─── Panel config ───────────────────────────────────────────────────────────────

const PANEL_CONFIGS = {
  proponent: {
    label:     'PROPONENT',
    badgeCls:  'bg-jb-accent/10 border-jb-accent/25 text-jb-accent',
    borderCls: 'border-l-4 border-jb-accent',
    dotCls:    'bg-jb-accent',
    dotShadow: '0 0 8px rgba(60,113,247,0.8)',
  },
  critic: {
    label:     'CRITIC',
    badgeCls:  'bg-jb-orange/10 border-jb-orange/25 text-jb-orange',
    borderCls: 'border-l-4 border-jb-orange',
    dotCls:    'bg-jb-orange',
    dotShadow: '0 0 8px rgba(251,146,60,0.8)',
  },
} as const;

// ─── Sub-component: Debate panel ────────────────────────────────────────────────

interface DebatePanelProps {
  role:      'proponent' | 'critic';
  content:   string | null;
  agentName: string;
  isLoading: boolean;
}

const DebatePanel = ({ role, content, agentName, isLoading }: DebatePanelProps) => {
  const cfg = PANEL_CONFIGS[role];

  return (
    <div className={cn('glass-panel rounded-[1.5rem] overflow-hidden flex flex-col min-h-[260px]', cfg.borderCls)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <span className={cn(
            'px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border',
            cfg.badgeCls,
          )}>
            {cfg.label}
          </span>
          <span className="text-[11px] font-black text-white">{agentName}</span>
        </div>

        {/* Pulsing dots while loading */}
        {isLoading && (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                className={cn('w-1.5 h-1.5 rounded-full', cfg.dotCls)}
                style={{ boxShadow: cfg.dotShadow }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-5 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          {content ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="chat-bubble-ai liquid-message rounded-2xl p-5"
            >
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
            </motion.div>
          ) : isLoading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 pt-1"
            >
              {[75, 50, 65, 40].map((w, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded-full bg-white/[0.04] animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-12"
            >
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                Awaiting debate
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export const DebateArea = () => {
  const { deviceInfo } = useAppStore();
  const [isDebating, setIsDebating]         = useState(false);
  const [debate, setDebate]                 = useState<DebateState>(EMPTY_DEBATE);
  const [topic, setTopic]                   = useState('The future of Artificial Intelligence');
  const [proponentKey, setProponentKey]     = useState(toKey('gemini', 'gemini-3.1-pro-preview'));
  const [criticKey, setCriticKey]           = useState(toKey('ollama', 'qwen2.5-coder:7b'));
  const [error, setError]                   = useState<string | null>(null);

  const proponentLabel = ALL_MODELS.find(m => toKey(m.provider, m.model) === proponentKey)?.label ?? proponentKey;
  const criticLabel    = ALL_MODELS.find(m => toKey(m.provider, m.model) === criticKey)?.label ?? criticKey;

  const handleStartDebate = async () => {
    if (!topic.trim() || isDebating) return;
    setIsDebating(true);
    setError(null);
    setDebate(EMPTY_DEBATE);

    try {
      const secret   = await getSecret();
      const response = await fetch(`${API_BASE_URL}/debate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Solvent-Secret': secret },
        body:    JSON.stringify({
          topic,
          proponentModel: fromKey(proponentKey).model,
          proponentProvider: fromKey(proponentKey).provider,
          criticModel: fromKey(criticKey).model,
          criticProvider: fromKey(criticKey).provider,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Debate failed.');
      }

      const result      = await response.json();
      const rounds      = result.rounds ?? [];
      const proponent   = rounds.find((r: any) => r.role === 'proponent');
      const critic      = rounds.find((r: any) => r.role === 'critic');
      const synthesizer = rounds.find((r: any) => r.role === 'synthesizer');

      setDebate({
        proponent: proponent?.content   ?? null,
        critic:    critic?.content      ?? null,
        synthesis: synthesizer?.content ?? null,
      });
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
    } finally {
      setIsDebating(false);
    }
  };

  const hasContent = debate.proponent || debate.critic || debate.synthesis;

  return (
    <div className="flex flex-col h-full bg-black/20 backdrop-blur-3xl overflow-y-auto scrollbar-thin">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center border-b border-white/5 bg-black/40 shrink-0 transition-all duration-500',
        deviceInfo.isMobile ? 'px-6 pt-28 pb-8 h-auto' : 'px-12 h-28',
      )}>
        <div className="flex items-center gap-6">
          {/* Icon with dot accent */}
          <div className="relative w-14 h-14 bg-jb-orange/10 rounded-[2rem] flex items-center justify-center border border-jb-orange/20 shadow-2xl shrink-0">
            <div className="absolute inset-0 bg-jb-orange/10 rounded-[2rem] blur-xl opacity-70" />
            <Swords className="text-jb-orange relative z-10" size={26} />
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-jb-orange shadow-[0_0_10px_rgba(251,146,60,0.9)] animate-pulse" />
          </div>
          <div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.45em] block mb-1.5">
              Adversarial Debate Lab
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter leading-none">
              Dual-Model <span className="text-vibrant">Dialectic</span>
            </h2>
          </div>
        </div>
      </div>

      {/* ── Workspace ───────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex-1 flex flex-col gap-6 transition-all duration-500',
        deviceInfo.isMobile ? 'p-6' : 'p-12',
      )}>

        {/* Topic input */}
        <div className="glass-panel rounded-[2rem] overflow-hidden">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 p-5">
            <div className="flex-1">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest block mb-2">
                Debate Topic
              </span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartDebate(); }}
                placeholder="Enter a topic for the dialectic..."
                disabled={isDebating}
                className="w-full bg-transparent text-[14px] font-medium text-white placeholder:text-slate-700 outline-none input-focus-ring disabled:opacity-50 transition-opacity"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Proponent model selector */}
              <ModelPickerDropdown
                value={proponentKey}
                onChange={setProponentKey}
                models={ALL_MODELS}
                accent="blue"
                label="Proponent"
                disabled={isDebating}
              />

              {/* Critic model selector */}
              <ModelPickerDropdown
                value={criticKey}
                onChange={setCriticKey}
                models={ALL_MODELS}
                accent="orange"
                label="Critic"
                disabled={isDebating}
              />
              {/* Reset */}
              <AnimatePresence>
                {hasContent && !isDebating && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    onClick={() => setDebate(EMPTY_DEBATE)}
                    className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-500 hover:text-white transition-colors"
                  >
                    <RefreshCw size={14} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Ignite */}
              <button
                onClick={handleStartDebate}
                disabled={isDebating || !topic.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-jb-orange/15 border border-jb-orange/25 text-jb-orange text-[11px] font-black uppercase tracking-widest hover:bg-jb-orange/25 disabled:opacity-30 transition-all shadow-lg"
              >
                {isDebating ? (
                  <><RefreshCw size={13} className="animate-spin" /> Simulating...</>
                ) : (
                  <><Sparkles size={13} /> Ignite Debate</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/[0.08] border border-rose-500/20 text-rose-400"
            >
              <AlertCircle size={16} className="shrink-0" />
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest block mb-0.5">Simulation Error</span>
                <span className="text-xs">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Two-panel arena ────────────────────────────────────────────── */}
        <div className={cn(
          'grid gap-5',
          deviceInfo.isMobile ? 'grid-cols-1' : 'grid-cols-2',
        )}>
          <DebatePanel role="proponent" content={debate.proponent} agentName={proponentLabel} isLoading={isDebating} />
          <DebatePanel role="critic"    content={debate.critic}    agentName={criticLabel}   isLoading={isDebating} />
        </div>

        {/* ── Synthesis (full-width, purple) ─────────────────────────────── */}
        <AnimatePresence>
          {(isDebating || debate.synthesis) && (
            <motion.div
              key="synthesis"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="glass-panel rounded-[1.5rem] overflow-hidden border-l-4 border-jb-purple"
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/[0.04]">
                <GitMerge size={15} className="text-jb-purple shrink-0" />
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border bg-jb-purple/10 border-jb-purple/25 text-jb-purple">
                  SYNTHESIS
                </span>
                <h3 className="font-black tracking-tight text-sm">
                  <span className="text-vibrant">Synthesis</span>
                </h3>
                {/* Loading dots */}
                {isDebating && !debate.synthesis && (
                  <div className="ml-auto flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                        className="w-1.5 h-1.5 rounded-full bg-jb-purple"
                        style={{ boxShadow: '0 0 8px rgba(157,91,210,0.8)' }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  {debate.synthesis ? (
                    <motion.p
                      key="synthesis-content"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap"
                    >
                      {debate.synthesis}
                    </motion.p>
                  ) : (
                    <motion.div
                      key="synthesis-skeleton"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-3"
                    >
                      {[80, 60, 70, 45].map((w, i) => (
                        <div
                          key={i}
                          className="h-2.5 rounded-full bg-white/[0.04] animate-pulse"
                          style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Idle state ─────────────────────────────────────────────────── */}
        {!hasContent && !isDebating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6 py-20"
          >
            <div className="flex items-end gap-3">
              {[
                { color: 'bg-jb-accent',  glow: 'rgba(60,113,247,0.5)',  delay: 0   },
                { color: 'bg-jb-orange',  glow: 'rgba(251,146,60,0.5)',  delay: 0.5 },
                { color: 'bg-jb-purple',  glow: 'rgba(157,91,210,0.5)',  delay: 1.0 },
              ].map((dot, i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -7, 0], opacity: [0.25, 0.65, 0.25] }}
                  transition={{ repeat: Infinity, duration: 2.5, delay: dot.delay, ease: 'easeInOut' }}
                  className={cn('w-2.5 h-2.5 rounded-full', dot.color)}
                  style={{ boxShadow: `0 0 8px ${dot.glow}` }}
                />
              ))}
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-700 text-center">
              Enter a topic to ignite the dialectic
            </p>
          </motion.div>
        )}

      </div>
    </div>
  );
};
