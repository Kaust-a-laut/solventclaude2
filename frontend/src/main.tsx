import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatArea } from './components/ChatArea';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

console.log('✅ Solvent AI: System Core Synchronized');

const App = () => {
  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-[#020205] text-white flex flex-col relative overflow-hidden">
         <ChatArea />
      </div>
    </ErrorBoundary>
  );
};

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
