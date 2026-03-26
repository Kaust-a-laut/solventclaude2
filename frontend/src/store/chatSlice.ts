import { StateCreator } from 'zustand';
import { AppState, Message } from './types';

export interface ChatSlice {
  sessions: Record<string, Message[]>;
  messages: Message[]; // Current active messages
  codingMessages: Message[]; // Legacy/Specific for coding if needed
  isProcessing: boolean;
  lastGeneratedImage: string | null;
  addMessage: (message: Message, target?: string) => void;
  updateLastMessage: (content: string, target?: string) => void;
  setMessages: (messages: Message[], target?: string) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setLastGeneratedImage: (url: string | null) => void;
}

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set, get) => ({
  sessions: {},
  messages: [],
  codingMessages: [],
  isProcessing: false,
  lastGeneratedImage: null,
  
  addMessage: (message, target) => set((state) => {
    const activeMode = target || state.currentMode;
    const currentMessages = state.sessions[activeMode] || [];
    const msgWithId = message.id ? message : { ...message, id: crypto.randomUUID() };
    const newMessages = [...currentMessages, msgWithId];
    
    return { 
      sessions: { ...state.sessions, [activeMode]: newMessages },
      messages: activeMode === state.currentMode ? newMessages : state.messages
    };
  }),

  updateLastMessage: (content, target) => set((state) => {
    const activeMode = target || state.currentMode;
    const targetMessages = state.sessions[activeMode] || [];

    if (targetMessages.length > 0) {
      const updatedMessages = [...targetMessages];
      const lastIndex = updatedMessages.length - 1;
      updatedMessages[lastIndex] = {
        ...updatedMessages[lastIndex],
        content: updatedMessages[lastIndex].content + content
      };
      
      return { 
        sessions: { ...state.sessions, [activeMode]: updatedMessages },
        messages: activeMode === state.currentMode ? updatedMessages : state.messages
      };
    }
    return state;
  }),

  setMessages: (messages, target) => set((state) => {
    const activeMode = target || state.currentMode;
    return { 
      sessions: { ...state.sessions, [activeMode]: messages },
      messages: activeMode === state.currentMode ? messages : state.messages
    };
  }),

  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setLastGeneratedImage: (url) => set({ lastGeneratedImage: url }),
});