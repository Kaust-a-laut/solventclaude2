import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ CRITICAL UI CRASH:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#020205] flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-rose-500/20 blur-[100px] rounded-full" />
            <div className="relative w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-2xl">
              <AlertTriangle size={48} />
            </div>
          </div>
          
          <h1 className="text-2xl font-black uppercase tracking-[0.3em] text-white mb-4">Neural Link Severed</h1>
          <p className="text-slate-400 max-w-md mb-8 font-medium leading-relaxed">
            The system encountered a critical synchronization error. The interface has been isolated to prevent further data corruption.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-3 bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-transform"
            >
              <RefreshCw size={18} />
              Reboot Interface
            </button>
            
            <button 
              onClick={() => {
                 localStorage.clear();
                 window.location.href = '/';
              }}
              className="w-full py-4 rounded-2xl border border-white/10 text-slate-500 font-black uppercase tracking-widest hover:text-white hover:bg-white/5 transition-all"
            >
              Flush Cache & Reset
            </button>
          </div>

          {import.meta.env.DEV && (
            <div className="mt-12 p-6 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-left max-w-2xl overflow-auto max-h-48 scrollbar-hide">
              <p className="text-rose-400 font-mono text-xs">{this.state.error?.stack}</p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
