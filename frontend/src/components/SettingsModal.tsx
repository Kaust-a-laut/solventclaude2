import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Cpu, Sliders, Key, Database, Globe,
  Eye, EyeOff, ArrowUpRight, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Loader2, RefreshCw,
  Search, Trash2, Pencil, Check, Tag, Filter, Star, Hash
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { API_BASE_URL, BASE_URL } from '../lib/config';
import { cn } from '../lib/utils';
import { fetchWithRetry } from '../lib/api-client';

export const SettingsModal = () => {
  const {
    settingsOpen, setSettingsOpen,
    settingsInitialTab, setSettingsInitialTab,
    modeConfigs, setModeConfig,
    temperature, setTemperature,
    maxTokens, setMaxTokens,
    globalProvider, setGlobalProvider,
    auraMode, setAuraMode,
    apiKeys, setApiKey,
    selectedCloudModel, setSelectedCloudModel,
    selectedLocalModel, setSelectedLocalModel,
    selectedCloudProvider, setSelectedCloudProvider,
    selectedOpenRouterModel, setSelectedOpenRouterModel,
    imageProvider, setImageProvider,
    localImageUrl, setLocalImageUrl,
    thinkingModeEnabled, setThinkingModeEnabled,
    smartRouterEnabled, setSmartRouterEnabled,
    showCodingChat, setShowCodingChat,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'models' | 'behavior' | 'api-keys' | 'memory'>('models');
  const [availableModels, setAvailableModels] = useState<{
    ollama: any[]; gemini: string[]; deepseek: string[]; groq: string[]; openrouter: string[];
  }>({
    ollama: [],
    gemini: [],
    deepseek: [],
    groq: [],
    openrouter: [],
  });

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [validationStatus, setValidationStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [modeConfigsExpanded, setModeConfigsExpanded] = useState(false);
  const [memoryStats, setMemoryStats] = useState<{ total: number; byTier: Record<string, number>; byType: Record<string, number> } | null>(null);
  const [memoryEntries, setMemoryEntries] = useState<any[]>([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryTierFilter, setMemoryTierFilter] = useState<string | null>(null);
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [showTypeBreakdown, setShowTypeBreakdown] = useState(false);

  const logError = useCallback((msg: string) => {
    console.error(`[Settings] ${msg}`);
    setErrorLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  }, []);

  const fetchMemoryData = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (memoryTierFilter) params.set('tier', memoryTierFilter);
      if (memoryTypeFilter) params.set('type', memoryTypeFilter);
      const [statsData, entriesData] = await Promise.all([
        fetchWithRetry(`${API_BASE_URL}/memory/stats`) as Promise<any>,
        fetchWithRetry(`${API_BASE_URL}/memory/entries?${params}`) as Promise<any>,
      ]);
      setMemoryStats(statsData);
      setMemoryEntries((entriesData as any).entries || []);
    } catch {
      // silently fail — backend may not be running
    } finally {
      setMemoryLoading(false);
    }
  }, [memoryTierFilter, memoryTypeFilter]);

  useEffect(() => {
    if (settingsOpen && activeTab === 'memory') {
      fetchMemoryData();
    }
  }, [settingsOpen, activeTab, fetchMemoryData]);

  useEffect(() => {
    if (activeTab !== 'memory') return;
    const timer = setTimeout(async () => {
      if (!memorySearch.trim()) {
        fetchMemoryData();
        return;
      }
      setMemoryLoading(true);
      try {
        const result = await fetchWithRetry(`${API_BASE_URL}/memory/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: memorySearch, limit: 20 }),
        }) as any;
        setMemoryEntries(result.entries || []);
      } catch {
        // silently fail
      } finally {
        setMemoryLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [memorySearch, activeTab, fetchMemoryData]);

  // Reset memory UI state when leaving memory tab
  useEffect(() => {
    if (activeTab !== 'memory') {
      setMemoryTierFilter(null);
      setMemoryTypeFilter(null);
      setExpandedEntryId(null);
      setEditingEntryId(null);
      setShowTypeBreakdown(false);
    }
  }, [activeTab]);

  const [serviceHealth, setServiceHealth] = useState<{ ollama: 'connected' | 'disconnected'; timestamp?: string }>({ ollama: 'disconnected' });

  useEffect(() => {
    if (settingsOpen) {
      const checkHealth = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/health/services`);
          const health = await res.json();
          setServiceHealth(health);
        } catch (e) {
          setServiceHealth({ ollama: 'disconnected' });
        }
      };
      checkHealth();
      const interval = setInterval(checkHealth, 10000);
      return () => clearInterval(interval);
    }
  }, [settingsOpen]);

  // Consume a pending initial tab set from external navigation (e.g. Memory card on home page)
  useEffect(() => {
    if (settingsOpen && settingsInitialTab) {
      setActiveTab(settingsInitialTab as any);
      setSettingsInitialTab(null);
    }
  }, [settingsOpen]);

  const toggleKeyVisibility = (providerId: string) => {
    setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

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
        openrouter: data.openrouter || []
      }));
    } catch (err: any) {
      logError(`Model fetch failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [logError]);

  useEffect(() => {
    if (settingsOpen) fetchModels();
  }, [settingsOpen, fetchModels]);

  if (!settingsOpen) return null;

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
    const provider = detectProvider(model);
    setSelectedCloudProvider(provider as any);
  };

  const handleModeModelChange = (modeId: string, model: string) => {
    const provider = detectProvider(model);
    setModeConfig(modeId, { provider, model: model === 'auto' ? selectedCloudModel : model });
  };

  const validateKey = async (provider: string) => {
    const key = apiKeys[provider];
    if (!key) return;
    setValidationStatus(prev => ({ ...prev, [provider]: 'loading' }));
    try {
      // Use the dedicated validation endpoint (auth-exempt, makes real API call)
      const res = await fetch(`${BASE_URL}/api/settings/providers/${provider}/validate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });
      const data = await res.json();
      setValidationStatus(prev => ({ ...prev, [provider]: data.valid ? 'success' : 'error' }));
    } catch {
      setValidationStatus(prev => ({ ...prev, [provider]: 'error' }));
    }
  };

  // ── Tab header lookup ──────────────────────────────────────────────────────
  const TAB_TITLES: Record<string, string> = {
    models:    'Models & Providers',
    behavior:  'Behavior & Tuning',
    'api-keys':'API Keys',
    memory:    'Project Memory',
  };
  const TAB_SUBTITLES: Record<string, string> = {
    models:    'Configure AI providers, model selection and image generation',
    behavior:  'Tune inference parameters and assistant capabilities',
    'api-keys':'Securely store provider credentials — stored locally only',
    memory:    'Index your workspace for context-aware responses',
  };

  // ── API key provider config ────────────────────────────────────────────────
  const API_KEY_CONFIGS = [
    { id: 'gemini',      label: 'Google Gemini',  description: 'Powers Gemini 1.5 / 2.0 / 2.5 models and Imagen image generation', placeholder: 'AIzaSy...',     docsUrl: 'https://aistudio.google.com/app/apikey' },
    { id: 'groq',        label: 'Groq',            description: 'Llama 3.3 70B, Mixtral — ultra-fast LPU inference',                placeholder: 'gsk_...',       docsUrl: 'https://console.groq.com/keys' },
    { id: 'deepseek',    label: 'DeepSeek',        description: 'deepseek-chat and deepseek-reasoner models',                        placeholder: 'sk-...',        docsUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'openrouter',  label: 'OpenRouter',      description: 'Access hundreds of models through a single API endpoint',           placeholder: 'sk-or-v1-...', docsUrl: 'https://openrouter.ai/keys' },
    { id: 'dashscope',   label: 'DashScope (Qwen)', description: 'Qwen3-Coder, Qwen3.5, Qwen-Max — Alibaba Cloud native API',       placeholder: 'sk-...',        docsUrl: 'https://dashscope.console.aliyun.com/apiKey' },
    { id: 'cerebras',    label: 'Cerebras',         description: 'Ultra-fast wafer-scale inference — Llama, GPT-OSS, Qwen3, GLM-4.7', placeholder: 'csk-...',       docsUrl: 'https://cloud.cerebras.ai/' },
    { id: 'huggingface', label: 'Hugging Face',    description: 'Free SDXL image generation via the Hugging Face Inference API',     placeholder: 'hf_...',        docsUrl: 'https://huggingface.co/settings/tokens' },
    { id: 'serper',      label: 'Serper (Search)', description: 'Enables web search — required for Browse and Waterfall tools',      placeholder: 'your-key...',   docsUrl: 'https://serper.dev/api-key' },
  ];

  // ── Helper components ──────────────────────────────────────────────────────
  const InlineToggle = ({
    label, description, checked, onChange
  }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-b-0">
      <div className="flex flex-col gap-0.5 pr-8">
        <span className="text-xs font-bold text-white">{label}</span>
        <span className="text-[10px] text-slate-500 font-medium leading-snug">{description}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={cn(
          "relative flex-shrink-0 w-10 h-5 rounded-full transition-all duration-300",
          checked ? "bg-jb-accent shadow-[0_0_12px_rgba(60,113,247,0.4)]" : "bg-white/10"
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300",
          checked ? "translate-x-5" : "translate-x-0"
        )} />
      </button>
    </div>
  );

  const TabButton = ({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(id as any)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
        activeTab === id ? "bg-white/5 text-white shadow-xl" : "text-slate-500 hover:text-slate-300"
      )}
    >
      <Icon size={16} className={cn(activeTab === id ? "text-jb-accent" : "text-slate-600")} />
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
      {activeTab === id && (
        <motion.div layoutId="tabGlow" className="ml-auto w-1 h-1 rounded-full bg-jb-accent shadow-[0_0_10px_rgba(60,113,247,1)]" />
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => setSettingsOpen(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-7xl h-[92vh] bg-[#050508] border border-white/5 rounded-[40px] shadow-2xl relative overflow-hidden flex"
      >
        {/* ── Left Sidebar ───────────────────────────────────────────────── */}
        <div className="w-64 border-r border-white/5 bg-white/[0.01] p-8 flex flex-col gap-8">
          <div className="flex flex-col gap-1 px-2">
            <h2 className="text-xl font-black text-white tracking-tighter">Settings</h2>
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">Configure your workspace</p>
          </div>

          <nav className="flex flex-col gap-2">
            <TabButton id="models"    label="Models"    icon={Cpu} />
            <TabButton id="behavior"  label="Behavior"  icon={Sliders} />
            <TabButton id="api-keys"  label="API Keys"  icon={Key} />
            <TabButton id="memory"    label="Memory"    icon={Database} />
          </nav>

          {/* System Status */}
          <div className="mt-auto bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">System Status</span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    serviceHealth.ollama === 'connected' ? "bg-emerald-400" : "bg-rose-500"
                  )}></span>
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    serviceHealth.ollama === 'connected' ? "bg-emerald-500" : "bg-rose-600"
                  )}></span>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[9px] font-bold text-slate-400">Local Node (Ollama)</span>
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest",
                  serviceHealth.ollama === 'connected' ? "text-emerald-400" : "text-rose-400"
                )}>
                  {serviceHealth.ollama === 'connected' ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[9px] font-bold text-slate-400">Cloud Uplink</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Content ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="p-8 pb-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">
                {TAB_TITLES[activeTab]}
              </h3>
              <p className="text-[10px] font-bold text-slate-500 mt-1">{TAB_SUBTITLES[activeTab]}</p>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-10 scrollbar-thin">

            {/* ── MODELS TAB ─────────────────────────────────────────────── */}
            {activeTab === 'models' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">

                {/* Routing Mode */}
                <section className="space-y-6">
                  <h4 className="text-[10px] font-black text-jb-accent uppercase tracking-[0.4em]">Routing Mode</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'cloud', label: 'Cloud',        desc: 'Gemini / Groq / DeepSeek' },
                      { id: 'local', label: 'Local',         desc: 'Private — Ollama' },
                      { id: 'auto',  label: 'Smart Hybrid',  desc: 'Auto-select by task' },
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
                </section>

                {/* Default Models */}
                <section className="space-y-6">
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
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Default Cloud Model</label>
                      <select
                        value={selectedCloudModel}
                        onChange={e => handleGlobalCloudModelChange(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-slate-300 outline-none hover:border-white/20 transition-all cursor-pointer"
                      >
                        <optgroup label="Google Gemini" className="bg-[#050508]">
                          {availableModels.gemini.map(m => <option key={m} value={m}>{m}</option>)}
                        </optgroup>
                        <optgroup label="Groq LPU" className="bg-[#050508]">
                          {availableModels.groq.map(m => <option key={m} value={m}>{m}</option>)}
                        </optgroup>
                        <optgroup label="DeepSeek" className="bg-[#050508]">
                          {availableModels.deepseek.map(m => <option key={m} value={m}>{m}</option>)}
                        </optgroup>
                        <optgroup label="OpenRouter" className="bg-[#050508]">
                          {availableModels.openrouter.map(m => <option key={m} value={m}>{m}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Default Local Model</label>
                      <select
                        value={selectedLocalModel}
                        onChange={e => setSelectedLocalModel(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-slate-300 outline-none hover:border-white/20 transition-all cursor-pointer"
                      >
                        {availableModels.ollama.length === 0 && (
                          <option value={selectedLocalModel}>{selectedLocalModel}</option>
                        )}
                        {availableModels.ollama.map((m: any) => (
                          <option key={m.name || m} value={m.name || m}>{m.name || m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* OpenRouter Model Override */}
                  <div className="space-y-2 pt-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">OpenRouter Model Override</label>
                    <div className="flex gap-3 items-stretch">
                      <input
                        type="text"
                        value={selectedOpenRouterModel}
                        onChange={e => setSelectedOpenRouterModel(e.target.value)}
                        placeholder="e.g. qwen/qwen-2.5-coder-32b-instruct:free"
                        className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-mono text-jb-accent outline-none focus:border-jb-accent/50 transition-all placeholder:text-slate-700"
                      />
                      {availableModels.openrouter.length > 0 && (
                        <select
                          value=""
                          onChange={e => { if (e.target.value) setSelectedOpenRouterModel(e.target.value); }}
                          className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 outline-none hover:border-white/20 transition-all cursor-pointer"
                        >
                          <option value="">Pick model</option>
                          {availableModels.openrouter.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-600 ml-1">Used when routing to OpenRouter provider. Supports any model slug from openrouter.ai/models.</p>
                  </div>
                </section>

                {/* Image Provider */}
                <section className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Image Provider</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'gemini',      label: 'Gemini Imagen',  desc: 'Imagen 3.0 — requires Gemini API key' },
                      { id: 'huggingface', label: 'Hugging Face',   desc: 'Free SDXL via Inference API' },
                      { id: 'local',       label: 'Local SDXL',     desc: 'A1111 / WebUI on local node' },
                      { id: 'pollinations',label: 'Pollinations',   desc: 'Open-source, no API key needed' },
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
                </section>

                {/* Per-Mode Overrides (collapsible) */}
                <section className="space-y-4 pt-6 border-t border-white/5">
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
                        <div key={modeId} className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-3">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-32 flex-shrink-0">{modeId.replace('_', ' ')}</span>
                          <select
                            value={config.model}
                            onChange={e => handleModeModelChange(modeId, e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-slate-300 cursor-pointer"
                          >
                            <option value="auto">auto (use global default)</option>
                            <optgroup label="Gemini">
                              {availableModels.gemini.map(m => <option key={m} value={m}>{m}</option>)}
                            </optgroup>
                            <optgroup label="Groq">
                              {availableModels.groq.map(m => <option key={m} value={m}>{m}</option>)}
                            </optgroup>
                            <optgroup label="DeepSeek">
                              {availableModels.deepseek.map(m => <option key={m} value={m}>{m}</option>)}
                            </optgroup>
                            <optgroup label="Ollama (Local)">
                              {availableModels.ollama.map((m: any) => <option key={m.name || m} value={m.name || m}>{m.name || m}</option>)}
                            </optgroup>
                          </select>
                          <span className="text-[9px] text-slate-600 font-mono flex-shrink-0">{config.provider}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ── BEHAVIOR TAB ───────────────────────────────────────────── */}
            {activeTab === 'behavior' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">

                {/* Temperature */}
                <section className="space-y-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Temperature</h4>
                      <p className="text-[9px] text-slate-600 font-bold mt-1">Controls response randomness — 0 = deterministic, 1 = creative</p>
                    </div>
                    <span className="text-lg font-mono text-jb-accent">{temperature}</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.1" value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-jb-accent"
                  />
                </section>

                {/* Max Tokens */}
                <section className="space-y-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Max Tokens</h4>
                      <p className="text-[9px] text-slate-600 font-bold mt-1">Maximum token budget per inference request</p>
                    </div>
                    <span className="text-lg font-mono text-jb-purple">{maxTokens.toLocaleString()}</span>
                  </div>
                  <input
                    type="range" min="512" max="16384" step="512" value={maxTokens}
                    onChange={e => setMaxTokens(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-jb-purple"
                  />
                </section>

                {/* Assistant Features */}
                <section className="space-y-2 pt-6 border-t border-white/5">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Assistant Features</h4>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl px-5">
                    <InlineToggle
                      label="Smart Router"
                      description="Automatically selects the best model and provider for each task"
                      checked={smartRouterEnabled}
                      onChange={setSmartRouterEnabled}
                    />
                    <InlineToggle
                      label="Extended Thinking"
                      description="Enables deeper multi-step reasoning for complex queries (uses more tokens)"
                      checked={thinkingModeEnabled}
                      onChange={setThinkingModeEnabled}
                    />
                    <InlineToggle
                      label="Coding Assistant"
                      description="Show the Agentic IDE panel in the navigation sidebar"
                      checked={showCodingChat}
                      onChange={setShowCodingChat}
                    />
                  </div>
                </section>

                {/* Aura */}
                <section className="space-y-6 pt-6 border-t border-white/5">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Environmental Aura</h4>
                  <div className="flex gap-4">
                    {[
                      { id: 'off',     label: 'Minimalist', desc: 'Deep Black' },
                      { id: 'static',  label: 'Static',     desc: 'Predictable' },
                      { id: 'organic', label: 'Organic',    desc: 'Dynamic Fluid' },
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setAuraMode(mode.id as any)}
                        className={cn(
                          "flex-1 p-5 rounded-2xl border text-left transition-all relative overflow-hidden group",
                          auraMode === mode.id
                            ? "bg-white/[0.04] border-white/20 shadow-lg"
                            : "bg-transparent border-white/5 opacity-40 hover:opacity-100"
                        )}
                      >
                        <span className="text-[11px] font-black text-white uppercase block mb-1 tracking-wider">{mode.label}</span>
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{mode.desc}</span>
                        {auraMode === mode.id && <div className="absolute top-0 right-0 w-8 h-8 bg-jb-accent/10 blur-xl rounded-full" />}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ── API KEYS TAB ───────────────────────────────────────────── */}
            {activeTab === 'api-keys' && (
              <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                {API_KEY_CONFIGS.map(({ id, label, description, placeholder, docsUrl }) => (
                  <div key={id} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col gap-4">
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
                  </div>
                ))}
              </div>
            )}

            {/* ── MEMORY TAB ─────────────────────────────────────────────── */}
            {activeTab === 'memory' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">

                {/* Stats Bar — clickable tier filter cards */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Total', value: memoryStats?.total ?? '—', color: 'text-white', tier: null },
                    { label: 'Crystallized', value: memoryStats?.byTier?.crystallized ?? 0, color: 'text-jb-purple', tier: 'crystallized' },
                    { label: 'Episodic', value: memoryStats?.byTier?.episodic ?? 0, color: 'text-jb-accent', tier: 'episodic' },
                    { label: 'Summaries', value: memoryStats?.byTier?.['meta-summary'] ?? 0, color: 'text-slate-400', tier: 'meta-summary' },
                  ].map(stat => {
                    const isActive = memoryTierFilter === stat.tier || (stat.tier === null && memoryTierFilter === null);
                    return (
                      <button
                        key={stat.label}
                        onClick={() => setMemoryTierFilter(stat.tier === memoryTierFilter ? null : stat.tier)}
                        className={cn(
                          'bg-white/[0.03] border rounded-2xl p-3 flex flex-col gap-1 text-left transition-all cursor-pointer',
                          isActive && stat.tier !== null
                            ? 'border-white/20 ring-1 ring-white/10'
                            : 'border-white/[0.06] hover:border-white/10'
                        )}
                      >
                        <span className={cn('text-lg font-black', stat.color)}>{memoryLoading ? '—' : stat.value}</span>
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{stat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Type Distribution — collapsible */}
                {memoryStats && Object.keys(memoryStats.byType).length > 0 && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setShowTypeBreakdown(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-400 transition-colors"
                    >
                      <span className="flex items-center gap-1.5"><Hash size={10} /> Type Distribution</span>
                      {showTypeBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <AnimatePresence>
                      {showTypeBreakdown && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                            {Object.entries(memoryStats.byType)
                              .sort(([, a], [, b]) => b - a)
                              .map(([type, count]) => (
                                <button
                                  key={type}
                                  onClick={() => setMemoryTypeFilter(memoryTypeFilter === type ? null : type)}
                                  className={cn(
                                    'px-2.5 py-1 rounded-full text-[9px] font-bold border transition-all',
                                    memoryTypeFilter === type
                                      ? 'bg-jb-accent/20 text-jb-accent border-jb-accent/40'
                                      : 'bg-white/[0.03] text-slate-500 border-white/[0.08] hover:border-white/20 hover:text-slate-400'
                                  )}
                                >
                                  {type.replace(/_/g, ' ')} <span className="text-slate-700 ml-0.5">{count}</span>
                                </button>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    value={memorySearch}
                    onChange={e => setMemorySearch(e.target.value)}
                    placeholder="Search memories..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl pl-10 pr-4 py-3 text-[11px] font-bold text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-jb-purple/40 transition-colors"
                  />
                </div>

                {/* Active Filter Indicator */}
                {(memoryTierFilter || memoryTypeFilter) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter size={10} className="text-slate-600" />
                    {memoryTierFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-[9px] font-bold text-slate-400">
                        tier: {memoryTierFilter}
                        <button onClick={() => setMemoryTierFilter(null)} className="hover:text-white transition-colors"><X size={8} /></button>
                      </span>
                    )}
                    {memoryTypeFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-[9px] font-bold text-slate-400">
                        type: {memoryTypeFilter.replace(/_/g, ' ')}
                        <button onClick={() => setMemoryTypeFilter(null)} className="hover:text-white transition-colors"><X size={8} /></button>
                      </span>
                    )}
                  </div>
                )}

                {/* Entry List */}
                <div className="bg-white/[0.01] border border-white/[0.06] rounded-[28px] overflow-hidden">
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-white/[0.04]">
                    {memoryLoading && memoryEntries.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-slate-600 text-[11px]">
                        <Loader2 size={14} className="animate-spin" /> Loading memories...
                      </div>
                    ) : memoryEntries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-700">
                        <Database size={28} className="opacity-30" />
                        <p className="text-[11px] font-bold">
                          {memorySearch ? 'No results found' : 'No memories yet — resync to build index'}
                        </p>
                      </div>
                    ) : memoryEntries.map(entry => {
                      const tierColors: Record<string, string> = {
                        crystallized: 'bg-jb-purple/20 text-jb-purple border-jb-purple/30',
                        episodic: 'bg-jb-accent/20 text-jb-accent border-jb-accent/30',
                        'meta-summary': 'bg-white/10 text-slate-400 border-white/20',
                        archived: 'bg-white/5 text-slate-600 border-white/10',
                      };
                      const tierClass = tierColors[entry.tier] || 'bg-white/5 text-slate-500 border-white/10';
                      const confidence = typeof entry.confidence === 'string'
                        ? entry.confidence
                        : entry.confidence != null
                          ? entry.confidence >= 0.8 ? 'HIGH' : entry.confidence >= 0.5 ? 'MED' : 'LOW'
                          : null;
                      const relTime = entry.timestamp
                        ? (() => {
                            const diff = Date.now() - new Date(entry.timestamp).getTime();
                            if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
                            if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
                            return `${Math.round(diff / 86400000)}d ago`;
                          })()
                        : null;
                      const isExpanded = expandedEntryId === entry.id;
                      const isEditing = editingEntryId === entry.id;
                      return (
                        <div key={entry.id} className="hover:bg-white/[0.02] transition-colors group">
                          <div
                            className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                            onClick={() => {
                              setExpandedEntryId(isExpanded ? null : entry.id);
                              if (isEditing) { setEditingEntryId(null); }
                            }}
                          >
                            {/* Expand chevron */}
                            <div className="mt-0.5 text-slate-700 flex-shrink-0">
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {entry.tier && (
                                  <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border', tierClass)}>
                                    {entry.tier}
                                  </span>
                                )}
                                {entry.type && (
                                  <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-white/[0.05] text-slate-500 border border-white/[0.08]">
                                    {entry.type.replace(/_/g, ' ')}
                                  </span>
                                )}
                                {confidence && (
                                  <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-bold',
                                    confidence === 'HIGH' ? 'text-emerald-400' : confidence === 'MED' ? 'text-yellow-500' : 'text-rose-400'
                                  )}>
                                    {confidence}
                                  </span>
                                )}
                                {entry.importance != null && (
                                  <span className="flex items-center gap-0.5 text-[8px] font-bold text-amber-400/80">
                                    <Star size={8} className="fill-amber-400/80" /> {entry.importance}
                                  </span>
                                )}
                                {relTime && <span className="text-[8px] text-slate-700">{relTime}</span>}
                              </div>
                              <p className={cn('text-[10px] text-slate-400 leading-relaxed font-medium', !isExpanded && 'line-clamp-2')}>
                                {entry.content}
                              </p>
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedEntryId(entry.id);
                                  setEditingEntryId(entry.id);
                                  setEditContent(entry.content || '');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-jb-accent/20 text-slate-700 hover:text-jb-accent transition-all"
                                title="Edit this memory"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setMemoryEntries(prev => prev.filter(el => el.id !== entry.id));
                                  try {
                                    await fetchWithRetry(`${API_BASE_URL}/memory/entries/${entry.id}`, { method: 'DELETE' });
                                  } catch {
                                    setMemoryEntries(prev => [...prev, entry]);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-700 hover:text-rose-400 transition-all"
                                title="Delete this memory"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Expanded area: tags + inline edit */}
                          {isExpanded && (
                            <div className="px-4 pb-3 pl-[40px] space-y-2">
                              {/* Tags */}
                              {entry.tags && entry.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Tag size={9} className="text-slate-700" />
                                  {entry.tags.map((tag: string) => (
                                    <span key={tag} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/[0.04] text-slate-600 border border-white/[0.06]">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {/* Inline edit */}
                              {isEditing && (
                                <div className="space-y-2">
                                  <textarea
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                    rows={4}
                                    className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl p-3 text-[10px] text-slate-300 font-medium focus:outline-none focus:border-jb-purple/40 resize-none"
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      disabled={editSaving || !editContent.trim()}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setEditSaving(true);
                                        // Optimistic update
                                        const prevContent = entry.content;
                                        setMemoryEntries(prev => prev.map(el => el.id === entry.id ? { ...el, content: editContent.trim() } : el));
                                        try {
                                          await fetchWithRetry(`${API_BASE_URL}/memory/entries/${entry.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: editContent.trim() }),
                                          });
                                          setEditingEntryId(null);
                                        } catch {
                                          setMemoryEntries(prev => prev.map(el => el.id === entry.id ? { ...el, content: prevContent } : el));
                                        } finally {
                                          setEditSaving(false);
                                        }
                                      }}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-jb-purple/20 hover:bg-jb-purple/30 border border-jb-purple/30 rounded-lg text-[9px] font-bold text-jb-purple transition-all disabled:opacity-50"
                                    >
                                      {editSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingEntryId(null);
                                      }}
                                      className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg text-[9px] font-bold text-slate-500 transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Row */}
                <div className="flex items-center gap-3">
                  <button
                    disabled={memoryStatus === 'loading'}
                    onClick={async () => {
                      setMemoryStatus('loading');
                      try {
                        await fetchWithRetry(`${API_BASE_URL}/index`, { method: 'POST' });
                        setMemoryStatus('success');
                        setTimeout(() => setMemoryStatus('idle'), 5000);
                      } catch {
                        setMemoryStatus('error');
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-jb-purple/10 hover:bg-jb-purple/20 border border-jb-purple/20 hover:border-jb-purple/40 rounded-2xl text-[10px] font-black uppercase tracking-widest text-jb-purple transition-all disabled:opacity-50"
                  >
                    {memoryStatus === 'loading'
                      ? <><Loader2 size={12} className="animate-spin" /> Indexing...</>
                      : <><RefreshCw size={12} /> Resync Memory</>
                    }
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm('Clear all memory entries? This cannot be undone.')) return;
                      try {
                        await fetchWithRetry(`${API_BASE_URL}/memory`, { method: 'DELETE' });
                        setMemoryEntries([]);
                        setMemoryStats(null);
                        await fetchMemoryData();
                      } catch {
                        logError('Failed to clear memory');
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-500 transition-all"
                  >
                    <Trash2 size={12} /> Clear All
                  </button>
                </div>

                {/* Status message */}
                <AnimatePresence>
                  {memoryStatus !== 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className={cn(
                        'flex items-center gap-2 px-5 py-3 rounded-2xl text-[11px] font-bold',
                        memoryStatus === 'loading' && 'bg-jb-accent/10 border border-jb-accent/20 text-jb-accent',
                        memoryStatus === 'success' && 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400',
                        memoryStatus === 'error' && 'bg-rose-400/10 border border-rose-400/20 text-rose-400',
                      )}
                    >
                      {memoryStatus === 'loading' && <><Loader2 size={14} className="animate-spin" /> Indexing workspace files...</>}
                      {memoryStatus === 'success' && <><CheckCircle2 size={14} /> Memory index updated — context is now current</>}
                      {memoryStatus === 'error' && <><AlertCircle size={14} /> Indexing failed — is the backend running?</>}
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            )}

          </div>

          {/* Footer */}
          <footer className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-slate-700" />
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Protocol Protected — Local Session Only</span>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="px-10 py-3 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all shadow-2xl"
            >
              Done
            </button>
          </footer>
        </div>
      </motion.div>
    </div>
  );
};
