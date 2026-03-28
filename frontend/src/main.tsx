import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import { ChatArea } from './components/ChatArea';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppStore } from './store/useAppStore';
import { detectTier, TIER_CONFIG, type DeviceCapability } from './lib/performanceTier';
import './index.css';

console.log('✅ Solvent AI: System Core Synchronized');

const App = () => {
  return (
    <ErrorBoundary>
      <div className="h-full w-full bg-[#020205] text-white flex flex-col relative overflow-hidden">
         <ChatArea />
      </div>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(23, 23, 23, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderLeft: '3px solid transparent',
            borderImage: 'linear-gradient(180deg, rgba(60,113,247,0.6), rgba(157,91,210,0.6), rgba(251,146,60,0.5)) 1',
            color: '#e5e5e5',
            backdropFilter: 'blur(12px)',
          },
        }}
      />
    </ErrorBoundary>
  );
};

// Safety net: force scroll to 0 on document-level targets.
// Single capture listener on window catches all scroll events during capture phase.
const lockDocScroll = () => {
  document.documentElement.scrollTop = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollTop = 0;
  document.body.scrollLeft = 0;
};
window.addEventListener('scroll', lockDocScroll, { capture: true, passive: true });

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('❌ Critical: Root element not found in DOM');
}

// Detect performance tier on startup (Electron only)
if ((window as any).electron?.getDeviceCapability) {
  (window as any).electron.getDeviceCapability().then((cap: DeviceCapability) => {
    const tier = detectTier(cap);
    useAppStore.getState().setDetectedTier(tier);
    console.log(`[Performance] Detected tier: ${tier}`, cap);

    // Inform Electron main process of the appropriate telemetry interval
    const interval = TIER_CONFIG[tier].telemetryIntervalMs;
    (window as any).electron?.setTelemetryInterval?.(interval);
  });
}
