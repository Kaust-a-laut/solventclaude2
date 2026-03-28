import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { socket } from '../lib/socket';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export const SystemStatus = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { isProcessing } = useAppStore();
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);

  useEffect(() => {
    const handleConnect = () => setIsSocketConnected(true);
    const handleDisconnect = () => setIsSocketConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-3 rounded-xl transition-all",
      collapsed ? "justify-center px-0" : "bg-white/[0.02] border border-white/5"
    )}>
      {/* Link Status Light */}
      <div className="relative group flex items-center justify-center">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full",
          isSocketConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-rose-500 animate-pulse"
        )} />
        {collapsed && (
          <div className="absolute left-full ml-4 px-2 py-1 bg-black border border-white/10 rounded text-[11px] font-black text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Link: {isSocketConnected ? 'Online' : 'Offline'}
          </div>
        )}
      </div>

      {/* Processing Light */}
      <div className="relative group flex items-center justify-center">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full",
          isProcessing ? "bg-jb-accent animate-pulse shadow-[0_0_8px_rgba(60,113,247,0.6)]" : "bg-slate-700"
        )} />
        {collapsed && (
          <div className="absolute left-full ml-4 px-2 py-1 bg-black border border-white/10 rounded text-[11px] font-black text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            LPU: {isProcessing ? 'Thinking' : 'Idle'}
          </div>
        )}
      </div>

      {/* Local Status Light */}
      <div className="relative group flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-jb-purple/40 border border-jb-purple/20" />
        {collapsed && (
          <div className="absolute left-full ml-4 px-2 py-1 bg-black border border-white/10 rounded text-[11px] font-black text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Neural Memory: Active
          </div>
        )}
      </div>

      {!collapsed && (
        <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">
          System Validated
        </span>
      )}
    </div>
  );
};
