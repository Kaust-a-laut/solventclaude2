import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, ArrowUpRight, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { BASE_URL } from '../../lib/config';
import { cn } from '../../lib/utils';
import { staggerContainer, staggerItem } from './shared';
import { API_KEY_CONFIGS } from './settingsDefaults';

export const ApiKeysTab = () => {
  const { apiKeys, setApiKey } = useAppStore(
    useShallow((s) => ({ apiKeys: s.apiKeys, setApiKey: s.setApiKey }))
  );

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validationStatus, setValidationStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});

  const toggleKeyVisibility = (providerId: string) => {
    setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const validateKey = async (provider: string) => {
    const key = apiKeys[provider];
    if (!key) return;
    setValidationStatus(prev => ({ ...prev, [provider]: 'loading' }));
    try {
      const res = await fetch(`${BASE_URL}/api/settings/providers/${provider}/validate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      setValidationStatus(prev => ({ ...prev, [provider]: data.valid ? 'success' : 'error' }));
    } catch {
      setValidationStatus(prev => ({ ...prev, [provider]: 'error' }));
    }
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 gap-4">
      {API_KEY_CONFIGS.map(({ id, label, description, placeholder, docsUrl }) => (
        <motion.div key={id} variants={staggerItem} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col gap-4" id={`settings-api-${id}`}>
          {/* Row A: label + docs link */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-300">{label}</span>
              <span className="text-[10px] text-slate-500 font-medium leading-snug">{description}</span>
            </div>
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[9px] font-black text-jb-accent hover:text-white transition-colors uppercase tracking-widest flex-shrink-0"
            >
              Get key <ArrowUpRight size={10} />
            </a>
          </div>
          {/* Row B: input + controls */}
          <div className="flex gap-3">
            <input
              type={showKeys[id] ? "text" : "password"}
              value={apiKeys[id] || ''}
              onChange={e => setApiKey(id, e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-mono text-jb-accent outline-none focus:border-jb-accent/50 transition-all placeholder:text-slate-700"
            />
            <button
              onClick={() => toggleKeyVisibility(id)}
              className="p-3 text-slate-600 hover:text-white transition-colors flex-shrink-0"
            >
              {showKeys[id] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              onClick={() => validateKey(id)}
              disabled={!apiKeys[id] || validationStatus[id] === 'loading'}
              className="px-5 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {validationStatus[id] === 'loading'
                ? <><Loader2 size={12} className="animate-spin" /> Testing</>
                : 'Verify'
              }
            </button>
          </div>
          {/* Row C: validation badge */}
          {(validationStatus[id] === 'success' || validationStatus[id] === 'error') && (
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-bold",
              validationStatus[id] === 'success'
                ? "bg-emerald-400/10 border border-emerald-400/20 text-emerald-400"
                : "bg-rose-400/10 border border-rose-400/20 text-rose-400"
            )}>
              {validationStatus[id] === 'success'
                ? <><CheckCircle2 size={12} /> Key validated successfully</>
                : <><AlertCircle size={12} /> Validation failed — check your key and try again</>
              }
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
};
