import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../lib/utils';
import { InlineToggle, SectionCard, staggerContainer, staggerItem } from './shared';
import { SETTINGS_DEFAULTS } from './settingsDefaults';
import { CustomSlider } from './CustomSlider';

export const BehaviorTab = () => {
  const {
    temperature, setTemperature,
    maxTokens, setMaxTokens,
    smartRouterEnabled, setSmartRouterEnabled,
    thinkingModeEnabled, setThinkingModeEnabled,
    showCodingChat, setShowCodingChat,
    performanceMode, setPerformanceMode,
    detectedTier,
    auraMode, setAuraMode,
  } = useAppStore(
    useShallow((s) => ({
      temperature: s.temperature, setTemperature: s.setTemperature,
      maxTokens: s.maxTokens, setMaxTokens: s.setMaxTokens,
      smartRouterEnabled: s.smartRouterEnabled, setSmartRouterEnabled: s.setSmartRouterEnabled,
      thinkingModeEnabled: s.thinkingModeEnabled, setThinkingModeEnabled: s.setThinkingModeEnabled,
      showCodingChat: s.showCodingChat, setShowCodingChat: s.setShowCodingChat,
      performanceMode: s.performanceMode, setPerformanceMode: s.setPerformanceMode,
      detectedTier: s.detectedTier,
      auraMode: s.auraMode, setAuraMode: s.setAuraMode,
    }))
  );

  const handleResetBehavior = () => {
    setTemperature(SETTINGS_DEFAULTS.temperature);
    setMaxTokens(SETTINGS_DEFAULTS.maxTokens);
    setSmartRouterEnabled(SETTINGS_DEFAULTS.smartRouterEnabled);
    setThinkingModeEnabled(SETTINGS_DEFAULTS.thinkingModeEnabled);
    setShowCodingChat(SETTINGS_DEFAULTS.showCodingChat);
    setPerformanceMode(SETTINGS_DEFAULTS.performanceMode);
    setAuraMode(SETTINGS_DEFAULTS.auraMode as any);
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-12">

      {/* Temperature */}
      <motion.section variants={staggerItem} className="space-y-8" id="settings-temperature">
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Temperature</h4>
              <button onClick={handleResetBehavior} className="flex items-center gap-1 text-[8px] font-black text-slate-700 hover:text-slate-400 uppercase tracking-widest transition-colors" title="Reset behavior to defaults">
                <RotateCcw size={9} /> Reset All
              </button>
            </div>
            <p className="text-[9px] text-slate-600 font-bold mt-1">Controls response randomness — 0 = deterministic, 1 = creative</p>
          </div>
          <span className="text-lg font-mono text-jb-accent">{temperature}</span>
        </div>
        <CustomSlider
          value={temperature}
          onChange={setTemperature}
          min={0} max={1} step={0.1}
          accent="blue"
          showTicks
          formatValue={v => v.toFixed(1)}
        />
      </motion.section>

      {/* Max Tokens */}
      <motion.section variants={staggerItem} className="space-y-8" id="settings-max-tokens">
        <div className="flex justify-between items-end">
          <div>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Max Tokens</h4>
            <p className="text-[9px] text-slate-600 font-bold mt-1">Maximum token budget per inference request</p>
          </div>
          <span className="text-lg font-mono text-jb-purple">{maxTokens.toLocaleString()}</span>
        </div>
        <CustomSlider
          value={maxTokens}
          onChange={setMaxTokens}
          min={512} max={16384} step={512}
          accent="purple"
          formatValue={v => v.toLocaleString()}
        />
      </motion.section>

      {/* Assistant Features */}
      <motion.section variants={staggerItem} className="space-y-2 pt-6 border-t border-white/5" id="settings-smart-router">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Assistant Features</h4>
        <SectionCard>
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
        </SectionCard>
      </motion.section>

      {/* Performance */}
      <motion.section variants={staggerItem} className="space-y-2 pt-6 border-t border-white/5" id="settings-performance-mode">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Performance</h4>
        <SectionCard>
          <div className="flex items-center justify-between py-4">
            <div className="flex flex-col gap-0.5 pr-8">
              <span className="text-xs font-bold text-white">Performance Mode</span>
              <span className="text-[10px] text-slate-500 font-medium leading-snug">
                Auto detects your hardware. Full enables all visual effects. Lite reduces animation complexity and background work for smoother performance.
              </span>
            </div>
            <div className="flex gap-1 bg-white/5 rounded-xl p-1">
              {(['auto', 'full', 'lite'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPerformanceMode(mode)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                    performanceMode === mode
                      ? "bg-jb-accent text-white shadow-[0_0_12px_rgba(60,113,247,0.3)]"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          {performanceMode === 'auto' && (
            <div className="pb-3 -mt-1">
              <span className="text-[9px] text-slate-600 font-medium">
                Detected: <span className="text-slate-400 font-bold uppercase">{detectedTier}</span>
              </span>
            </div>
          )}
        </SectionCard>
      </motion.section>

      {/* Aura */}
      <motion.section variants={staggerItem} className="space-y-6 pt-6 border-t border-white/5" id="settings-aura">
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
      </motion.section>
    </motion.div>
  );
};
