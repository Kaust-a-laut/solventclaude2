import React, { Suspense, useEffect, lazy, useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useDevice } from '../hooks/useDevice';
import AuraBackground from './AuraBackground';
import { Navigation } from './Navigation';
import { ChatView } from './ChatView';
import { HomeArea } from './HomeArea';
import { FloatingNotepad } from './FloatingNotepad';
import { Network, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TitleBar } from './TitleBar';
import { SettingsModal } from './SettingsModal';
import { SupervisorHistory } from './SupervisorHistory';
import { KnowledgeMapMini } from './KnowledgeMapMini';
import { cn } from '../lib/utils';

// Lazy load feature areas to slim down the main bundle
const DebateArea = lazy(() => import('./DebateArea').then(m => ({ default: m.DebateArea })));
const CompareArea = lazy(() => import('./CompareArea').then(m => ({ default: m.CompareArea })));
const CollaborateArea = lazy(() => import('./CollaborateArea').then(m => ({ default: m.CollaborateArea })));
const WaterfallArea = lazy(() => import('./WaterfallArea').then(m => ({ default: m.WaterfallArea })));
const CodingArea = lazy(() => import('./CodingArea').then(m => ({ default: m.CodingArea })));
const BrowserArea = lazy(() => import('./BrowserArea').then(m => ({ default: m.BrowserArea })));
const SolventSeeArea = lazy(() => import('./SolventSeeArea').then(m => ({ default: m.SolventSeeArea })));
const ModelPlaygroundArea = lazy(() => import('./ModelPlaygroundArea').then(m => ({ default: m.ModelPlaygroundArea })));

const LoadingFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-4">
    <Loader2 className="w-8 h-8 text-jb-purple animate-spin" />
    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Initializing Neural Canvas...</span>
  </div>
);

export const ChatArea = () => {
  const { currentMode, setCurrentMode, setDeviceInfo, deviceInfo, setSupervisorInsight, supervisorInsight, addActivity, graphNodes, isProcessing } = useAppStore(
    useShallow((state) => ({
      currentMode: state.currentMode,
      setCurrentMode: state.setCurrentMode,
      setDeviceInfo: state.setDeviceInfo,
      deviceInfo: state.deviceInfo,
      setSupervisorInsight: state.setSupervisorInsight,
      supervisorInsight: state.supervisorInsight,
      addActivity: state.addActivity,
      graphNodes: state.graphNodes,
      isProcessing: state.isProcessing,
    }))
  );
  const device = useDevice();
  // Graph pulse effect - track when new nodes are added
  const prevNodeCount = useRef(graphNodes.length);
  const [graphPulse, setGraphPulse] = useState(false);
  const [newNodeCount, setNewNodeCount] = useState(0);

  useEffect(() => {
    if (graphNodes.length > prevNodeCount.current) {
      const diff = graphNodes.length - prevNodeCount.current;
      setNewNodeCount(diff);
      setGraphPulse(true);

      // Add activity for new nodes
      addActivity({
        id: `graph-update-${Date.now()}`,
        type: 'graph',
        message: `Knowledge graph expanded: +${diff} node${diff > 1 ? 's' : ''}`,
        timestamp: new Date().toISOString(),
        source: 'system'
      });

      setTimeout(() => {
        setGraphPulse(false);
        setNewNodeCount(0);
      }, 2000);
    }
    prevNodeCount.current = graphNodes.length;
  }, [graphNodes.length, addActivity]);

  useEffect(() => {
    if (window.electron?.onModeChanged) {
      return window.electron.onModeChanged((mode: string) => {
        setCurrentMode(mode as any);
      });
    }
  }, [setCurrentMode]);

  useEffect(() => {
    if (
      device.isMobile !== deviceInfo.isMobile ||
      device.isTablet !== deviceInfo.isTablet ||
      device.windowSize.width !== deviceInfo.windowSize.width ||
      device.windowSize.height !== deviceInfo.windowSize.height
    ) {
      setDeviceInfo(device);
    }
  }, [device, setDeviceInfo, deviceInfo]);

  useEffect(() => {
    if (window.electron?.onSupervisorNudge) {
      const cleanup = window.electron.onSupervisorNudge((nudge: any) => {
        setSupervisorInsight(nudge.message);
        setTimeout(() => setSupervisorInsight(null), 10000);
      });
      return cleanup;
    }
  }, []);

  useEffect(() => {
    if (window.electron && (window.electron as any).onSupervisorData) {
      return (window.electron as any).onSupervisorData((activity: any) => {
        addActivity(activity);
      });
    }
  }, [addActivity]);

  const renderContent = () => {
    const areas: Record<string, React.ReactNode> = {
      home: <HomeArea />,
      model_playground: <ModelPlaygroundArea />,
      debate: <DebateArea />,
      compare: <CompareArea />,
      collaborate: <CollaborateArea />,
      waterfall: <WaterfallArea />,
      vision: <SolventSeeArea />,
      coding: <CodingArea />,
      browser: <BrowserArea />,
      chat: <ChatView />
    };

    return areas[currentMode] || <ChatView />;
  };

  return (
    <AuraBackground>
      <div className="flex flex-col flex-1 min-h-0 w-full overflow-clip font-sans">
        <TitleBar />
        <div className="flex flex-1 overflow-clip relative">
          <Navigation />
          <AnimatePresence>
             <SettingsModal />
          </AnimatePresence>

          <div className="flex-1 flex h-full overflow-clip relative">
             <div className={cn(
               "flex-1 h-full flex flex-col border-r border-white/5 relative z-10 min-w-0 min-h-0 overflow-clip transition-all duration-500",
               graphPulse && "ring-2 ring-jb-purple/20 ring-inset",
               isProcessing && "intelligence-active"
             )}>
                {/* Graph Update Pulse Indicator */}
                <AnimatePresence>
                  {graphPulse && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-jb-purple/20 border border-jb-purple/30 rounded-full backdrop-blur-sm shadow-lg"
                    >
                      <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-jb-purple" />
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-jb-purple animate-ping" />
                      </div>
                      <span className="text-[10px] font-black text-jb-purple uppercase tracking-widest">
                        +{newNodeCount} Node{newNodeCount > 1 ? 's' : ''}
                      </span>
                      <Network size={12} className="text-jb-purple" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <Suspense fallback={<LoadingFallback />}>
                   {renderContent()}
                </Suspense>
                
             </div>
          </div>
        </div>
      </div>
      <FloatingNotepad />

      {/* Persistent Supervisor History Panel */}
      <SupervisorHistory />

      {/* Knowledge Map Mini Preview */}
      <KnowledgeMapMini />
    </AuraBackground>
  );
};