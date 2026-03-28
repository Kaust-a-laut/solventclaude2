import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { API_BASE_URL } from '../lib/config';
import { getSecret } from '../lib/api-client';
import { GitCompare, Sparkles, RefreshCw, Bot, AlertCircle, Cloud, Shield } from 'lucide-react';
import { ModelPickerDropdown } from './ModelPickerDropdown';
import { ALL_MODELS, toKey, fromKey } from '../lib/allModels';
import { parse } from 'marked';
import DOMPurify from 'dompurify';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { BentoItem } from './BentoGrid';

export const CompareArea = () => {
  const { deviceInfo } = useAppStore();
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<{ model1: string; model2: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model1Key, setModel1Key] = useState(toKey('gemini', 'gemini-3.1-pro-preview'));
  const [model2Key, setModel2Key] = useState(toKey('ollama', 'qwen2.5-coder:7b'));
  const [error, setError] = useState<string | null>(null);

  const model1Label = ALL_MODELS.find(m => toKey(m.provider, m.model) === model1Key)?.label ?? model1Key;
  const model2Label = ALL_MODELS.find(m => toKey(m.provider, m.model) === model2Key)?.label ?? model2Key;

  const handleCompare = async () => {
    if (!prompt.trim()) return;
    setIsComparing(true);
    setResults(null);
    setError(null);

    try {
      const secret = await getSecret();
      const response = await fetch(`${API_BASE_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Solvent-Secret': secret },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model1: fromKey(model1Key).model,
          provider1: fromKey(model1Key).provider,
          model2: fromKey(model2Key).model,
          provider2: fromKey(model2Key).provider,
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Comparison failed.');
      setResults(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-black/20 backdrop-blur-3xl overflow-y-auto scrollbar-thin fluid-scrollbar transition-all duration-500",
      deviceInfo.isMobile ? "p-4 pt-28 pb-32" : "p-12"
    )}>
      
      <div className={cn(
        "flex mb-12 gap-8",
        deviceInfo.isMobile ? "flex-col items-start" : "items-center justify-between"
      )}>
        <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-jb-accent/10 rounded-[2rem] flex items-center justify-center border border-jb-accent/20 shadow-2xl relative group">
                <div className="absolute inset-0 bg-jb-accent/20 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <GitCompare className="text-jb-accent relative z-10" size={32} />
            </div>
            <div>
                <h2 className="text-3xl md:text-4xl font-[900] text-white tracking-tighter">Model Comparison <span className="text-vibrant">Lab</span></h2>
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Cross-benchmarking Neural Intelligence</p>
            </div>
        </div>

        <div className={cn(
          "flex gap-3 w-full",
          deviceInfo.isMobile ? "flex-col" : "md:w-auto"
        )}>
            <div className="relative group">
                <input 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
                  className={cn(
                    "bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-jb-accent/50 transition-all text-white placeholder:text-slate-600 font-bold backdrop-blur-xl",
                    deviceInfo.isMobile ? "w-full" : "w-[450px]"
                  )}
                  placeholder="Enter benchmarking objective..."
                />
            </div>
            {/* Model A selector */}
            <ModelPickerDropdown
              value={model1Key}
              onChange={setModel1Key}
              models={ALL_MODELS}
              accent="blue"
              label="Model A"
              disabled={isComparing}
            />

            {/* Model B selector */}
            <ModelPickerDropdown
              value={model2Key}
              onChange={setModel2Key}
              models={ALL_MODELS}
              accent="orange"
              label="Model B"
              disabled={isComparing}
            />
            <button
                onClick={handleCompare}
                disabled={isComparing || !prompt.trim()}
                className="bg-white text-black hover:bg-jb-accent hover:text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-20 shadow-[0_20px_40px_rgba(0,0,0,0.3)] group"
            >
                {isComparing ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />}
                {isComparing ? 'Processing' : 'Execute Test'}
            </button>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-4 backdrop-blur-md"
        >
            <AlertCircle size={20} />
            <div className="flex flex-col">
                <span className="font-black uppercase tracking-widest text-[11px]">Diagnostic Error</span>
                <span className="font-bold">{error}</span>
            </div>
        </motion.div>
      )}

      <div className={cn(
        "grid gap-8 pb-20",
        deviceInfo.isMobile ? "grid-cols-1" : "grid-cols-2"
      )}>
        
        {/* Model A Column */}
        <BentoItem delay={0.1} className="min-h-[500px] flex flex-col border-t-[3px] border-t-jb-accent">
            <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-jb-accent/10 border border-jb-accent/20 text-jb-accent">
                        <Bot size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white font-black text-sm uppercase tracking-tight">{model1Label}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Cloud size={10} className="text-slate-500" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{fromKey(model1Key).provider}</span>
                        </div>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-lg bg-jb-accent/10 border border-jb-accent/20 text-jb-accent text-[11px] font-black uppercase tracking-widest">
                   Model A
                </div>
            </div>
            <div className="flex-1 text-slate-300">
                {results ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="prose prose-invert prose-sm max-w-none leading-relaxed" 
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parse(results.model1 || '') as string) }}
                    />
                ) : (
                    <div className="h-full flex flex-col justify-center gap-4">
                        <div className="fluid-shimmer rounded-full h-4 w-3/4" />
                        <div className="fluid-shimmer rounded-full h-4 w-1/2" style={{ animationDelay: '0.3s' }} />
                        <div className="fluid-shimmer rounded-full h-4 w-5/6" style={{ animationDelay: '0.6s' }} />
                        <div className="fluid-shimmer rounded-full h-4 w-2/3" style={{ animationDelay: '0.9s' }} />
                    </div>
                )}
            </div>
        </BentoItem>

        {/* Model B Column */}
        <BentoItem delay={0.2} className="min-h-[500px] flex flex-col border-t-[3px] border-t-jb-orange">
            <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-jb-orange/10 border border-jb-orange/20 text-jb-orange">
                        <Bot size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white font-black text-sm uppercase tracking-tight">{model2Label}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Shield size={10} className="text-slate-500" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{fromKey(model2Key).provider}</span>
                        </div>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-lg bg-jb-orange/10 border border-jb-orange/20 text-jb-orange text-[11px] font-black uppercase tracking-widest">
                   Model B
                </div>
            </div>
            <div className="flex-1 text-slate-300">
                {results ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="prose prose-invert prose-sm max-w-none leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parse(results.model2 || '') as string) }}
                    />
                ) : (
                    <div className="h-full flex flex-col justify-center gap-4">
                        <div className="fluid-shimmer rounded-full h-4 w-3/4" />
                        <div className="fluid-shimmer rounded-full h-4 w-1/2" style={{ animationDelay: '0.3s' }} />
                        <div className="fluid-shimmer rounded-full h-4 w-5/6" style={{ animationDelay: '0.6s' }} />
                        <div className="fluid-shimmer rounded-full h-4 w-2/3" style={{ animationDelay: '0.9s' }} />
                    </div>
                )}
            </div>
        </BentoItem>

      </div>
    </div>
  );
};