import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, Trash2, History, Clock, Search, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SessionHistory = ({ isOpen, onClose }: SessionHistoryModalProps) => {
  const { messages, setMessages, sessions } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => { if (!isOpen) setSearchTerm(''); }, [isOpen]);

  const allSessions = Object.keys(sessions).map(id => {
    const msgs = sessions[id] ?? [];
    return {
      id,
      title: msgs[0]?.content.slice(0, 50) || 'New Conversation',
      count: msgs.length,
    };
  });

  const sessionList = searchTerm.trim()
    ? allSessions.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : allSessions;

  const createNewSession = () => { setMessages([]); onClose(); };

  const loadSession = (sessionId: string) => {
    if (sessions[sessionId]) setMessages(sessions[sessionId]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="sh-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            key="sh-modal"
            initial={{ opacity: 0, scale: 0.93, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 420 }}
            className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] max-w-[92vw] max-h-[68vh] flex flex-col bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <History size={15} className="text-jb-accent" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Session Archives</span>
                <span className="text-[11px] font-mono text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">{allSessions.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={createNewSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-jb-accent/10 border border-jb-accent/20 rounded-lg text-[11px] font-black uppercase text-jb-accent hover:bg-jb-accent/20 transition-all"
                >
                  <Plus size={10} /> New
                </button>
                <button onClick={onClose} className="p-1.5 text-slate-600 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-white/5">
              <div className="relative">
                <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                  className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 pl-8 pr-4 text-[11px] font-mono text-white placeholder:text-slate-700 outline-none focus:border-jb-accent/30 transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 no-scrollbar">
              {sessionList.length > 0 ? (
                sessionList.map(session => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-jb-accent/20 hover:bg-jb-accent/5 cursor-pointer transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-jb-accent transition-colors flex-shrink-0">
                      <MessageSquare size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-300 truncate group-hover:text-white">{session.title}</p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 mt-0.5">{session.count} messages</p>
                    </div>
                    <button
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-rose-400 transition-all"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-center">
                  <Clock size={20} className="text-slate-800 mb-2" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                    {searchTerm ? 'No sessions match' : 'No sessions yet'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-jb-accent shadow-[0_0_6px_rgba(60,113,247,0.6)]" />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Memory Synced</span>
              </div>
              <span className="text-[11px] font-mono text-jb-accent/50">98%</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
