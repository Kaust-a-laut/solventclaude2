import React from 'react';
import { MessageItem } from './MessageItem';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../lib/utils';
import { downloadImage } from '../lib/file-utils';
import { useVirtualMessages } from '../lib/useVirtualMessages';

interface MessageListProps {
  compact?: boolean;
}

export const MessageList = ({ compact }: MessageListProps) => {
  const { currentMode, isProcessing, modeConfigs, selectedCloudModel, selectedLocalModel, globalProvider, deviceInfo, imageProvider } = useAppStore(
    useShallow((state) => ({
      currentMode: state.currentMode,
      isProcessing: state.isProcessing,
      modeConfigs: state.modeConfigs,
      selectedCloudModel: state.selectedCloudModel,
      selectedLocalModel: state.selectedLocalModel,
      globalProvider: state.globalProvider,
      deviceInfo: state.deviceInfo,
      imageProvider: state.imageProvider,
    }))
  );

  const { scrollRef, virtualizer, messages } = useVirtualMessages();
  const isMobile = deviceInfo.isMobile;

  // Resolve Active Model Name for the prompt/header area
  // (Individual messages might vary, but for the 'AI' label we use the current config)
  const config = modeConfigs[currentMode] || { provider: 'auto', model: selectedCloudModel };
  let activeModel = config.model;

  if (currentMode === 'vision') {
    activeModel = imageProvider === 'huggingface' ? 'Stable Diffusion' :
                  imageProvider === 'local' ? 'Juggernaut XL' :
                  imageProvider === 'pollinations' ? 'Flux (Free)' : 'Imagen 3';
  } else if (config.provider === 'auto') {
    activeModel = globalProvider === 'local' ? selectedLocalModel : selectedCloudModel;
  } else if (globalProvider === 'local' && config.provider === 'gemini') {
    activeModel = selectedLocalModel;
  }

  const getTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isVision = currentMode === 'vision';
  const isCoding = currentMode === 'coding';
  const isCompact = compact || isCoding || isVision;

  return (
    <div className={cn(
      "flex-1 overflow-y-auto scrollbar-thin",
      isCompact ? "pt-20 pb-20 space-y-4" : "pt-[100px] pb-32 space-y-5",
      isMobile ? (compact ? "p-3 pt-16 pb-20" : "p-4 pt-20 pb-24") : "p-6"
    )} ref={scrollRef}>

      {messages.length === 0 && !isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-24 pointer-events-none select-none">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-jb-accent/60 animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-slate-400">Ready when you are</p>
            <p className="text-[10px] text-slate-600 max-w-xs text-center leading-relaxed">
              Ask a question, share an idea, or drop in a file to get started.
            </p>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualItem: { key: React.Key; index: number; start: number }) => {
            const m = messages[virtualItem.index];
            const isNew = virtualItem.index >= messages.length - 2;
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <MessageItem
                  message={m}
                  isUser={m.role === 'user'}
                  modelName={m.role === 'user' ? 'User' : (m.model || activeModel)}
                  time={getTime()}
                  onDownloadImage={downloadImage}
                  compact={isCompact}
                  animate={isNew}
                />
              </div>
            );
          })}
        </div>
      )}

      {isProcessing && (
         <div className="max-w-4xl mx-auto flex items-center gap-3 px-6">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-jb-accent/70 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-jb-accent/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-jb-accent/30 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[10px] font-bold text-slate-600">
              {activeModel} is thinking
            </span>
         </div>
      )}
    </div>
  );
};
