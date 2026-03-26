import React from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical, Code, Brain, MessageSquare,
  ScanEye, Globe, Sparkles, Terminal, ArrowRight
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { BentoGrid, BentoCard } from './BentoGrid';
import { MissionControlPreview } from './MissionControlPreview';
import { Logo } from './Logo';

export const HomeArea = () => {
  const { setCurrentMode, setIsCommandCenterOpen, setSettingsOpen, setSettingsInitialTab } = useAppStore();

  const features = [
    {
      id: 'waterfall',
      title: 'Waterfall Architect',
      desc: 'Autonomous multi-model reasoning pipeline. Collapses complex projects into 4-stage verified execution.',
      icon: FlaskConical,
      color: 'text-jb-purple',
      bg: 'bg-jb-purple/5',
      border: 'border-jb-purple/10',
      span: 'lg:col-span-2',
      badge: 'Core',
      hoverBorder: 'group-hover:border-jb-purple/30',
      badgeColor: 'bg-jb-purple/10 border border-jb-purple/20 text-jb-purple/80',
    },
    {
      id: 'command_center',
      title: 'Take control with the Solvent Command Center',
      desc: 'Deep-integrated persistent context and data storage. Detach your mission directives into a PiP window to maintain autonomous oversight across your entire OS and other applications.',
      icon: Terminal,
      color: 'text-jb-purple',
      bg: 'bg-jb-purple/5',
      border: 'border-jb-purple/10',
      span: 'lg:row-span-2',
      preview: <MissionControlPreview />,
      actionText: 'Launch Mission Control',
      hoverBorder: 'group-hover:border-jb-purple/30',
    },
    {
      id: 'coding',
      title: 'Agentic IDE',
      desc: 'Next-gen coding workspace with autonomous agents, real-time refactoring, and terminal integration.',
      icon: Code,
      color: 'text-jb-accent',
      bg: 'bg-jb-accent/5',
      border: 'border-jb-accent/10',
      span: 'lg:col-span-1',
      hoverBorder: 'group-hover:border-jb-accent/30',
    },
    {
      id: 'vision',
      title: 'SolventSee Lab',
      desc: 'High-fidelity vision & media forge. Analyze UI, generate assets, and edit imagery with precision.',
      icon: ScanEye,
      color: 'text-jb-orange',
      bg: 'bg-jb-orange/5',
      border: 'border-jb-orange/10',
      actionText: 'Dive into the SolventSee Lab',
      hoverBorder: 'group-hover:border-jb-orange/30',
    },
    {
      id: 'browser',
      title: 'Universal Browser',
      desc: 'AI-native web experience. Browse, scrape, and extract intelligence without leaving the interface.',
      icon: Globe,
      color: 'text-jb-cyan',
      bg: 'bg-jb-cyan/5',
      border: 'border-jb-cyan/10',
      hoverBorder: 'group-hover:border-jb-cyan/30',
    },
    {
      id: 'model_playground',
      title: 'Model Playground',
      desc: 'Harness GPT, Gemini, and Ollama in a unified sandbox. High-fidelity reasoning with zero switching friction.',
      icon: MessageSquare,
      color: 'text-jb-cyan',
      bg: 'bg-jb-cyan/5',
      border: 'border-jb-cyan/10',
      hoverBorder: 'group-hover:border-jb-cyan/30',
    },
    {
      id: 'memory',
      title: 'Project Memory',
      desc: 'Semantic vector knowledge base. Search, inspect, and manage what Solvent remembers about your project — crystallized insights, episodic context, and meta-summaries.',
      icon: Brain,
      color: 'text-jb-purple',
      bg: 'bg-jb-purple/5',
      border: 'border-jb-purple/10',
      actionText: 'Explore Memory',
      hoverBorder: 'group-hover:border-jb-purple/30',
    }
  ];

  const showcaseItems = [
    {
      id: 'waterfall',
      category: 'Reasoning Pipeline',
      title: 'Waterfall Architect',
      desc: 'Autonomous multi-model reasoning that collapses complex projects into four sequential, verified execution stages. Nothing advances until the previous stage is confirmed.',
      bullets: [
        'Decomposes any project goal into Decompose → Plan → Execute → Verify stages',
        'Each stage is cross-checked before the next begins — no hallucination propagation',
        'Coordinates multiple models in sequence, not competition',
      ],
      icon: FlaskConical,
      color: 'text-jb-purple',
      bg: 'bg-jb-purple/5',
      border: 'border-jb-purple/15',
      accentColor: '#9D5BD2',
      tag: 'Pipeline',
      actionText: 'Open Waterfall',
      mode: 'waterfall' as const,
      visual: (
        <div className="absolute inset-0 flex items-center justify-center z-20 px-10 py-8">
          <div className="w-full space-y-0">
            {[
              { label: 'Decompose', state: 'done',    num: '01', rowCls: 'border-jb-accent/30 bg-jb-accent/[0.08]',   dotCls: 'bg-jb-accent/70',                             textCls: 'text-jb-accent/70',  tagCls: 'text-jb-accent/40' },
              { label: 'Plan',      state: 'done',    num: '02', rowCls: 'border-rose-400/20 bg-rose-400/[0.05]',      dotCls: 'bg-rose-400/50',                              textCls: 'text-rose-400/60',   tagCls: 'text-rose-400/40' },
              { label: 'Execute',   state: 'active',  num: '03', rowCls: 'border-jb-orange/50 bg-jb-orange/[0.12] shadow-[0_0_14px_rgba(251,146,60,0.12)]', dotCls: 'bg-jb-orange/80 animate-pulse', textCls: 'text-white/85',      tagCls: 'text-jb-orange/60' },
              { label: 'Verify',    state: 'pending', num: '04', rowCls: 'border-white/[0.05] bg-black/30',            dotCls: 'border border-white/15 bg-transparent',       textCls: 'text-white/20',      tagCls: '' },
            ].map((stage, i) => (
              <div key={stage.label} className="flex flex-col items-center">
                <div className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border ${stage.rowCls}`}>
                  <span className="text-[8px] font-black font-mono text-white/20">{stage.num}</span>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${stage.dotCls}`} />
                  <span className={`text-[9px] font-black uppercase tracking-[0.2em] flex-1 ${stage.textCls}`}>{stage.label}</span>
                  {stage.state === 'done'    && <span className={`text-[7px] font-mono ${stage.tagCls}`}>verified ✓</span>}
                  {stage.state === 'active'  && <span className="text-[7px] font-mono text-jb-orange/60 animate-pulse">running…</span>}
                  {stage.state === 'pending' && <span className="text-[7px] font-mono text-white/15">queued</span>}
                </div>
                {i < 3 && <div className={`w-px h-2.5 ${i === 0 ? 'bg-jb-accent/15' : i === 1 ? 'bg-rose-400/15' : 'bg-jb-orange/20'}`} />}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'command_center',
      category: 'Mission Control',
      title: 'Command Center',
      desc: 'Deep-integrated persistent context and mission memory. Detach into a floating PiP window and maintain autonomous oversight across your entire OS — without ever leaving your flow.',
      bullets: [
        'Persistent context that survives across sessions and app switches',
        'Detachable PiP window for multi-application oversight',
        'Mission-directive memory with real-time status tracking',
      ],
      icon: Terminal,
      color: 'text-jb-purple',
      bg: 'bg-jb-purple/5',
      border: 'border-jb-purple/15',
      accentColor: '#9D5BD2',
      tag: 'Control',
      actionText: 'Launch Mission Control',
      mode: 'command_center' as const,
      visual: (
        <div className="absolute inset-0 p-6 z-20 flex flex-col justify-between">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
              <span className="text-[7px] font-black uppercase tracking-[0.25em] text-emerald-500/60">Live</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-jb-orange/30 bg-jb-orange/10">
              <div className="w-2.5 h-2 rounded-sm border border-jb-orange/50 bg-transparent" />
              <span className="text-[7px] font-black tracking-wider text-jb-orange/70">PiP</span>
            </div>
          </div>
          {/* Dashboard tool cards */}
          <div className="grid grid-cols-2 gap-2 flex-1">
            {[
              { label: 'MISSIONS', desc: 'Multi-agent war room', iconCls: 'text-indigo-400',  cardCls: 'border-indigo-400/10 bg-indigo-400/[0.04]',  dotCls: 'bg-indigo-400/50' },
              { label: 'NOTES',    desc: 'Context & directives', iconCls: 'text-amber-400',   cardCls: 'border-amber-400/10 bg-amber-400/[0.04]',    dotCls: 'bg-amber-400/50'  },
              { label: 'CODE',     desc: 'IDE control panel',     iconCls: 'text-jb-accent',   cardCls: 'border-jb-accent/10 bg-jb-accent/[0.04]',    dotCls: 'bg-jb-accent/50'  },
              { label: 'FLOW',     desc: 'Waterfall pipeline',   iconCls: 'text-jb-purple',   cardCls: 'border-jb-purple/10 bg-jb-purple/[0.04]',    dotCls: 'bg-jb-purple/50'  },
            ].map((t) => (
              <div key={t.label} className={`relative rounded-xl border px-3 py-2.5 flex flex-col justify-between overflow-hidden ${t.cardCls}`}>
                <div className="absolute top-0 right-0 w-8 h-px bg-white/[0.06]" />
                <div className="absolute top-0 right-0 w-px h-8 bg-white/[0.06]" />
                <div className={`w-3 h-3 rounded-full mb-2 ${t.dotCls}`} />
                <div>
                  <div className={`text-[8px] font-black uppercase tracking-[0.2em] ${t.iconCls}`}>{t.label}</div>
                  <div className="text-[7px] text-white/25 mt-0.5 leading-tight">{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'coding',
      category: 'Agentic IDE',
      title: 'Coding Suite',
      desc: 'A next-generation workspace where autonomous agents write, test, and refactor alongside you. Monaco editor, AI inline commands, and a live WebContainer sandbox — all in one surface.',
      bullets: [
        'Autonomous agents that write, test, and refactor code in real time',
        'Monaco editor with AI-powered inline commands and diff previews',
        'Integrated terminal and WebContainer sandboxing for instant execution',
      ],
      icon: Code,
      color: 'text-jb-cyan',
      bg: 'bg-jb-cyan/5',
      border: 'border-jb-cyan/15',
      accentColor: '#06B6D4',
      tag: 'IDE',
      actionText: 'Open Coding Suite',
      mode: 'coding' as const,
      visual: (
        <div className="absolute inset-x-6 bottom-6 top-6 z-20 rounded-xl border border-white/[0.05] bg-black/40 overflow-hidden flex">
          {/* File tree strip */}
          <div className="w-10 border-r border-white/[0.04] bg-black/30 flex flex-col gap-1.5 pt-3 px-1.5">
            {['bg-jb-accent/40', 'bg-white/20', 'bg-jb-orange/30', 'bg-white/15', 'bg-jb-cyan/30', 'bg-white/10'].map((c, i) => (
              <div key={i} className={`h-1 rounded-full ${c} ${i === 0 ? 'w-full' : i % 2 === 0 ? 'w-5/6' : 'w-3/4'}`} />
            ))}
          </div>
          {/* Editor pane */}
          <div className="flex-1 p-3 space-y-1.5">
            <div className="flex gap-2 mb-2.5">
              {['bg-jb-accent/20 border-jb-accent/30', 'bg-black/20 border-white/[0.06]'].map((cls, i) => (
                <div key={i} className={`h-5 w-16 rounded-t-md border-b-0 border px-2 flex items-center ${cls}`}>
                  <div className={`h-1 rounded-full w-full ${i === 0 ? 'bg-jb-accent/40' : 'bg-white/15'}`} />
                </div>
              ))}
            </div>
            {[
              { w: 'w-3/4', c: 'bg-jb-orange/35' },
              { w: 'w-1/2', c: 'bg-jb-accent/30' },
              { w: 'w-5/6', c: 'bg-white/12' },
              { w: 'w-2/3', c: 'bg-jb-cyan/25' },
              { w: 'w-4/5', c: 'bg-jb-accent/20' },
              { w: 'w-1/3', c: 'bg-jb-orange/20' },
              { w: 'w-3/5', c: 'bg-white/8' },
            ].map((line, i) => (
              <div key={i} className={`h-1.5 rounded-full ${line.w} ${line.c}`} />
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'vision',
      category: 'Vision & Media',
      title: 'SolventSee Lab',
      desc: 'High-fidelity vision and media analysis. Upload screenshots, UI designs, or imagery and get precise multi-modal reasoning with annotated output and generative asset creation.',
      bullets: [
        'Analyze UI screenshots, diagrams, and imagery with precision',
        'Multi-modal reasoning with annotated, structured output',
        'Generate and edit visual assets directly from natural language',
      ],
      icon: ScanEye,
      color: 'text-jb-orange',
      bg: 'bg-jb-orange/5',
      border: 'border-jb-orange/15',
      accentColor: '#FB923C',
      tag: 'Vision',
      actionText: 'Open SolventSee Lab',
      mode: 'vision' as const,
      visual: (
        <div className="absolute inset-x-10 inset-y-7 z-20 flex flex-col gap-2">
          {/* Main analysis frame */}
          <div className="flex-1 border border-dashed border-jb-orange/30 rounded-xl relative bg-black/20">
            {/* Corner brackets */}
            {([['top-0 left-0', '2px 0 0 2px'], ['top-0 right-0', '2px 2px 0 0'], ['bottom-0 left-0', '0 0 2px 2px'], ['bottom-0 right-0', '0 2px 2px 0']] as [string, string][]).map(([pos, bw], i) => (
              <div key={i} className={`absolute ${pos} w-3 h-3 border-jb-orange/60`} style={{ borderWidth: bw }} />
            ))}
            {/* Crosshair target */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full border border-jb-orange/35 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-jb-orange/55" />
              </div>
            </div>
            {/* Annotation tag */}
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded border border-jb-accent/30 bg-jb-accent/10">
              <span className="text-[7px] font-black text-jb-accent/70 tracking-wider">UI</span>
            </div>
            {/* Confidence bar */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[6px] font-mono text-white/25">confidence</span>
                <span className="text-[6px] font-mono text-jb-accent/50">94%</span>
              </div>
              <div className="h-0.5 rounded-full bg-white/[0.06] w-full">
                <div className="h-full rounded-full bg-jb-accent/50 w-[94%]" />
              </div>
            </div>
          </div>
          {/* Output row */}
          <div className="flex gap-2">
            {[
              { w: 'flex-1', cls: 'border-jb-orange/15 bg-jb-orange/[0.05]', label: 'Object', val: 'Button' },
              { w: 'flex-1', cls: 'border-jb-accent/15 bg-jb-accent/[0.05]', label: 'State',  val: 'Active' },
            ].map((t) => (
              <div key={t.label} className={`${t.w} rounded-lg border ${t.cls} px-2 py-1.5`}>
                <div className="text-[6px] uppercase tracking-wider text-white/20">{t.label}</div>
                <div className="text-[9px] font-black text-white/50">{t.val}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'browser',
      category: 'Web Intelligence',
      title: 'Universal Browser',
      desc: 'An AI-native web experience that browses, scrapes, and extracts intelligence without leaving the interface. Search-augmented reasoning built for deep research and real-time data.',
      bullets: [
        'AI-native browsing with intelligent content extraction',
        'Scrape and summarize any web page in one step',
        'Search-augmented reasoning for real-time, grounded answers',
      ],
      icon: Globe,
      color: 'text-jb-cyan',
      bg: 'bg-jb-cyan/5',
      border: 'border-jb-cyan/15',
      accentColor: '#06B6D4',
      tag: 'Browser',
      actionText: 'Open Browser',
      mode: 'browser' as const,
      visual: (
        <div className="absolute inset-x-7 bottom-7 top-7 z-20 rounded-xl border border-white/[0.06] bg-black/50 overflow-hidden flex flex-col">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05] bg-black/30 shrink-0">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-jb-orange/50" />
              <div className="w-2 h-2 rounded-full bg-white/15" />
              <div className="w-2 h-2 rounded-full bg-jb-accent/30" />
            </div>
            <div className="flex-1 flex items-center gap-1.5 h-4 rounded-md bg-white/[0.04] border border-white/[0.05] px-2">
              <div className="w-1.5 h-1.5 rounded-full bg-jb-orange/40 shrink-0" />
              <div className="h-1 rounded-full bg-white/10 flex-1" />
            </div>
          </div>
          {/* Page content */}
          <div className="flex-1 p-3 space-y-2">
            <div className="h-2 rounded-full bg-white/10 w-3/4" />
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-jb-accent/20 w-full" />
              <div className="h-1.5 rounded-full bg-white/[0.07] w-5/6" />
              <div className="h-1.5 rounded-full bg-white/[0.07] w-4/5" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="flex-1 h-8 rounded-lg border border-jb-orange/15 bg-jb-orange/[0.05] flex items-center px-2 gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-jb-orange/50" />
                <div className="h-1 rounded-full bg-jb-orange/25 flex-1" />
              </div>
              <div className="flex-1 h-8 rounded-lg border border-white/[0.05] bg-white/[0.02] flex items-center px-2 gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <div className="h-1 rounded-full bg-white/10 flex-1" />
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="h-1.5 rounded-full bg-jb-cyan/20 w-full" />
              <div className="h-1.5 rounded-full bg-white/[0.06] w-2/3" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'model_playground',
      category: 'Model Lab',
      title: 'Model Lab',
      desc: 'Harness GPT, Gemini, and local models in a unified sandbox. Compare reasoning, run side-by-side debates, and build multi-agent workflows — with zero switching friction.',
      bullets: [
        'Run and compare multiple models side by side in real time',
        'Structured debate mode pits models against each other on any topic',
        'Multi-agent collaboration with shared context and memory',
      ],
      icon: Sparkles,
      color: 'text-jb-purple',
      bg: 'bg-jb-purple/5',
      border: 'border-jb-purple/15',
      accentColor: '#9D5BD2',
      tag: 'Lab',
      actionText: 'Open Model Lab',
      mode: 'model_playground' as const,
      visual: (
        <div className="absolute inset-x-7 bottom-7 top-7 z-20 flex flex-col gap-2">
          {/* Header bar */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[7px] font-black uppercase tracking-[0.25em] text-white/20">Comparing</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-jb-accent/50" />
              <div className="w-1.5 h-1.5 rounded-full bg-jb-orange/50" />
            </div>
          </div>
          {/* Model panels */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            {[
              { name: 'GPT-4',   cls: 'border-jb-accent/20 bg-jb-accent/[0.05]',  labelCls: 'text-jb-accent/70',  bars: ['bg-jb-accent/35 w-4/5', 'bg-jb-accent/20 w-3/5', 'bg-jb-accent/25 w-full', 'bg-jb-accent/15 w-2/3'] },
              { name: 'Gemini',  cls: 'border-jb-orange/20 bg-jb-orange/[0.05]',  labelCls: 'text-jb-orange/70', bars: ['bg-jb-orange/30 w-3/5', 'bg-jb-orange/20 w-4/5', 'bg-jb-orange/20 w-1/2', 'bg-jb-orange/15 w-full'] },
            ].map((m) => (
              <div key={m.name} className={`rounded-xl border ${m.cls} p-2.5 flex flex-col gap-2`}>
                <div className={`text-[8px] font-black uppercase tracking-[0.2em] ${m.labelCls}`}>{m.name}</div>
                <div className="flex-1 space-y-1.5">
                  {m.bars.map((b, i) => (
                    <div key={i} className={`h-1 rounded-full ${b}`} />
                  ))}
                </div>
                <div className={`text-[7px] font-mono ${m.labelCls} opacity-60`}>responding…</div>
              </div>
            ))}
          </div>
          {/* Prompt bar */}
          <div className="h-7 rounded-lg border border-white/[0.05] bg-black/40 flex items-center px-3 gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/[0.07]" />
            <div className="w-4 h-4 rounded-md bg-jb-accent/20 border border-jb-accent/25 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-sm bg-jb-accent/50" />
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 relative bg-transparent z-10">
      <div className="absolute inset-0 overflow-y-scroll scrollbar-thin p-6 md:p-10 lg:p-12 pt-2 md:pt-4 lg:pt-6">
      <div className="max-w-[1400px] mx-auto space-y-4 md:space-y-6 relative">
        
        {/* Massive Background Beaker Logo - Using new Logo component */}
        <div className="absolute -top-60 -left-60 w-[600px] h-[600px] md:w-[1000px] md:h-[1000px] opacity-[0.03] pointer-events-none blur-3xl overflow-hidden">
           <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
              <path d="M38 20 L38 45 L18 82 Q15 88 22 88 L78 88 Q85 88 82 82 L62 45 L62 20 Z" />
           </svg>
        </div>

        {/* Hero Header — beaker left, text inset into its right edge */}
        <div className="relative z-10">

          <div className="flex flex-col md:flex-row items-center">

            {/* Beaker — left column */}
            <div className="shrink-0 w-full md:w-[45%] flex justify-center md:justify-start pointer-events-none mb-4 md:mb-0">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 80, delay: 0.4 }}
                className="w-[200px] h-[200px] md:w-full md:h-auto md:aspect-square relative opacity-[0.18] md:opacity-[0.28]"
              >
                {/* Enhanced ambient glow layers */}
                <div className="absolute inset-x-16 inset-y-8 bg-jb-purple/25 blur-[80px] rounded-full animate-pulse" />
                <div className="absolute inset-x-24 inset-y-16 bg-jb-orange/15 blur-[60px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute inset-x-20 inset-y-12 bg-jb-accent/10 blur-[70px] rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />

                <Logo size="xl" variant="hero" animated={true} />
              </motion.div>
            </div>

            {/* Text column — heading + paragraph */}
            <div className="md:flex-1 flex flex-col gap-4 md:gap-6">

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative z-10 font-black text-white tracking-tighter leading-[1.05] text-center md:text-left"
                style={{ fontSize: 'clamp(2rem, 4.5vw + 0.5rem, 5.5rem)' }}
              >
                The Multitool <span className="text-vibrant">AI OS</span> for{' '}
                <span className="text-vibrant">Engineering</span> Physical{' '}
                <span className="text-vibrant">Reality</span>.
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="vibrant-border relative max-w-3xl rounded-2xl mx-auto md:mx-0"
              >
                <div className="relative rounded-2xl bg-[#020205] px-8 py-5">
                  <p className="text-center md:text-left text-white/60 text-base md:text-lg font-medium leading-relaxed tracking-tight">
                    A consolidated digital workspace designed to bridge the gap between intelligence and execution. From autonomous code to physical outcomes, one interface for everything.
                  </p>
                </div>
              </motion.div>

            </div>

          </div>

        </div>

        {/* Bento Grid - Enhanced scaling */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-dense gap-4 md:gap-6">
           {features.map((feature, idx) => (
             <BentoCard
               key={feature.id}
               {...feature}
               onClick={() => {
                 if (feature.id === 'command_center') {
                   setIsCommandCenterOpen(true);
                 } else if (feature.id === 'memory') {
                   setSettingsInitialTab('memory');
                   setSettingsOpen(true);
                 } else {
                   setCurrentMode(feature.id as any);
                 }
               }}
               delay={idx * 0.1}
             />
           ))}
        </div>

        {/* Mode Showcase Strip */}
        <div className="border-t border-white/[0.03] pt-16 md:pt-24 space-y-24 md:space-y-32 pb-16">
          <div className="text-center space-y-2">
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/20">Explore the suite</p>
            <h2 className="text-2xl md:text-3xl font-black text-white/60 tracking-tight">Every tool. One surface.</h2>
          </div>

          {showcaseItems.map((item, idx) => {
            const Icon = item.icon;
            const isReversed = idx % 2 === 1;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`flex flex-col lg:flex-row gap-10 lg:gap-16 xl:gap-24 items-center ${isReversed ? 'lg:flex-row-reverse' : ''}`}
              >
                {/* Visual panel */}
                <div className="w-full lg:w-1/2 shrink-0">
                  <div
                    className={`relative rounded-3xl border overflow-hidden ${item.bg} ${item.border}`}
                    style={{ aspectRatio: '16/10' }}
                  >
                    {/* Dot grid */}
                    <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                    {/* Glow orb */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-64 h-64 rounded-full blur-[80px] opacity-20" style={{ background: item.accentColor }} />
                    </div>
                    {/* Large faint icon */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Icon size={120} className={item.color} style={{ opacity: 0.07 }} strokeWidth={0.75} />
                    </div>
                    {/* HUD corner lines */}
                    <div className="absolute top-0 left-0 w-12 h-px bg-white/[0.06]" />
                    <div className="absolute top-0 left-0 w-px h-12 bg-white/[0.06]" />
                    <div className="absolute bottom-0 right-0 w-12 h-px bg-white/[0.06]" />
                    <div className="absolute bottom-0 right-0 w-px h-12 bg-white/[0.06]" />
                    {/* Tag */}
                    <div className="absolute top-4 left-4 text-[8px] font-black uppercase tracking-[0.25em] font-mono opacity-40" style={{ color: item.accentColor }}>
                      {item.tag}
                    </div>
                    {/* Mode-specific decoration */}
                    {item.visual}
                  </div>
                </div>

                {/* Text panel */}
                <div className="w-full lg:w-1/2 space-y-5">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${item.bg} ${item.border}`}>
                    <Icon size={20} className={item.color} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">{item.category}</p>
                    <h3 className="text-3xl lg:text-4xl xl:text-[2.75rem] font-black text-white tracking-tighter leading-[1.05]">{item.title}</h3>
                  </div>
                  <p className="text-white/45 text-base lg:text-[17px] leading-relaxed">{item.desc}</p>
                  <ul className="space-y-2.5">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm text-white/35">
                        <span className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style={{ background: item.accentColor, opacity: 0.7 }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.id === 'command_center') setIsCommandCenterOpen(true);
                      else setCurrentMode(item.mode);
                    }}
                    className={`mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all hover:gap-3 ${item.bg} ${item.border} ${item.color} hover:opacity-80`}
                  >
                    {item.actionText}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      </div>{/* close absolute inset-0 scroll container */}
    </div>
  );
};
