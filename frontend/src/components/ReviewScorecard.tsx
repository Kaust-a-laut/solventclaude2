import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Search } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScorecardProps {
  score: number;
  breakdown: {
    syntax: number; // /20
    security: number; // /20
    logic: number; // /40
    efficiency: number; // /20
  };
  issues: string[];
  status: 'analyzing' | 'approved' | 'rejected';
  attempt: number;
}

export const ReviewScorecard: React.FC<ScorecardProps> = ({ score, breakdown, issues, status, attempt }) => {
  const isPassing = score >= 80;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute bottom-24 right-8 z-50 w-80 bg-[#050508]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
    >
      {/* Header Status */}
      <div className={cn(
        "px-6 py-4 flex items-center justify-between border-b border-white/5",
        status === 'rejected' ? "bg-rose-500/10" : status === 'approved' ? "bg-emerald-500/10" : "bg-white/5"
      )}>
        <div className="flex items-center gap-3">
          {status === 'analyzing' && <Search size={18} className="text-jb-accent animate-pulse" />}
          {status === 'rejected' && <XCircle size={18} className="text-rose-500" />}
          {status === 'approved' && <CheckCircle2 size={18} className="text-emerald-500" />}
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-widest text-white">
              {status === 'analyzing' ? 'Auditing Code...' : status === 'rejected' ? 'Validation Failed' : 'Production Ready'}
            </span>
            <span className="text-[11px] font-mono text-slate-500">Attempt #{attempt}</span>
          </div>
        </div>
        <div className={cn(
          "text-xl font-black font-mono",
          isPassing ? "text-emerald-400" : "text-rose-400"
        )}>
          {score}<span className="text-[11px] text-slate-500 ml-0.5">/100</span>
        </div>
      </div>

      {/* Rubric Breakdown */}
      <div className="p-6 space-y-4">
        <div className="space-y-3">
          <RubricItem label="Syntax & Types" value={breakdown?.syntax || 0} max={20} />
          <RubricItem label="Security Scan" value={breakdown?.security || 0} max={20} />
          <RubricItem label="Logic Compliance" value={breakdown?.logic || 0} max={40} />
          <RubricItem label="Efficiency" value={breakdown?.efficiency || 0} max={20} />
        </div>

        {/* Issues List (If Rejected) */}
        <AnimatePresence>
          {issues && issues.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="pt-4 border-t border-white/5"
            >
              <div className="flex items-center gap-2 mb-2 text-rose-400">
                <AlertTriangle size={12} />
                <span className="text-[11px] font-black uppercase tracking-widest">Critical Issues</span>
              </div>
              <ul className="space-y-1">
                {issues.slice(0, 3).map((issue, i) => (
                  <li key={i} className="text-[11px] text-slate-400 leading-relaxed pl-2 border-l border-rose-500/30">
                    {issue}
                  </li>
                ))}
                {issues.length > 3 && <li className="text-[11px] text-slate-600 italic">...and {issues.length - 3} more</li>}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Progress Bar (Bottom) */}
      <div className="h-1 w-full bg-white/5 relative">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full absolute left-0 top-0", isPassing ? "bg-emerald-500" : "bg-rose-500")}
        />
      </div>
    </motion.div>
  );
};

const RubricItem = ({ label, value, max }: { label: string, value: number, max: number }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
      <span>{label}</span>
      <span>{value}/{max}</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        className={cn("h-full rounded-full", value === max ? "bg-emerald-500" : value > max * 0.6 ? "bg-jb-accent" : "bg-rose-500")}
      />
    </div>
  </div>
);
