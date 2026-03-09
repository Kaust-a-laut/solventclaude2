import { StateCreator } from 'zustand';
import { AppState, DeviceInfo } from './types';
import { APP_CONFIG } from '../lib/config';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
  priority?: number;
}

export interface SettingsSlice {
  backend: 'gemini' | 'ollama' | 'deepseek' | 'openrouter' | 'groq';
  currentMode: string;
  smartRouterEnabled: boolean;
  selectedLocalModel: string;
  selectedCloudModel: string;
  selectedCloudProvider: 'gemini' | 'groq' | 'deepseek' | 'openrouter' | 'puter';
  selectedOpenRouterModel: string;
  modeConfigs: Record<string, { provider: string, model: string }>;
  temperature: number;
  maxTokens: number;
  settingsOpen: boolean;
  settingsInitialTab: string | null;
  setSettingsInitialTab: (tab: string | null) => void;
  auraMode: 'off' | 'static' | 'organic';
  thinkingModeEnabled: boolean;
  imageProvider: 'gemini' | 'pollinations' | 'local' | 'huggingface' | 'fal' | 'openai' | 'replicate';
  localImageUrl: string;
  showCodingChat: boolean;
  notepadContent: string;
  openFiles: { path: string; content: string }[];
  activeFile: string | null;
  supervisorInsight: string | null;
  globalProvider: 'cloud' | 'local' | 'auto';
  deviceInfo: DeviceInfo;
  apiKeys: Record<string, string>;
  isCommandCenterOpen: boolean;
  commandCenterPiPOpen: boolean;
  browserHistory: string[];
  lastSearchResults: any | null;
  activities: any[];
  availableProviders: any[];
  providerConfigs: Record<string, ProviderConfig>;

  setBackend: (backend: any) => void;
  setCurrentMode: (mode: string) => void;
  setSmartRouterEnabled: (enabled: boolean) => void;
  setSelectedLocalModel: (model: string) => void;
  setSelectedCloudModel: (model: string) => void;
  setSelectedCloudProvider: (provider: 'gemini' | 'groq' | 'deepseek' | 'openrouter' | 'puter') => void;
  setSelectedOpenRouterModel: (model: string) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  setSettingsOpen: (open: boolean) => void;
  setAuraMode: (mode: any) => void;
  setThinkingModeEnabled: (enabled: boolean) => void;
  setImageProvider: (provider: 'gemini' | 'pollinations' | 'local' | 'huggingface' | 'fal' | 'openai' | 'replicate') => void;
  setLocalImageUrl: (url: string) => void;
  setShowCodingChat: (show: boolean) => void;
  setGlobalProvider: (provider: any) => void;
  setModeConfig: (mode: string, config: any) => void;
  setDeviceInfo: (info: DeviceInfo) => void;
  setNotepadContent: (content: string) => void;
  setOpenFiles: (files: { path: string; content: string }[]) => void;
  setActiveFile: (path: string | null) => void;
  setSupervisorInsight: (insight: string | null) => void;
  setApiKey: (provider: string, key: string) => void;
  setIsCommandCenterOpen: (open: boolean) => void;
  toggleCommandCenter: () => void;
  setCommandCenterPiPOpen: (open: boolean) => void;
  setBrowserHistory: (history: string[]) => void;
  setLastSearchResults: (results: any) => void;
  addActivity: (activity: any) => void;
  setAvailableProviders: (providers: any[]) => void;
  setProviderConfigs: (configs: Record<string, ProviderConfig>) => void;
  updateProviderConfig: (providerId: string, config: Partial<ProviderConfig>) => void;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
  backend: APP_CONFIG.providers.primary,
  currentMode: 'home',
  smartRouterEnabled: true,
  selectedLocalModel: APP_CONFIG.models.local.primary,
  selectedCloudModel: APP_CONFIG.models.cloud.primary,
  selectedCloudProvider: APP_CONFIG.providers.primary,
  selectedOpenRouterModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
  modeConfigs: APP_CONFIG.modeConfigs,
  temperature: APP_CONFIG.defaults.temperature,
  maxTokens: APP_CONFIG.defaults.maxTokens,
  settingsOpen: false,
  settingsInitialTab: null,
  auraMode: 'off',
  thinkingModeEnabled: false,
  imageProvider: APP_CONFIG.defaults.imageProvider,
  localImageUrl: 'http://127.0.0.1:7860/sdapi/v1/txt2img',
  showCodingChat: true,
  notepadContent: "",
  openFiles: [],
  activeFile: null,
  supervisorInsight: null,
  globalProvider: 'auto',
  deviceInfo: {
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth < 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
    windowSize: { 
      width: typeof window !== 'undefined' ? window.innerWidth : 0, 
      height: typeof window !== 'undefined' ? window.innerHeight : 0 
    }
  },
  apiKeys: {},
  isCommandCenterOpen: false,
  commandCenterPiPOpen: false,
  browserHistory: [],
  lastSearchResults: null,
  activities: [],
  availableProviders: [],
  providerConfigs: {},

  setBackend: (backend) => set({ backend }),
  setCurrentMode: (currentMode) => set((state: any) => ({
    currentMode,
    messages: state.sessions[currentMode] || []
  })),
  setSmartRouterEnabled: (smartRouterEnabled) => set({ smartRouterEnabled }),
  setSelectedLocalModel: (selectedLocalModel) => set({ selectedLocalModel }),
  setSelectedCloudModel: (selectedCloudModel) => set({ selectedCloudModel }),
  setSelectedCloudProvider: (selectedCloudProvider) => set({ selectedCloudProvider }),
  setSelectedOpenRouterModel: (selectedOpenRouterModel) => set({ selectedOpenRouterModel }),
  setTemperature: (temperature) => set({ temperature }),
  setMaxTokens: (maxTokens) => set({ maxTokens }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsInitialTab: (settingsInitialTab) => set({ settingsInitialTab }),
  setAuraMode: (auraMode) => set({ auraMode }),
  setThinkingModeEnabled: (thinkingModeEnabled) => set({ thinkingModeEnabled }),
  setImageProvider: (imageProvider) => set({ imageProvider }),
  setLocalImageUrl: (localImageUrl) => set({ localImageUrl }),
  setShowCodingChat: (showCodingChat) => set({ showCodingChat }),
  setGlobalProvider: (globalProvider) => set({ globalProvider }),
  setModeConfig: (mode, config) => set((state) => ({
    modeConfigs: { ...state.modeConfigs, [mode]: config }
  })),
  setDeviceInfo: (deviceInfo) => set({ deviceInfo }),
  setNotepadContent: (notepadContent) => set({ notepadContent }),
  setOpenFiles: (openFiles) => set({ openFiles }),
  setActiveFile: (activeFile) => set({ activeFile }),
  setSupervisorInsight: (supervisorInsight) => set({ supervisorInsight }),
  setApiKey: (provider, key) => set((state) => ({
    apiKeys: { ...state.apiKeys, [provider]: key }
  })),
  setIsCommandCenterOpen: (isCommandCenterOpen) => set({ isCommandCenterOpen }),
  toggleCommandCenter: () => set((state) => ({ isCommandCenterOpen: !state.isCommandCenterOpen })),
  setCommandCenterPiPOpen: (commandCenterPiPOpen) => set({ commandCenterPiPOpen }),
  setBrowserHistory: (browserHistory) => set({ browserHistory }),
  setLastSearchResults: (lastSearchResults) => set({ lastSearchResults }),
  addActivity: (activity) => set((state) => ({
    activities: [activity, ...state.activities].slice(0, 50)
      })),
  setAvailableProviders: (availableProviders) => set({ availableProviders }),
  setProviderConfigs: (providerConfigs) => set({ providerConfigs }),
  updateProviderConfig: (providerId, config) => set((state) => ({
    providerConfigs: {
      ...state.providerConfigs,
      [providerId]: {
        ...(state.providerConfigs[providerId] || {}),
        ...config
      }
    }
  })),
});