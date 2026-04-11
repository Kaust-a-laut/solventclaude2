import { IProviderPlugin } from '../types/plugins';
import { pluginManager } from './pluginManager';
import { logger } from '../utils/logger';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
  priority?: number;
}

export interface Settings {
  providers: Record<string, ProviderConfig>;
  defaultProvider: string;
  temperature: number;
  maxTokens: number;
  imageProvider: string;
  globalProvider: 'cloud' | 'local' | 'auto';
}

export class SettingsService {
  private static readonly SETTINGS_FILE = './settings.json';
  private settings: Settings | null = null;

  async initialize(): Promise<void> {
    await this.loadSettings();
  }

  async loadSettings(): Promise<Settings> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const settingsPath = path.resolve(__dirname, '../../', SettingsService.SETTINGS_FILE);
      const data = await fs.readFile(settingsPath, 'utf8');
      this.settings = JSON.parse(data);
    } catch (error) {
      // If settings file doesn't exist, create default settings
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.settings = this.getDefaultSettings();
        await this.saveSettings();
      } else {
        logger.error('[SettingsService] Error loading settings:', error);
        this.settings = this.getDefaultSettings();
      }
    }
    
    return this.settings!;
  }

  async saveSettings(): Promise<void> {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const settingsPath = path.resolve(__dirname, '../../', SettingsService.SETTINGS_FILE);
      await fs.writeFile(settingsPath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (error) {
      logger.error('[SettingsService] Error saving settings:', error);
      throw error;
    }
  }

  getDefaultSettings(): Settings {
    return {
      providers: {
        gemini: { enabled: true, priority: 1 },
        groq: { enabled: true, priority: 2 },
        ollama: { enabled: true, priority: 3 },
        openrouter: { enabled: true, priority: 4 },
        huggingface: { enabled: true, priority: 5 },
        puter: { enabled: true, priority: 6 }
      },
      defaultProvider: 'gemini',
      temperature: 0.7,
      maxTokens: 4096,
      imageProvider: 'gemini',
      globalProvider: 'auto'
    };
  }

  async getSettings(): Promise<Settings> {
    if (!this.settings) {
      await this.loadSettings();
    }
    return { ...this.settings! };
  }

  async updateSettings(newSettings: Partial<Settings>): Promise<Settings> {
    if (!this.settings) {
      await this.loadSettings();
    }
    
    // Merge the new settings with existing ones
    this.settings = {
      ...this.settings!,
      ...newSettings
    };
    
    await this.saveSettings();
    return { ...this.settings! };
  }

  async getProviderConfig(providerId: string): Promise<ProviderConfig | null> {
    if (!this.settings) {
      await this.loadSettings();
    }
    
    return this.settings!.providers[providerId] || null;
  }

  async updateProviderConfig(providerId: string, config: Partial<ProviderConfig>): Promise<ProviderConfig> {
    if (!this.settings) {
      await this.loadSettings();
    }
    
    const existingConfig = this.settings!.providers[providerId] || { enabled: true };
    this.settings!.providers[providerId] = { ...existingConfig, ...config };
    
    await this.saveSettings();
    return this.settings!.providers[providerId];
  }

  async getAvailableProviders(): Promise<IProviderPlugin[]> {
    return pluginManager.getAllProviders();
  }

  async getProviderCapabilities(providerId: string) {
    const provider = await pluginManager.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }
    
    return {
      id: provider.id,
      name: provider.name,
      description: provider.description,
      version: provider.version,
      defaultModel: provider.defaultModel,
      capabilities: provider.capabilities,
      isReady: provider.isReady()
    };
  }

  async validateProviderApiKey(providerId: string, apiKey: string): Promise<boolean> {
    const provider = await pluginManager.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    try {
      // Initialize the provider with the test key
      if (provider.initialize) {
        await provider.initialize({ apiKey });
      }

      if (!provider.isReady()) return false;

      // For non-chat providers (serper, huggingface image), init check is enough
      if (!provider.complete) {
        return true;
      }

      // Ollama cloud: key is stored and used when :cloud models are called — skip completion test
      if (providerId === 'ollama') {
        return true;
      }

      // Make a real API call to verify the key works (1 token max)
      const testMessages = [{ role: 'user' as const, content: 'hi' }];
      await provider.complete(testMessages, {
        model: provider.defaultModel || '',
        maxTokens: 1,
        apiKey,
      });
      return true;
    } catch (error: any) {
      // Pass message string only — AxiosError has circular refs that crash logger.scrub()
      logger.error(`[SettingsService] API key validation failed for ${providerId}: ${error?.message || error}`);
      return false;
    }
  }
}

export const settingsService = new SettingsService();