import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, Mic, MicOff, X, Loader2, Sparkles, Paperclip, FileText, ChevronUp, ChevronDown, Brain, Plus } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { cn } from '../lib/utils';
import { fetchWithRetry } from '../lib/api-client';
import { NATIVE_THINKING_MODELS, THINK_ONLY_MODELS, DUAL_MODE_MODELS } from '../lib/thinkingModels';

const MODE_PLACEHOLDERS: Record<string, string> = {
  chat: 'Ask anything...',
  coding: 'Describe what to build or fix...',
  browser: 'Search or enter a URL...',
  vision: 'Describe an image to generate...',
  waterfall: 'Describe your pipeline goal...',
  debate: 'Set the debate topic...',
  compare: 'Enter a prompt to compare models...',
  collaborate: 'Direct the team...',
  model_playground: 'Test a prompt...',
  home: 'Ask anything...',
};

interface ChatInputProps {
  compact?: boolean;
}

export const ChatInput = ({ compact = false }: ChatInputProps) => {
  const { sendMessage, generateImageAction, isProcessing, addMessage, deviceInfo, thinkingModeEnabled, setThinkingModeEnabled, currentMode, selectedCloudModel, selectedLocalModel, globalProvider } = useAppStore();
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [uploadMode, setUploadMode] = useState<'image' | 'file'>('image');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string; originalName: string; content?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const activeModel = globalProvider === 'local' ? selectedLocalModel : selectedCloudModel;

  // Turn off thinking mode if user switches to a non-thinking model
  useEffect(() => {
    if (thinkingModeEnabled && !NATIVE_THINKING_MODELS.has(activeModel)) {
      setThinkingModeEnabled(false);
    }
  }, [activeModel, thinkingModeEnabled, setThinkingModeEnabled]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { isListening, transcript, startListening, stopListening, browserSupportsSpeechRecognition } = useSpeechToText();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage && !attachedFile) || isProcessing) return;

    if (isListening) stopListening();

    let finalContent = input;
    if (attachedFile) {
      if (attachedFile.content) {
        finalContent += `\n\n[System: The user attached a file named "${attachedFile.originalName}". Here is the content:]\n\n${attachedFile.content}`;
      } else {
        finalContent += `\n\n[System: User attached file: "${attachedFile.originalName}" available at ${attachedFile.url}]`;
      }
    }

    await sendMessage(finalContent, selectedImage);
    setInput('');
    setSelectedImage(null);
    setAttachedFile(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { BASE_URL } = await import('../lib/config');
      const data = await fetchWithRetry<{ filename?: string; content?: string }>(`${BASE_URL}/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (data.filename) {
        setAttachedFile({
          name: data.filename,
          originalName: file.name,
          url: `${BASE_URL}/files/${data.filename}`,
          content: data.content
        });
      }
    } catch (error) {
      console.error('File upload failed:', error);
      addMessage({ role: 'assistant', content: 'Error: Could not upload file.' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={cn("relative z-20", compact ? "p-3 pt-0" : "p-6 pt-0")}>
      <div className="max-w-4xl mx-auto relative group">
        <AnimatePresence>
          {(selectedImage || attachedFile) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn("flex items-center gap-3 px-2", compact ? "mb-2" : "mb-4")}
            >
              {selectedImage && (
                <div className="relative group">
                  <img src={selectedImage} className={cn("object-cover rounded-2xl border border-white/20 shadow-2xl", compact ? "h-12 w-12" : "h-16 w-16")} />
                  <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg">
                    <X size={10} />
                  </button>
                </div>
              )}
              {attachedFile && (
                <div className={cn("relative group glass-panel rounded-2xl flex items-center gap-3 shadow-2xl", compact ? "p-2 pr-6" : "p-3 pr-8")}>
                  <div className={cn("bg-jb-accent/10 rounded-xl text-jb-accent", compact ? "p-1.5" : "p-2")}>
                    <FileText size={compact ? 14 : 18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white max-w-[120px] truncate uppercase tracking-widest">{attachedFile.originalName}</span>
                    <span className="text-[7px] text-slate-500 mt-0.5 uppercase">Staged</span>
                  </div>
                  <button onClick={() => setAttachedFile(null)} className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg">
                    <X size={10} />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="vibrant-border rounded-[2rem] relative group shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
          <div className="hud-corner top-0 left-0 border-t-2 border-l-2 rounded-tl-[2rem] group-focus-within:border-jb-accent/40 transition-colors" />
          <div className="hud-corner bottom-0 right-0 border-b-2 border-r-2 rounded-br-[2rem] group-focus-within:border-jb-purple/40 transition-colors" />

          <div className={cn(
            "liquid-input flex items-center gap-2 relative z-10 overflow-hidden rounded-[2rem] border border-white/10",
            compact ? "p-1 px-3" : (deviceInfo.isMobile ? "p-1.5 px-3" : "p-2 px-4")
          )}>
            {/* Unified Action Menu */}
            <div className="flex items-center gap-1" ref={menuRef}>
               <button 
                onClick={() => setShowMenu(!showMenu)}
                className={cn(
                  "flex items-center justify-center transition-all rounded-2xl bg-black/40 hover:bg-black/60 text-slate-500 hover:text-white border border-white/5 hover:border-white/10",
                  compact ? "w-8 h-8" : (deviceInfo.isMobile ? "w-8 h-8" : "w-10 h-10")
                )}
               >
                  <motion.div animate={{ rotate: showMenu ? 45 : 0 }}>
                    <Plus size={compact ? 16 : (deviceInfo.isMobile ? 18 : 20)} className={cn("transition-colors", showMenu ? "text-jb-purple" : "text-jb-accent")} />
                  </motion.div>
               </button>

               {/* Deep Thinking — locked-on for think-only, toggle for dual-mode, hidden otherwise */}
               {THINK_ONLY_MODELS.has(activeModel) && (
               <div
                 className={cn(
                   "flex items-center justify-center rounded-2xl border",
                   compact ? "w-8 h-8" : (deviceInfo.isMobile ? "w-8 h-8" : "w-10 h-10"),
                   "bg-black/40 border-jb-purple/30 shadow-[0_0_15px_rgba(157,91,210,0.15)] cursor-default"
                 )}
                 title="This model always uses deep thinking"
               >
                  <Brain
                    size={compact ? 15 : (deviceInfo.isMobile ? 16 : 18)}
                    className="text-jb-purple drop-shadow-[0_0_8px_rgba(157,91,210,0.8)]"
                  />
               </div>
               )}
               {DUAL_MODE_MODELS.has(activeModel) && (
               <button
                 onClick={() => setThinkingModeEnabled(!thinkingModeEnabled)}
                 className={cn(
                   "flex items-center justify-center transition-all rounded-2xl border duration-300",
                   compact ? "w-8 h-8" : (deviceInfo.isMobile ? "w-8 h-8" : "w-10 h-10"),
                   "bg-black/40 border-white/5 hover:border-white/10",
                   thinkingModeEnabled && "border-jb-purple/30 shadow-[0_0_15px_rgba(157,91,210,0.15)]"
                 )}
                 title="Toggle Deep Thinking"
               >
                  <Brain
                    size={compact ? 15 : (deviceInfo.isMobile ? 16 : 18)}
                    className={cn(
                      "transition-all duration-500",
                      thinkingModeEnabled ? "text-jb-purple animate-pulse drop-shadow-[0_0_8px_rgba(157,91,210,0.8)]" : "text-slate-500"
                    )}
                  />
               </button>
               )}

               <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: -12, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-4 w-48 glass-panel rounded-2xl shadow-2xl p-2 overflow-hidden z-[100] border-white/[0.05]"
                    >
                       <div className="flex flex-col gap-1">
                          {[
                            { id: 'image', icon: ImageIcon, label: 'Visual Input', action: () => imageInputRef.current?.click(), color: 'text-jb-orange' },
                            { id: 'file', icon: Paperclip, label: 'Data Stream', action: () => fileInputRef.current?.click(), color: 'text-jb-cyan' },
                          ].map(item => (
                            <button 
                              key={item.id}
                              onClick={() => { item.action(); setShowMenu(false); }}
                              className={cn(
                                "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group hover:bg-white/[0.03] text-slate-500 hover:text-white"
                              )}
                            >
                               <div className="flex items-center gap-3">
                                 <item.icon size={15} className={cn("transition-transform group-hover:scale-110", item.color)} />
                                 <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                               </div>
                            </button>
                          ))}
                       </div>
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>

            <div className="flex-1 relative mx-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); adjustHeight(); }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder={MODE_PLACEHOLDERS[currentMode] || 'Send a message...'}
                className={cn(
                  "w-full bg-transparent border-none outline-none font-sans font-bold text-white placeholder:text-slate-800 resize-none scrollbar-hide overflow-y-auto",
                  compact ? "text-xs py-2 min-h-[34px] max-h-[120px]" : (deviceInfo.isMobile ? "text-xs py-3 min-h-[42px] max-h-[120px]" : "text-[14px] py-3 min-h-[42px] max-h-[160px]")
                )}
                rows={1}
              />
            </div>

            <div className="flex items-center gap-2">
              {browserSupportsSpeechRecognition && !compact && (
                <button 
                  onClick={toggleListening}
                  className={cn(
                    "transition-all rounded-2xl border bg-black/40 border-white/5 text-slate-500 hover:text-white hover:border-white/10",
                    deviceInfo.isMobile ? "p-2" : "p-2.5"
                  )}
                >
                  <Mic size={deviceInfo.isMobile ? 16 : 18} className={cn("transition-colors", isListening ? "text-rose-500 animate-pulse" : "hover:text-jb-accent")} />
                </button>
              )}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSend}
                disabled={(!input.trim() && !selectedImage && !attachedFile) || isProcessing}
                className={cn(
                  "bg-black/40 border border-white/5 rounded-2xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xl button-glow-hover font-black uppercase tracking-widest",
                  compact ? "w-8 h-8" : (deviceInfo.isMobile ? "w-10 h-10" : "px-6 h-11"),
                  compact ? "text-[8px]" : "text-[10px]",
                  "text-jb-accent hover:text-white hover:border-jb-accent/50"
                )}
              >
                {isProcessing ? <Loader2 size={14} className="animate-spin text-jb-purple" /> : (compact || deviceInfo.isMobile ? <Send size={compact ? 12 : 16} fill="currentColor" /> : "Send")}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Inputs */}
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleImageSelect} 
        accept="image/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />
    </div>
  );
};
