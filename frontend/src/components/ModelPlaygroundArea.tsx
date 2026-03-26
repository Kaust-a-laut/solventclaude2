import React from 'react';
import { motion } from 'framer-motion';
import { 
  Swords, GitCompare, Users, FlaskConical, 
  Layers, Zap, Sparkles, Binary
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { BentoGrid, BentoCard } from './BentoGrid';

export const ModelPlaygroundArea = () => {
  const { setCurrentMode } = useAppStore();

  const features = [
    {
      id: 'compare',
      title: 'Model Comparison',
      desc: 'Run identical prompts across multiple LLMs side-by-side. Analyze latency, quality, and logic variance in real-time.',
      icon: GitCompare,
      color: 'text-jb-accent',
      bg: 'bg-jb-accent/5',
      border: 'border-jb-accent/10',
      span: 'md:col-span-2',
      badge: 'Analytical'
    },
    {
      id: 'debate',
      title: 'Adversarial Debate',
      desc: 'Pitting models against each other to find the truth. One defends, one attacks, one mediates.',
      icon: Swords,
      color: 'text-jb-orange',
      bg: 'bg-jb-orange/5',
      border: 'border-jb-orange/10',
      badge: 'Heuristic'
    },
    {
      id: 'collaborate',
      title: 'Multi-Agent Swarm',
      desc: 'Orchestrate complex tasks by distributing load across specialized model personas working in parallel.',
      icon: Users,
      color: 'text-jb-cyan',
      bg: 'bg-jb-cyan/5',
      border: 'border-jb-cyan/10',
      badge: 'Scale'
    },
    {
      id: 'waterfall',
      title: 'Waterfall Architect',
      desc: 'The ultimate reasoning pipeline. 4-stage verification process for zero-error execution of complex tasks.',
      icon: FlaskConical,
      color: 'text-jb-purple',
      bg: 'bg-jb-purple/5',
      border: 'border-jb-purple/10',
      span: 'md:col-span-2',
      badge: 'Advanced'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12 pt-0 md:pt-0 lg:pt-0 bg-transparent relative z-10 scrollbar-thin">
      <div className="max-w-[1400px] mx-auto space-y-12 md:space-y-16 relative pl-4 md:pl-12 lg:pl-16">
        
        {/* Background Decorative Element */}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] opacity-[0.05] pointer-events-none blur-3xl overflow-hidden">
           <div className="w-full h-full bg-jb-purple rounded-full animate-pulse" />
        </div>

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between relative z-10 pt-8 md:pt-12 gap-8">
           <div className="space-y-6 max-w-3xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10"
              >
                 <Sparkles size={12} className="text-jb-accent" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Advanced Neural Laboratory</span>
              </motion.div>
              
              <div className="space-y-4">
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-tight"
                >
                   Model <span className="text-vibrant">Playground.</span>
                </motion.h2>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-slate-500 text-xl md:text-2xl font-medium leading-relaxed tracking-tight"
                >
                   A high-fidelity sandbox for stress-testing, comparing, and orchestrating the world's most capable foundation models.
                </motion.p>
              </div>
           </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 pt-4">
           {features.map((feature, idx) => (
             <BentoCard
               key={feature.id}
               {...feature}
               onClick={() => setCurrentMode(feature.id as any)}
               delay={idx * 0.1}
             />
           ))}
        </div>

        {/* Decorative Grid Footer */}
        <div className="pt-12 border-t border-white/[0.03] flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex gap-8">
              <div className="space-y-1">
                 <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Latency Matrix</p>
                 <p className="text-sm font-mono text-white/40">Sub-100ms Optimization</p>
              </div>
              <div className="space-y-1">
                 <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Inference Engine</p>
                 <p className="text-sm font-mono text-white/40">Hybrid Cloud/Edge</p>
              </div>
           </div>
           
           <p className="text-[10px] font-mono text-slate-700">SOLVENT.PLAYGROUND_V2.0 // BUILD_2026.01.19</p>
        </div>
      </div>
    </div>
  );
};
