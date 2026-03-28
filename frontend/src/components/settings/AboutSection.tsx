import React from 'react';
import { ArrowUpRight } from 'lucide-react';

declare const __BUILD_DATE__: string;

const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString();
const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

declare const __APP_VERSION__: string;

export const AboutSection = () => {
  const formattedDate = new Date(buildDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">About</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">Version</span>
          <span className="text-[11px] font-black text-jb-accent uppercase tracking-wider">{version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">Built</span>
          <span className="text-[11px] font-bold text-slate-500">{formattedDate}</span>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <a
          href="https://github.com/Kaust-a-laut/Solvent-Claude"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-black text-slate-600 hover:text-jb-accent uppercase tracking-widest transition-colors"
        >
          GitHub <ArrowUpRight size={8} />
        </a>
      </div>
    </div>
  );
};
