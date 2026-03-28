import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  MessageSquare, Globe, Brain, Swords, GitCompare, 
  Users, FlaskConical, ScanEye, Search, BookOpen, LineChart, ChevronRight, Settings, Code, Menu, X as CloseIcon,
  ChevronsLeft, ChevronsRight, PanelLeftClose, PanelLeftOpen, Home, Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { SystemStatus } from './SystemStatus';

export const Navigation = () => {
  const { currentMode, setCurrentMode, setSettingsOpen, deviceInfo } = useAppStore();
  const [isOpen, setIsOpen] = useState(false); // Mobile drawer state
  const [isCollapsed, setIsCollapsed] = useState(true); // Desktop sidebar collapse state

  const isMobile = deviceInfo.isMobile;

  const getActiveIconClass = (color?: string): string => {
    const glowMap: Record<string, string> = {
      'text-jb-accent': 'text-jb-accent drop-shadow-[0_0_8px_rgba(60,113,247,0.6)]',
      'text-jb-purple': 'text-jb-purple drop-shadow-[0_0_8px_rgba(157,91,210,0.6)]',
      'text-jb-orange': 'text-jb-orange drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]',
      'text-jb-cyan': 'text-jb-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]',
      'text-slate-300': 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]',
    };
    return glowMap[color || 'text-jb-accent'] ?? 'text-jb-accent drop-shadow-[0_0_8px_rgba(60,113,247,0.6)]';
  };

  const NavItem = ({ mode, icon: Icon, label, color }: any) => {
    const isActive = currentMode === mode;

    const getLineColor = (color?: string): string => {
      const lineMap: Record<string, string> = {
        'text-jb-accent': 'via-jb-accent/80',
        'text-jb-purple': 'via-jb-purple/80',
        'text-jb-orange': 'via-jb-orange/80',
        'text-jb-cyan': 'via-jb-cyan/80',
        'text-slate-300': 'via-white/60',
      };
      return lineMap[color || ''] ?? 'via-white/50';
    };

    const getActiveBg = (color?: string): string => {
      const bgMap: Record<string, string> = {
        'text-jb-accent': 'bg-jb-accent/[0.08]',
        'text-jb-purple': 'bg-jb-purple/[0.08]',
        'text-jb-orange': 'bg-jb-orange/[0.08]',
        'text-jb-cyan': 'bg-jb-cyan/[0.08]',
        'text-slate-300': 'bg-white/[0.06]',
      };
      return bgMap[color || ''] ?? 'bg-white/5';
    };

    return (
      <motion.button
        whileHover={{ x: isCollapsed ? 0 : 4, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setCurrentMode(mode);
          if (isMobile) setIsOpen(false);
        }}
        className={cn(
          "w-full flex items-center transition-all duration-300 group relative overflow-hidden",
          isActive
            ? `${getActiveBg(color)} text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]`
            : "text-slate-500 hover:text-slate-200",
          isCollapsed ? "justify-center px-0 py-3 rounded-xl" : "justify-between px-4 py-3 rounded-2xl"
        )}
        title={isCollapsed ? label : undefined}
      >
        {isActive && !isCollapsed && (
          <motion.div
            layoutId="navGlow"
            className="absolute left-0 top-[20%] bottom-[40%] w-[3px] rounded-full opacity-90"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(60,113,247,0.8), rgba(157,91,210,0.8), rgba(251,146,60,0.6), transparent)',
            }}
          />
        )}
        {isActive && !isCollapsed && (
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r from-current/5 to-transparent opacity-20 pointer-events-none`} />
        )}

        <div className={cn("flex items-center relative z-10", isCollapsed ? "justify-center" : "gap-3")}>
          <Icon size={18} className={cn("transition-all duration-500", isActive ? getActiveIconClass(color) : "group-hover:text-slate-300")} />
          {!isCollapsed && (
             <span className={cn("font-bold text-[13px] tracking-tight transition-colors duration-300 whitespace-nowrap", isActive ? "text-white" : "font-semibold")}>{label}</span>
          )}
        </div>

        {isActive && !isCollapsed && (
          <motion.div layoutId="navIndicator" className="flex items-center relative z-10">
             <ChevronRight size={12} className="text-white/30" />
          </motion.div>
        )}
      </motion.button>
    );
  };

  const navContent = (
    <div className={cn(
      "h-full flex flex-col relative z-20 transition-all duration-300",
      isMobile ? "w-full" : (isCollapsed ? "w-20" : "w-72")
    )}>
      <div className={cn(
        "flex items-center",
        isCollapsed ? "p-4 flex-col gap-4 justify-center" : "p-6 pb-8 justify-between"
      )}>
        {/* Desktop Collapse Toggle */}
        {!isMobile && (
           <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn(
                 "p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors",
                 isCollapsed ? "mt-1" : ""
              )}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
           >
              {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
           </button>
        )}

        {isMobile && (
          <button onClick={() => setIsOpen(false)} className="p-2 text-slate-500 hover:text-white">
            <CloseIcon size={24} />
          </button>
        )}
      </div>

      <div className={cn("flex-1 overflow-y-auto scrollbar-hide space-y-10", isCollapsed ? "px-2 space-y-6" : "px-6")}>
        <div className="space-y-1.5">
          {!isCollapsed && (
            <div className="flex items-center gap-2 px-4 mb-4">
              <span className="w-1 h-1 rounded-full bg-jb-accent/60" />
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Modes</p>
            </div>
          )}
          <NavItem mode="home" icon={Home} label="Overview" color="text-slate-300" />
          <NavItem mode="chat" icon={MessageSquare} label="Chat" color="text-jb-accent" />
          <NavItem mode="vision" icon={ScanEye} label="SolventSee Lab" color="text-jb-orange" />
          <NavItem mode="coding" icon={Code} label="Coding Suite" color="text-jb-cyan" />
          <NavItem mode="browser" icon={Globe} label="Web Search" color="text-jb-purple" />
        </div>

        {!isCollapsed && (
          <div className="px-4">
            <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          </div>
        )}

        <div className="space-y-1.5">
           {!isCollapsed && (
             <div className="flex items-center gap-2 px-4 mb-4">
               <span className="w-1 h-1 rounded-full bg-jb-purple/60" />
               <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Model Lab</p>
             </div>
           )}
           <NavItem mode="model_playground" icon={Sparkles} label="Lab Center" color="text-jb-purple" />
           <NavItem mode="compare" icon={GitCompare} label="Compare" color="text-jb-accent" />
           <NavItem mode="debate" icon={Swords} label="Debate" color="text-jb-orange" />
           <NavItem mode="collaborate" icon={Users} label="Multi-Agent" color="text-jb-cyan" />
           <NavItem mode="waterfall" icon={FlaskConical} label="Waterfall Lab" color="text-jb-purple" />
        </div>
      </div>

      <div className={cn("p-8 pt-0", isCollapsed ? "p-3" : "")}>
        <SystemStatus collapsed={isCollapsed} />
        
        <div className={cn("mt-4", isCollapsed ? "mt-4" : "")}>
           <motion.button
             whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', x: isCollapsed ? 0 : 4 }}
             whileTap={{ scale: 0.98 }}
             onClick={() => {
               setSettingsOpen(true);
               if (isMobile) setIsOpen(false);
             }}
             className={cn(
               "w-full flex items-center rounded-2xl text-slate-500 hover:text-white transition-all group",
               isCollapsed ? "justify-center py-3" : "gap-3 px-4 py-3"
             )}
             title="Settings"
           >
              <div className={cn("flex items-center justify-center transition-colors", isCollapsed ? "" : "w-8 h-8 rounded-lg bg-white/5 group-hover:bg-white/10")}>
                 <Settings size={16} />
              </div>
              {!isCollapsed && <span className="text-[13px] font-bold tracking-tight">Settings</span>}
           </motion.button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed top-6 left-6 z-40 p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-white"
        >
          <Menu size={20} />
        </button>
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ willChange: 'transform' }}
                className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-slate-950 z-[60] border-r border-white/10 shadow-2xl"
              >
                {navContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <motion.div
       className="h-full bg-black/40 backdrop-blur-3xl border-r border-white/5 flex flex-col relative z-20 overflow-hidden"
       animate={{ width: isCollapsed ? 80 : 288 }}
       transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Ambient corner glow */}
      <div className="pointer-events-none absolute top-0 left-0 w-40 h-40 bg-jb-accent/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-32 h-32 bg-jb-purple/5 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
      {navContent}
    </motion.div>
  );
};