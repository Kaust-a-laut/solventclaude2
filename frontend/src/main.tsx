import React from 'react';
import ReactDOM from 'react-dom/client';
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
    </ErrorBoundary>
  );
};

/* Safety net: force scroll to 0 on html, body, AND #root.
   overflow:clip should prevent scrolling entirely, but Monaco editor
   and focus management can still trigger edge cases in Chromium.
   Only fires when the scroll target is html/body/#root — not Monaco internals. */
const lockDocScroll = (e: Event) => {
  const t = e.target;
  if (t !== document && t !== document.documentElement && t !== document.body
      && (t as HTMLElement)?.id !== 'root') return;
  document.documentElement.scrollTop = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollTop = 0;
  document.body.scrollLeft = 0;
  const root = document.getElementById('root');
  if (root) {
    root.scrollTop = 0;
    root.scrollLeft = 0;
  }
};
window.addEventListener('scroll', lockDocScroll, { capture: true, passive: true });
document.addEventListener('scroll', lockDocScroll, { capture: true, passive: true });
/* Also listen on #root itself — scroll events don't bubble, so
   capture on window/document won't catch #root-targeted scrolls. */
requestAnimationFrame(() => {
  const root = document.getElementById('root');
  if (root) {
    root.addEventListener('scroll', lockDocScroll, { passive: true });
  }
});

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
