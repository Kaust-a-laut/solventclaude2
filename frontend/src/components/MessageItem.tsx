import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, Download, ChevronRight, Shield, Cloud, BrainCircuit, Brain, Trash2, Ban } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import { cn } from '../lib/utils';
import { ChatService } from '../services/ChatService';

interface MessageItemProps {
  message: any;
  isUser: boolean;
  modelName?: string;
  time: string;
  onDownloadImage?: (url: string, fileName: string) => void;
  compact?: boolean;
  animate?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message, isUser, modelName = 'AI', time, onDownloadImage, compact = false, animate = true
}) => {
  const [showThinking, setShowThinking] = useState(false);
  const [deprecatedIds, setDeprecatedIds] = useState<Set<string>>(new Set());

  const handleDeprecate = async (id: string, text: string) => {
    if (!window.confirm(`Are you sure you want to deprecate this wisdom? It will be removed from all future sessions.\n\n"${text.substring(0, 100)}..."`)) return;
    
    try {
      await ChatService.deprecateMemory(id, 'User manually deprecated from HUD.');
      setDeprecatedIds(prev => new Set(prev).add(id));
    } catch (e) {
      console.error('Deprecation failed:', e);
    }
  };

  const content = typeof message.content === 'string' ? message.content : '';
  // Extract <thinking> blocks
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const thinkingContent = thinkingMatch ? thinkingMatch[1].trim() : null;
  const displayContent = content.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();

  // Determine Provider Type for Badge
  const isLocal = modelName?.toLowerCase().includes('ollama') || 
                  modelName?.toLowerCase().includes('local') ||
                  modelName?.toLowerCase().includes('deepseek-r1:8b'); 

  const rootClassName = cn(
    "flex gap-4 max-w-none py-6 group relative first:mt-4",
    compact ? "px-4 py-3 gap-3" : "px-4 md:px-8",
    isUser ? "flex-row-reverse" : "flex-row"
  );

  const Root = animate ? motion.div : 'div';
  const rootProps = animate
    ? { initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, className: rootClassName }
    : { className: rootClassName };

  return (
    <Root {...rootProps as any}>
      {!isUser && (
        <div className="absolute left-0 top-0 w-full h-full pointer-events-none overflow-hidden">
           <div className="absolute -left-20 top-0 w-48 h-48 bg-jb-accent/5 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </div>
      )}

      {/* Avatar Section */}
      <div className="shrink-0 flex flex-col items-center gap-1.5 relative z-10">
        <div className={cn(
          "rounded-xl flex items-center justify-center shadow-2xl border transition-all duration-500",
          compact ? "w-5 h-5" : "w-8 h-8",
          isUser
            ? "bg-jb-accent/20 border-jb-accent/30 text-jb-accent"
            : "bg-black/60 border-white/10 text-slate-400 group-hover:border-jb-accent/40 group-hover:text-jb-accent"
        )}>
          {isUser ? <User size={compact ? 10 : 16} /> : <Bot size={compact ? 10 : 16} />}
        </div>
        
        {!isUser && (
           <div className={cn(
              "text-[11px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full border flex items-center gap-1 backdrop-blur-md",
              isLocal 
                 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                 : "bg-jb-accent/10 text-jb-accent border-jb-accent/20"
           )}>
              {isLocal ? <Shield size={7} /> : <Cloud size={7} />}
              {!compact && (isLocal ? 'Local' : 'Cloud')}
           </div>
        )}
      </div>

      {/* Content Section */}
      <div className={cn(
        "flex-1 min-w-0 space-y-2 relative z-10",
        isUser && "text-right"
      )}>
        <div className={cn(
           "flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-0.5",
           isUser && "justify-end"
        )}>
          <span className={cn("transition-colors", isUser ? "text-jb-accent" : "text-slate-300 group-hover:text-white")}>
             {isUser ? 'Operator' : modelName}
          </span>
          <span className="opacity-40">{time}</span>
        </div>

        {/* Thinking Accordion (DeepSeek/Gemini Style) */}
        {thinkingContent && (
           <div className="mb-4">
              <button 
                 onClick={() => setShowThinking(!showThinking)}
                 className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-all duration-300 text-[11px] font-bold uppercase tracking-widest border",
                    showThinking 
                      ? "bg-jb-purple/10 border-jb-purple/30 text-jb-purple" 
                      : "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10"
                 )}
              >
                 <Brain size={13} className={cn(showThinking && "animate-pulse")} />
                 <span>{showThinking ? 'Hide Thought Process' : 'Thought Process'}</span>
                 <ChevronRight size={12} className={cn("transition-transform duration-500", showThinking && "rotate-90")} />
              </button>
              
              <AnimatePresence>
                 {showThinking && (
                    <motion.div
                       initial={{ height: 0, opacity: 0 }}
                       animate={{ height: 'auto', opacity: 1 }}
                       exit={{ height: 0, opacity: 0 }}
                       className="overflow-hidden mt-2"
                    >
                       <div className={cn(
                         "font-mono text-slate-400 leading-relaxed whitespace-pre-wrap border-l-2 border-jb-purple/30 pl-4 py-1 my-2 italic",
                         compact ? "text-[11px]" : "text-[11.5px]"
                       )}>
                          {thinkingContent}
                       </div>
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>
        )}

        {/* Main Message Bubble */}
        <div className={cn(
          "prose prose-invert max-w-none prose-p:leading-[1.6] prose-pre:p-0 prose-pre:bg-transparent font-sans",
          isUser
            ? cn("glass-panel bg-jb-accent/5 rounded-2xl rounded-tr-sm p-3.5 px-4 inline-block text-white text-left border-jb-accent/20", compact ? "text-[11px] p-2 px-3" : "text-[13px]")
            : cn("text-slate-300 liquid-message rounded-2xl p-4 -ml-4", compact ? "text-[12px] p-2 -ml-2" : "text-[14.5px]")
        )}>
           <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                 code({node, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                       <CodeBlock 
                          language={match[1] ?? ''}
                          code={String(children).replace(/\n$/, '')} 
                       />
                    ) : (
                       <code className="bg-white/5 px-1.5 py-0.5 rounded text-jb-accent font-mono text-[12px] border border-white/5" {...props}>
                          {children}
                       </code>
                    );
                 }
              }}
           >
              {displayContent}
           </ReactMarkdown>

           {/* Image Attachment */}
           {message.imageUrl && (
              <div className="mt-4 relative group rounded-xl overflow-hidden border border-white/10 shadow-2xl max-w-xl">
                 <img src={message.imageUrl} alt="Generated" className="w-full h-auto" />
                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center gap-3 backdrop-blur-sm">
                    <button 
                       onClick={() => onDownloadImage?.(message.imageUrl!, `generated-${Date.now()}.png`)}
                       className="p-2.5 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-2xl"
                    >
                       <Download size={20} />
                    </button>
                 </div>
              </div>
           )}

           {/* Context Trace (Provenance) HUD */}
           {!isUser && message.provenance && (
              <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-white/5 opacity-60 hover:opacity-100 transition-opacity duration-500">
                 <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 w-full mb-1">
                    Context Trace Telemetry
                 </div>
                 
                 {/* Workspace Badge & HUD */}
                 {message.provenance.counts.workspace > 0 && (
                    <div className="group/hud relative">
                       <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-slate-400 text-[11px] font-bold cursor-help">
                          <Shield size={10} />
                          <span>{message.provenance.counts.workspace} WORKSPACE</span>
                       </div>
                       <div className="absolute bottom-full left-0 mb-2 w-64 hidden group-hover/hud:block z-50 animate-in fade-in slide-in-from-bottom-2">
                          <div className="bg-black/90 border border-white/10 rounded-lg p-3 backdrop-blur-xl shadow-2xl">
                             <div className="text-[11px] font-black text-slate-400 uppercase tracking-tighter mb-2 border-b border-white/10 pb-1">Active File Context</div>
                             <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {message.provenance.workspaceFiles.map((file: string, i: number) => (
                                   <div key={i} className="text-[11px] font-mono text-slate-300 truncate">/ {file}</div>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

                 {/* Project/Local Badge & HUD */}
                 {message.provenance.counts.local > 0 && (
                    <div className="group/hud relative">
                       <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-jb-accent/10 border border-jb-accent/20 text-jb-accent text-[11px] font-bold cursor-help">
                          <Brain size={10} />
                          <span>{message.provenance.counts.local} PROJECT</span>
                       </div>
                       <div className="absolute bottom-full left-0 mb-2 w-80 hidden group-hover/hud:block z-50 animate-in fade-in slide-in-from-bottom-2">
                          <div className="bg-black/90 border border-jb-accent/30 rounded-lg p-3 backdrop-blur-xl shadow-2xl">
                             <div className="text-[11px] font-black text-jb-accent uppercase tracking-tighter mb-2 border-b border-jb-accent/20 pb-1">Crystallized Memories</div>
                             <div className="space-y-2">
                                {message.provenance.active.filter((p: any) => p.source === 'LOCAL').map((p: any, i: number) => (
                                   <div key={i} className={cn(
                                      "text-[11px] text-slate-300 leading-relaxed border-l border-jb-accent/30 pl-2 group/item relative",
                                      deprecatedIds.has(p.id) && "opacity-40 line-through"
                                   )}>
                                      <div className="flex justify-between items-start gap-2">
                                         <span className="text-jb-accent font-black uppercase text-[11px] block">{p.type}</span>
                                         {!deprecatedIds.has(p.id) && (
                                            <button 
                                               onClick={() => handleDeprecate(p.id, p.text)}
                                               className="opacity-0 group-hover/item:opacity-100 text-slate-500 hover:text-rose-400 transition-all p-0.5"
                                               title="Kill this memory"
                                            >
                                               <Trash2 size={10} />
                                            </button>
                                         )}
                                      </div>
                                      {p.text}
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

                 {/* Global Patterns Badge & HUD */}
                 {(message.provenance.counts.global > 0 || message.provenance.suppressed.some((p: any) => p.source === 'GLOBAL')) && (
                    <div className="group/hud relative">
                       <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold cursor-help border",
                          message.provenance.counts.global > 0 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                       )}>
                          <BrainCircuit size={10} />
                          <span>{message.provenance.counts.global} GLOBAL</span>
                       </div>
                       <div className="absolute bottom-full left-0 mb-2 w-80 hidden group-hover/hud:block z-50 animate-in fade-in slide-in-from-bottom-2">
                          <div className="bg-black/90 border border-emerald-500/30 rounded-lg p-3 backdrop-blur-xl shadow-2xl">
                             <div className="text-[11px] font-black text-emerald-400 uppercase tracking-tighter mb-2 border-b border-emerald-500/20 pb-1">Universal Engineering Wisdom</div>
                             
                             <div className="space-y-3">
                                {/* Active Patterns */}
                                {message.provenance.active.filter((p: any) => p.source === 'GLOBAL').map((p: any, i: number) => (
                                   <div key={i} className={cn(
                                      "text-[11px] text-slate-200 leading-relaxed border-l-2 border-emerald-500 pl-2 group/item relative",
                                      deprecatedIds.has(p.id) && "opacity-40 line-through"
                                   )}>
                                      <div className="flex justify-between items-start gap-2">
                                         <span className="text-emerald-400 font-black uppercase text-[11px] flex items-center gap-1">
                                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                            Active Pattern
                                         </span>
                                         {!deprecatedIds.has(p.id) && (
                                            <button 
                                               onClick={() => handleDeprecate(p.id, p.text)}
                                               className="opacity-0 group-hover/item:opacity-100 text-slate-500 hover:text-rose-400 transition-all p-0.5"
                                               title="Deprecate this pattern globally"
                                            >
                                               <Ban size={10} />
                                            </button>
                                         )}
                                      </div>
                                      {p.text}
                                   </div>
                                ))}

                                {/* Suppressed Conflicts */}
                                {message.provenance.suppressed.filter((p: any) => p.source === 'GLOBAL').map((p: any, i: number) => (
                                   <div key={i} className="text-[11px] text-slate-500 leading-relaxed border-l-2 border-rose-500/50 pl-2 opacity-80">
                                      <span className="text-rose-400 font-black uppercase text-[11px] flex items-center gap-1">
                                         <div className="w-1 h-1 rounded-full bg-rose-400" />
                                         Suppressed Pattern
                                      </span>
                                      <div className="italic text-[11px] mb-1">Reason: {p.reason}</div>
                                      <span className="line-through decoration-rose-500/30">{p.text}</span>
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

                 {/* Rules Badge */}
                 {message.provenance.counts.rules > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold">
                       <Shield size={10} />
                       <span>{message.provenance.counts.rules} RULES</span>
                    </div>
                 )}
              </div>
           )}
        </div>
      </div>
    </Root>
  );
};