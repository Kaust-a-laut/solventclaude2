import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Globe, ChevronDown, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { API_BASE_URL } from '../../lib/config';
import { cn } from '../../lib/utils';
import { staggerContainer, staggerItem } from './shared';
import { SETTINGS_DEFAULTS } from './settingsDefaults';
import { CustomSelect, type SelectOption } from './CustomSelect';

export const ModelsTab = () => {
  const {
    globalProvider, setGlobalProvider,
    selectedCloudModel, setSelectedCloudModel,
    selectedLocalModel, setSelectedLocalModel,
    selectedCloudProvider, setSelectedCloudProvider,
    selectedOpenRouterModel, setSelectedOpenRouterModel,
    imageProvider, setImageProvider,
    localImageUrl, setLocalImageUrl,
    modeConfigs, setModeConfig,
  } = useAppStore(
    useShallow((s) => ({
      globalProvider: s.globalProvider, setGlobalProvider: s.setGlobalProvider,
      selectedCloudModel: s.selectedCloudModel, setSelectedCloudModel: s.setSelectedCloudModel,
      selectedLocalModel: s.selectedLocalModel, setSelectedLocalModel: s.setSelectedLocalModel,
      selectedCloudProvider: s.selectedCloudProvider, setSelectedCloudProvider: s.setSelectedCloudProvider,
      selectedOpenRouterModel: s.selectedOpenRouterModel, setSelectedOpenRouterModel: s.setSelectedOpenRouterModel,
      imageProvider: s.imageProvider, setImageProvider: s.setImageProvider,
      localImageUrl: s.localImageUrl, setLocalImageUrl: s.setLocalImageUrl,
      modeConfigs: s.modeConfigs, setModeConfig: s.setModeConfig,
    }))
  );

  const [availableModels, setAvailableModels] = useState<{
    ollama: any[]; gemini: string[]; deepseek: string[]; groq: string[]; openrouter: string[];
  }>({ ollama: [], gemini: [], deepseek: [], groq: [], openrouter: [] });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modeConfigsExpanded, setModeConfigsExpanded] = useState(false);

  const fetchModels = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/models`);
      const data = await res.json();
      setAvailableModels(prev => ({
        ...prev,
        ollama: data.ollama || [],
        gemini: data.gemini || [],
        deepseek: data.deepseek || [],
        groq: data.groq || [],
        openrouter: data.openrouter || [],
      }));
    } catch (err: any) {
      console.error(`[Settings] Model fetch failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const detectProvider = (model: string): string => {
    if (!model || model === 'auto') return 'auto';
    const m = model.toLowerCase();
    if (availableModels.groq.includes(model)) return 'groq';
    if (availableModels.deepseek.includes(model)) return 'deepseek';
    if (availableModels.gemini.includes(model)) return 'gemini';
    if (availableModels.openrouter.includes(model)) return 'openrouter';
    if (availableModels.ollama.some((opt: any) => (opt.name || opt) === model)) return 'ollama';
    if (m.includes('llama') || m.includes('gemma2') || m.includes('groq/')) return 'groq';
    if (m.includes('deepseek')) return 'deepseek';
    if (m.includes('/') || m.includes(':free')) return 'openrouter';
    if (m.includes('gemini')) return 'gemini';
    return 'gemini';
  };

  const handleGlobalCloudModelChange = (model: string) => {
    setSelectedCloudModel(model);
    setSelectedCloudProvider(detectProvider(model) as any);
  };

  const handleModeModelChange = (modeId: string, model: string) => {
    const provider = detectProvider(model);
    setModeConfig(modeId, { provider, model: model === 'auto' ? selectedCloudModel : model });
  };

  const handleResetModels = () => {
    setGlobalProvider(SETTINGS_DEFAULTS.globalProvider);
    setSelectedCloudModel(SETTINGS_DEFAULTS.selectedCloudModel);
    setSelectedCloudProvider(SETTINGS_DEFAULTS.selectedCloudProvider as any);
    setSelectedLocalModel(SETTINGS_DEFAULTS.selectedLocalModel);
    setSelectedOpenRouterModel(SETTINGS_DEFAULTS.selectedOpenRouterModel);
    setImageProvider(SETTINGS_DEFAULTS.imageProvider as any);
    setLocalImageUrl(SETTINGS_DEFAULTS.localImageUrl);
  };

  // Build CustomSelect option lists from available models
  const cloudModelOptions = useMemo<SelectOption[]>(() => [
    ...availableModels.gemini.map(m => ({ value: m, label: m, group: 'Google Gemini' })),
    ...availableModels.groq.map(m => ({ value: m, label: m, group: 'Groq LPU' })),
    ...availableModels.deepseek.map(m => ({ value: m, label: m, group: 'DeepSeek' })),
    ...availableModels.openrouter.map(m => ({ value: m, label: m, group: 'OpenRouter' })),
  ], [availableModels]);

  const localModelOptions = useMemo<SelectOption[]>(() => {
    if (availableModels.ollama.length === 0) {
      return [{ value: selectedLocalModel, label: selectedLocalModel }];
    }
    return availableModels.ollama.map((m: any) => ({
      value: m.name || m,
      label: m.name || m,
    }));
  }, [availableModels.ollama, selectedLocalModel]);

  const openrouterPickerOptions = useMemo<SelectOption[]>(() =>
    availableModels.openrouter.map(m => ({ value: m, label: m })),
    [availableModels.openrouter]
  );

  const modeOverrideOptions = useMemo<SelectOption[]>(() => [
    { value: 'auto', label: 'auto (use global default)' },
    ...availableModels.gemini.map(m => ({ value: m, label: m, group: 'Gemini' })),
    ...availableModels.groq.map(m => ({ value: m, label: m, group: 'Groq' })),
    ...availableModels.deepseek.map(m => ({ value: m, label: m, group: 'DeepSeek' })),
    ...availableModels.ollama.map((m: any) => ({ value: m.name || m, label: m.name || m, group: 'Ollama (Local)' })),
  ], [availableModels]);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-12">

      {/* Routing Mode */}
      <motion.section variants={staggerItem} className="space-y-6" id="settings-routing-mode">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-black text-jb-accent uppercase tracking-[0.4em]">Routing Mode</h4>
          <button onClick={handleResetModels} className="flex items-center gap-1 text-[8px] font-black text-slate-700 hover:text-slate-400 uppercase tracking-widest transition-colors" title="Reset models to defaults">
            <RotateCcw size={9} /> Reset
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { id: 'cloud', label: 'Cloud',       desc: 'Gemini / Groq / DeepSeek' },
            { id: 'local', label: 'Local',        desc: 'Private — Ollama' },
            { id: 'auto',  label: 'Smart Hybrid', desc: 'Auto-select by task' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setGlobalProvider(p.id as any)}
              className={cn(
                "p-6 rounded-3xl border text-left transition-all relative overflow-hidden group",
                globalProvider === p.id
                  ? "bg-white/[0.04] border-white/20"
                  : "bg-transparent border-white/5 opacity-40 hover:opacity-100"
              )}
            >
              <span className="text-xs font-black text-white uppercase block mb-1">{p.label}</span>
              <span className="text-[9px] text-slate-500 font-bold">{p.desc}</span>
              {globalProvider === p.id && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-jb-accent/10 blur-2xl rounded-full" />
              )}
            </button>
          ))}
        </div>
      </motion.section>

      {/* Default Models */}
      <motion.section variants={staggerItem} className="space-y-6" id="settings-default-cloud-model">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Default Models</h4>
          <button
            onClick={fetchModels}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={10} className={cn(isRefreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2" id="settings-default-cloud-model">
            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Default Cloud Model</label>
            <CustomSelect
              value={selectedCloudModel}
              onChange={handleGlobalCloudModelChange}
              options={cloudModelOptions}
              searchable
              placeholder="Select cloud model..."
            />
          </div>
          <div className="space-y-2" id="settings-default-local-model">
            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Default Local Model</label>
            <CustomSelect
              value={selectedLocalModel}
              onChange={v => setSelectedLocalModel(v)}
              options={localModelOptions}
              placeholder="Select local model..."
            />
          </div>
        </div>

        {/* OpenRouter Model Override */}
        <div className="space-y-2 pt-2" id="settings-openrouter-override">
          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">OpenRouter Model Override</label>
          <div className="flex gap-3 items-stretch">
            <input
              type="text"
              value={selectedOpenRouterModel}
              onChange={e => setSelectedOpenRouterModel(e.target.value)}
              placeholder="e.g. qwen/qwen-2.5-coder-32b-instruct:free"
              className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-mono text-jb-accent outline-none focus:border-jb-accent/50 transition-all placeholder:text-slate-700"
            />
            {openrouterPickerOptions.length > 0 && (
              <div className="w-48">
                <CustomSelect
                  value=""
                  onChange={v => { if (v) setSelectedOpenRouterModel(v); }}
                  options={openrouterPickerOptions}
                  searchable
                  placeholder="Pick model"
                />
              </div>
            )}
          </div>
          <p className="text-[9px] text-slate-600 ml-1">Used when routing to OpenRouter provider. Supports any model slug from openrouter.ai/models.</p>
        </div>
      </motion.section>

      {/* Image Provider */}
      <motion.section variants={staggerItem} className="space-y-6" id="settings-image-provider">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Image Provider</h4>
        <div className="grid grid-cols-2 gap-4">
          {[
            { id: 'gemini',       label: 'Gemini Imagen',  desc: 'Imagen 3.0 — requires Gemini API key' },
            { id: 'huggingface',  label: 'Hugging Face',   desc: 'Free SDXL via Inference API' },
            { id: 'local',        label: 'Local SDXL',     desc: 'A1111 / WebUI on local node' },
            { id: 'pollinations', label: 'Pollinations',   desc: 'Open-source, no API key needed' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setImageProvider(p.id as any)}
              className={cn(
                "p-5 rounded-3xl border text-left transition-all relative overflow-hidden group",
                imageProvider === p.id
                  ? "bg-white/[0.04] border-white/20 shadow-lg"
                  : "bg-transparent border-white/5 opacity-40 hover:opacity-100"
              )}
            >
              <span className="text-[10px] font-black text-white uppercase block mb-1">{p.label}</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">{p.desc}</span>
            </button>
          ))}
        </div>

        {imageProvider === 'local' && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <Globe size={16} className="text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Local Node Endpoint</label>
                <input
                  type="text"
                  value={localImageUrl}
                  onChange={e => setLocalImageUrl(e.target.value)}
                  placeholder="http://127.0.0.1:7860/sdapi/v1/txt2img"
                  className="w-full bg-transparent border-none outline-none text-[11px] font-mono text-jb-accent placeholder:text-slate-700"
                />
              </div>
              <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-[8px] font-black text-slate-500 uppercase flex-shrink-0">A1111 / WebUI</div>
            </div>
          </div>
        )}
      </motion.section>

      {/* Per-Mode Overrides */}
      <motion.section variants={staggerItem} className="space-y-4 pt-6 border-t border-white/5" id="settings-mode-overrides">
        <button
          onClick={() => setModeConfigsExpanded(prev => !prev)}
          className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] hover:text-slate-300 transition-colors"
        >
          <ChevronDown size={12} className={cn("transition-transform duration-300", modeConfigsExpanded && "rotate-180")} />
          Per-Mode Model Overrides
        </button>
        {modeConfigsExpanded && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {Object.entries(modeConfigs).map(([modeId, config]) => (
              <div key={modeId} className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-2xl px-3 py-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-32 flex-shrink-0">{modeId.replace('_', ' ')}</span>
                <div className="flex-1">
                  <CustomSelect
                    value={config.model}
                    onChange={v => handleModeModelChange(modeId, v)}
                    options={modeOverrideOptions}
                  />
                </div>
                <span className="text-[9px] text-slate-600 font-mono flex-shrink-0">{config.provider}</span>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
};
