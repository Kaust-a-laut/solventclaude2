import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Cpu, Sliders, Key, Database, Search, Download, Upload,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { API_BASE_URL } from '../lib/config';
import { cn } from '../lib/utils';
import { TabButton } from './settings/shared';
import { TAB_TITLES, TAB_SUBTITLES, SETTINGS_DEFAULTS } from './settings/settingsDefaults';
import { useSettingsSearch } from './settings/useSettingsSearch';
import { AboutSection } from './settings/AboutSection';
import { ModelsTab } from './settings/ModelsTab';
import { BehaviorTab } from './settings/BehaviorTab';
import { ApiKeysTab } from './settings/ApiKeysTab';
import { MemoryTab } from './settings/MemoryTab';

type TabId = 'models' | 'behavior' | 'api-keys' | 'memory';

export const SettingsModal = () => {
  const {
    settingsOpen, setSettingsOpen,
    settingsInitialTab, setSettingsInitialTab,
    apiKeys,
  } = useAppStore(
    useShallow((s) => ({
      settingsOpen: s.settingsOpen,
      setSettingsOpen: s.setSettingsOpen,
      settingsInitialTab: s.settingsInitialTab,
      setSettingsInitialTab: s.setSettingsInitialTab,
      apiKeys: s.apiKeys,
    }))
  );

  const [activeTab, setActiveTab] = useState<TabId>('models');
  const [serviceHealth, setServiceHealth] = useState<{ ollama: 'connected' | 'disconnected' }>({ ollama: 'disconnected' });
  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults } = useSettingsSearch();
  const importRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Health check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settingsOpen) return;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health/services`);
        setServiceHealth(await res.json());
      } catch {
        setServiceHealth({ ollama: 'disconnected' });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [settingsOpen]);

  // ── Initial tab from external navigation ──────────────────────────────────
  useEffect(() => {
    if (settingsOpen && settingsInitialTab) {
      setActiveTab(settingsInitialTab as TabId);
      setSettingsInitialTab(null);
    }
  }, [settingsOpen, settingsInitialTab, setSettingsInitialTab]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSettingsOpen(false); return; }
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === '1') { e.preventDefault(); setActiveTab('models'); }
      if (isMod && e.key === '2') { e.preventDefault(); setActiveTab('behavior'); }
      if (isMod && e.key === '3') { e.preventDefault(); setActiveTab('api-keys'); }
      if (isMod && e.key === '4') { e.preventDefault(); setActiveTab('memory'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settingsOpen, setSettingsOpen]);

  // ── Search result navigation ──────────────────────────────────────────────
  const navigateToSetting = (tab: TabId, id: string) => {
    setSearchQuery('');
    setActiveTab(tab);
    requestAnimationFrame(() => {
      const el = document.getElementById(`settings-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-jb-accent/30', 'rounded-2xl');
        setTimeout(() => el.classList.remove('ring-2', 'ring-jb-accent/30', 'rounded-2xl'), 1500);
      }
    });
  };

  // ── Export/Import ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const state = useAppStore.getState();
    const exportData = {
      _solventSettings: true,
      _exportedAt: new Date().toISOString(),
      globalProvider: state.globalProvider,
      selectedCloudModel: state.selectedCloudModel,
      selectedCloudProvider: state.selectedCloudProvider,
      selectedLocalModel: state.selectedLocalModel,
      selectedOpenRouterModel: state.selectedOpenRouterModel,
      imageProvider: state.imageProvider,
      localImageUrl: state.localImageUrl,
      modeConfigs: state.modeConfigs,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      smartRouterEnabled: state.smartRouterEnabled,
      thinkingModeEnabled: state.thinkingModeEnabled,
      showCodingChat: state.showCodingChat,
      auraMode: state.auraMode,
      performanceMode: state.performanceMode,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solvent-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data._solventSettings) {
          alert('Invalid settings file.');
          return;
        }
        const state = useAppStore.getState();
        if (data.globalProvider) state.setGlobalProvider(data.globalProvider);
        if (data.selectedCloudModel) state.setSelectedCloudModel(data.selectedCloudModel);
        if (data.selectedCloudProvider) state.setSelectedCloudProvider(data.selectedCloudProvider);
        if (data.selectedLocalModel) state.setSelectedLocalModel(data.selectedLocalModel);
        if (data.selectedOpenRouterModel) state.setSelectedOpenRouterModel(data.selectedOpenRouterModel);
        if (data.imageProvider) state.setImageProvider(data.imageProvider);
        if (data.localImageUrl) state.setLocalImageUrl(data.localImageUrl);
        if (data.temperature != null) state.setTemperature(data.temperature);
        if (data.maxTokens != null) state.setMaxTokens(data.maxTokens);
        if (data.smartRouterEnabled != null) state.setSmartRouterEnabled(data.smartRouterEnabled);
        if (data.thinkingModeEnabled != null) state.setThinkingModeEnabled(data.thinkingModeEnabled);
        if (data.showCodingChat != null) state.setShowCodingChat(data.showCodingChat);
        if (data.auraMode) state.setAuraMode(data.auraMode);
        if (data.performanceMode) state.setPerformanceMode(data.performanceMode);
        if (data.modeConfigs) {
          Object.entries(data.modeConfigs).forEach(([mode, config]: [string, any]) => {
            state.setModeConfig(mode, config);
          });
        }
      } catch {
        alert('Failed to parse settings file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!settingsOpen) return null;

  const tabs: { id: TabId; label: string; icon: any; shortcut: string }[] = [
    { id: 'models',    label: 'Models',    icon: Cpu,      shortcut: '\u2318 1' },
    { id: 'behavior',  label: 'Behavior',  icon: Sliders,  shortcut: '\u2318 2' },
    { id: 'api-keys',  label: 'API Keys',  icon: Key,      shortcut: '\u2318 3' },
    { id: 'memory',    label: 'Memory',    icon: Database, shortcut: '\u2318 4' },
  ];

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
        style={{ willChange: 'transform' }}
        className="w-full max-w-7xl h-[92vh] bg-[#050508] border border-white/5 rounded-[40px] shadow-2xl relative overflow-hidden flex"
      >
        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        <div className="w-64 border-r border-white/5 bg-white/[0.01] p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1 px-2">
            <h2 className="text-xl font-black text-white tracking-tighter">Settings</h2>
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">Configure your workspace</p>
          </div>

          {/* Settings Search */}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Find a setting..."
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-[10px] font-bold text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-jb-accent/30 transition-colors"
            />
          </div>

          {/* Search results OR tab nav */}
          {searchQuery && searchResults.length > 0 ? (
            <div className="flex flex-col gap-1 overflow-y-auto">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => navigateToSetting(r.tab, r.id)}
                  className="text-left px-3 py-2 rounded-xl hover:bg-white/[0.05] transition-colors group"
                >
                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-white block">{r.label}</span>
                  <span className="text-[8px] text-slate-600 font-medium">{r.description}</span>
                </button>
              ))}
            </div>
          ) : searchQuery && searchResults.length === 0 ? (
            <div className="px-3 py-4 text-[10px] text-slate-600 text-center">No results</div>
          ) : (
            <nav className="flex flex-col gap-2">
              {tabs.map(t => (
                <TabButton
                  key={t.id}
                  id={t.id}
                  label={t.label}
                  icon={t.icon}
                  isActive={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  shortcut={t.shortcut}
                />
              ))}
            </nav>
          )}

          {/* System Status */}
          <div className="mt-auto space-y-3">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">System Status</span>
                <span className="relative flex h-2 w-2">
                  <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    serviceHealth.ollama === 'connected' ? "bg-emerald-400" : "bg-rose-500"
                  )} />
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    serviceHealth.ollama === 'connected' ? "bg-emerald-500" : "bg-rose-600"
                  )} />
                </span>
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
            <AboutSection />
          </div>
        </div>

        {/* ── Right Content ─────────────────────────────────────────────────── */}
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

          <div ref={contentRef} className="flex-1 overflow-y-auto p-10 scrollbar-thin">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {activeTab === 'models' && <ModelsTab />}
                {activeTab === 'behavior' && <BehaviorTab />}
                {activeTab === 'api-keys' && <ApiKeysTab />}
                {activeTab === 'memory' && <MemoryTab />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <footer className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Key size={14} className="text-slate-700" />
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Protocol Protected — Local Session Only</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-white/5 pl-4">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[8px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-all"
                >
                  <Download size={10} /> Export
                </button>
                <button
                  onClick={() => importRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[8px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-all"
                >
                  <Upload size={10} /> Import
                </button>
                <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              </div>
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
