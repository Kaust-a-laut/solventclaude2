import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { WaterfallStageCard, STAGE_CONFIGS } from './waterfall/WaterfallStageCard';
import type { StageKey } from './waterfall/WaterfallStageCard';
import { WaterfallConnector } from './waterfall/WaterfallConnector';
import { WaterfallScore } from './waterfall/WaterfallScore';
import { WaterfallPresetPicker } from './waterfall/WaterfallPresetPicker';
import { WaterfallFlowPreview } from './waterfall/WaterfallFlowPreview';
import { WaterfallDetailPanel } from './waterfall/WaterfallDetailPanel';
import { STAGE_ORDER, IDLE_DOTS, INIT_DOTS, getStageModelLabel, getDismissedUpgrades, dismissUpgrade, upgradeKey } from './waterfall/waterfallConstants';
import { useModelAvailability } from './waterfall/useModelAvailability';
import { useStageTimings } from './waterfall/useStageTimings';
import { WaterfallHeader } from './waterfall/WaterfallHeader';
import { MissionDirectiveInput } from './waterfall/MissionDirectiveInput';

export const WaterfallArea = () => {
  const {
    deviceInfo,
    waterfall,
    waterfallAbortController,
    runFullWaterfall,
    cancelWaterfall,
    resetWaterfall,
    proceedWithWaterfall,
    editPlanDraft,
    setEditPlanDraft,
    applyEditedPlan,
    retryCount,
    setWaterfallCustomStage,
    waterfallModelSelection,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [selectedStage, setSelectedStage] = useState<StageKey | null>(null);

  const { unavailableModels, upgradeSuggestions } = useModelAvailability();
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => getDismissedUpgrades());

  const handleDismissUpgrade = (key: string) => {
    dismissUpgrade(key);
    setDismissedKeys(prev => new Set([...prev, key]));
  };

  const handleSwapModel = (stage: StageKey, model: string, provider: string) => {
    setWaterfallCustomStage(stage, { model, provider });
  };

  // ── Toast notifications for model upgrades ────────────────────────────────
  useEffect(() => {
    if (upgradeSuggestions.length === 0) return;
    const dismissed = getDismissedUpgrades();
    const toShow = upgradeSuggestions
      .filter((u) => !dismissed.has(upgradeKey(u)))
      .slice(0, 3);

    const timer = setTimeout(() => {
      for (const u of toShow) {
        const k = upgradeKey(u);
        toast.info(u.note, {
          description: `Used by: ${u.usedInPresets.join(', ')}`,
          duration: 8000,
          action: {
            label: 'Dismiss',
            onClick: () => handleDismissUpgrade(k),
          },
        });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [upgradeSuggestions]); // eslint-disable-line react-hooks/exhaustive-deps

  const stageTimings = useStageTimings(waterfall.steps);

  // ── Auto-select the most relevant stage ────────────────────────────────────
  useEffect(() => {
    // Auto-select: pick the stage currently processing, or the last completed one
    const processing = STAGE_ORDER.find((s) => waterfall.steps[s].status === 'processing');
    if (processing) {
      setSelectedStage(processing);
      return;
    }
    const paused = STAGE_ORDER.find((s) => waterfall.steps[s].status === 'paused');
    if (paused) {
      setSelectedStage(paused);
      return;
    }
    // Find last completed stage
    const completedStages = STAGE_ORDER.filter((s) => waterfall.steps[s].status === 'completed');
    if (completedStages.length > 0) {
      setSelectedStage(completedStages[completedStages.length - 1] ?? null);
    }
  }, [
    waterfall.steps.planner.status,
    waterfall.steps.executor.status,
    waterfall.steps.reviewer.status,
  ]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isStreaming   = waterfallAbortController !== null;
  const isActive      = waterfall.currentStep !== null;
  const isInitializing = !isActive && isStreaming;
  const reviewerScore = waterfall.steps.reviewer.data?.score;
  const allCompleted  = STAGE_ORDER.every((s) => waterfall.steps[s].status === 'completed');

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return;
    setSelectedStage(null);
    await runFullWaterfall(input);
  };

  const handleStartEditPlan = () => {
    const planData = waterfall.steps.planner.data;
    setEditPlanDraft(JSON.stringify(planData, null, 2));
  };

  const handleExportAll = () => {
    const payload = {
      prompt: waterfall.prompt,
      exportedAt: new Date().toISOString(),
      stages: Object.fromEntries(
        STAGE_ORDER.map((s) => [s, waterfall.steps[s].data]),
      ),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solvent-waterfall-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-black/20 backdrop-blur-3xl overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <WaterfallHeader
        isMobile={deviceInfo.isMobile}
        isActive={isActive}
        isStreaming={isStreaming}
        allCompleted={allCompleted}
        onCancel={cancelWaterfall}
        onExportAll={handleExportAll}
        onReset={() => { resetWaterfall(); setSelectedStage(null); }}
      />

      {/* ── Workspace ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 flex">

        {/* ─── Left Column ─────────────────────────────────────────────────── */}
        <div className={cn(
          'flex flex-col gap-6 overflow-y-scroll scrollbar-thin fluid-scrollbar transition-all duration-500',
          isActive
            ? 'w-[440px] shrink-0 p-6 border-r border-white/[0.04]'
            : 'flex-1 p-12',
        )}>
          <div className={cn(isActive ? 'flex flex-col gap-6' : 'flex flex-col gap-6 w-full')}>

            {/* ── Idle: two-column layout ────────────────────────────────────── */}
            {!isActive && !isStreaming && (
              <div className="grid grid-cols-[1fr,300px] gap-8 items-start">
                {/* Left: directive + preset picker + idle hint */}
                <div className="flex flex-col gap-6">
                  {/* Mission Directive textarea */}
                  <MissionDirectiveInput
                    value={input}
                    onChange={setInput}
                    onSubmit={handleSubmit}
                    isStreaming={isStreaming}
                    rows={3}
                  />

                  {/* Reviewer score ring */}
                  <AnimatePresence>
                    {reviewerScore != null && (
                      <motion.div
                        key="score-ring"
                        initial={{ opacity: 0, scale: 0.8, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                        className="flex justify-center py-2"
                      >
                        <WaterfallScore score={reviewerScore} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Preset Picker */}
                  <motion.div
                    key="model-selector"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <WaterfallPresetPicker
                      unavailableModels={unavailableModels}
                      upgradeSuggestions={upgradeSuggestions}
                      dismissedKeys={dismissedKeys}
                      onDismissUpgrade={handleDismissUpgrade}
                      onSwapModel={handleSwapModel}
                    />
                  </motion.div>

                  {/* Idle dots */}
                  <div className="flex flex-col items-center gap-8 py-12">
                    <div className="flex items-end gap-3">
                      {IDLE_DOTS.map((dot, i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -8, 0], opacity: [0.25, 0.65, 0.25] }}
                          transition={{
                            repeat: Infinity,
                            duration: 3,
                            delay: dot.delay,
                            ease: 'easeInOut',
                          }}
                          className={cn('w-2.5 h-2.5 rounded-full', dot.color)}
                          style={{ boxShadow: `0 0 8px ${dot.glow}` }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.45em] text-slate-400 text-center max-w-xs">
                      Enter a mission directive to begin the cascade
                    </p>
                  </div>
                </div>

                {/* Right: pipeline flow preview */}
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <WaterfallFlowPreview
                    upgradeSuggestions={upgradeSuggestions}
                    dismissedKeys={dismissedKeys}
                    onDismissUpgrade={handleDismissUpgrade}
                    onSwapModel={handleSwapModel}
                  />
                </motion.div>
              </div>
            )}

            {/* ── Active / Initializing states ───────────────────────────────── */}
            {(isActive || isStreaming) && (
              <>
                {/* Mission Directive textarea (compact) */}
                <MissionDirectiveInput
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  isStreaming={isStreaming}
                  rows={2}
                  vibrantBorder={isStreaming}
                />

                {/* Reviewer score ring */}
                <AnimatePresence>
                  {reviewerScore != null && (
                    <motion.div
                      key="score-ring"
                      initial={{ opacity: 0, scale: 0.8, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                      className="flex justify-center py-2"
                    >
                      <WaterfallScore score={reviewerScore} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {/* Initializing */}
                  {isInitializing && (
                    <motion.div
                      key="initializing"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex flex-col items-center gap-6 py-24"
                    >
                      <div className="flex items-center gap-4">
                        {INIT_DOTS.map((dot, i) => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.65, 1], opacity: [0.35, 1, 0.35] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: dot.delay, ease: 'easeInOut' }}
                            className={cn('w-4 h-4 rounded-full', dot.color)}
                            style={{ boxShadow: `0 0 18px ${dot.glow}` }}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-400 animate-pulse">
                        Initializing Pipeline...
                      </span>
                      <div className="flex flex-col gap-3 w-64 mt-4">
                        <div className="fluid-shimmer rounded-full h-2 w-full" />
                        <div className="fluid-shimmer rounded-full h-2 w-4/5 [animation-delay:0.4s]" />
                        <div className="fluid-shimmer rounded-full h-2 w-3/5 [animation-delay:0.8s]" />
                      </div>
                    </motion.div>
                  )}

                  {/* Active: compact stage cards with connectors */}
                  {isActive && (
                    <motion.div
                      key="pipeline"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col"
                    >
                      {STAGE_ORDER.map((stageKey, i) => {
                        const config  = STAGE_CONFIGS[stageKey];
                        const step    = waterfall.steps[stageKey];
                        const isLast  = i === STAGE_ORDER.length - 1;
                        const nextKey = !isLast ? STAGE_ORDER[i + 1] : null;
                        const isPlannerConnector = stageKey === 'planner';

                        return (
                          <div key={stageKey}>
                            <WaterfallStageCard
                              config={config}
                              status={step.status}
                              data={step.data}
                              error={step.error}
                              retryCount={stageKey === 'executor' ? retryCount : 0}
                              isExpanded={false}
                              onToggleExpand={() => {}}
                              timing={stageTimings[stageKey]}
                              compact
                              isSelected={selectedStage === stageKey}
                              onSelect={() => setSelectedStage(stageKey)}
                              modelLabel={getStageModelLabel(waterfallModelSelection[stageKey])}
                            />

                            {/* Connector between stages */}
                            {!isLast && nextKey && (
                              <WaterfallConnector
                                fromStatus={step.status}
                                fromColor={config.color}
                                toColor={STAGE_CONFIGS[nextKey].color}
                                showEditPlan={isPlannerConnector}
                                editPlanDraft={isPlannerConnector ? editPlanDraft : null}
                                onStartEdit={isPlannerConnector ? handleStartEditPlan : undefined}
                                onEditChange={isPlannerConnector ? setEditPlanDraft : undefined}
                                onApplyEdit={isPlannerConnector ? applyEditedPlan : undefined}
                                onCancelEdit={isPlannerConnector ? () => setEditPlanDraft(null) : undefined}
                                isPaused={isPlannerConnector ? step.status === 'paused' : false}
                                onProceed={isPlannerConnector ? proceedWithWaterfall : undefined}
                                onCancel={isPlannerConnector ? cancelWaterfall : undefined}
                              />
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>

        {/* ─── Right Column: Detail Panel (visible when pipeline is active) ── */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              key="detail-panel"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.3 }}
              className="flex-1 min-w-0 relative"
            >
              <div className="absolute inset-0 p-6 overflow-y-scroll scrollbar-thin">
                <WaterfallDetailPanel
                  selectedStage={selectedStage}
                  steps={waterfall.steps}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        </div>{/* close absolute inset-0 */}
      </div>
    </div>
  );
};
