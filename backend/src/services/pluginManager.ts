import fs from 'fs/promises';
import path from 'path';
import { IProviderPlugin, IToolPlugin, ProviderCapabilities } from '../types/plugins';
import { logger } from '../utils/logger';

export interface PluginRegistry {
  providers: Map<string, IProviderPlugin>;
  tools: Map<string, IToolPlugin>;
}

export class PluginManager {
  private registry: PluginRegistry = {
    providers: new Map(),
    tools: new Map()
  };
  
  private pluginDirectories = {
    providers: path.join(__dirname, '../plugins/providers'),
    tools: path.join(__dirname, '../plugins/tools')
  };
  
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('[PluginManager] Initializing plugin system...');
    
    // Create plugin directories if they don't exist
    await this.createPluginDirectories();
    
    // Load all plugins
    await this.loadAllPlugins();
    
    this.isInitialized = true;
    logger.info('[PluginManager] Plugin system initialized successfully');
  }

  private async createPluginDirectories(): Promise<void> {
    for (const dirPath of Object.values(this.pluginDirectories)) {
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (error) {
        logger.error(`[PluginManager] Failed to create directory: ${dirPath}`, error);
      }
    }
  }

  private async loadAllPlugins(): Promise<void> {
    const [providerResults, toolResults] = await Promise.allSettled([
      this.loadProviderPlugins(),
      this.loadToolPlugins()
    ]);

    if (providerResults.status === 'rejected') {
      logger.error('[PluginManager] Provider plugin loading failed:', providerResults.reason);
    }
    if (toolResults.status === 'rejected') {
      logger.error('[PluginManager] Tool plugin loading failed:', toolResults.reason);
    }
  }

  private async loadProviderPlugins(): Promise<void> {
    const providerDir = this.pluginDirectories.providers;
    
    try {
      const files = await fs.readdir(providerDir);
      const jsFiles = files.filter(file => 
        (file.endsWith('.js') || file.endsWith('.ts')) && 
        !file.endsWith('.d.ts')
      );
      
      await Promise.allSettled(
        jsFiles.map(async (file) => {
          const filePath = path.join(providerDir, file);
          try {
            const module = await import(filePath);
            const PluginClass = module.default || module;

            if (typeof PluginClass === 'function') {
              const instance = new PluginClass();
              if (this.isValidProviderPlugin(instance)) {
                await this.registerProvider(instance);
              } else {
                logger.warn(`[PluginManager] Invalid provider plugin: ${file}`);
              }
            }
          } catch (err: unknown) {
            logger.error(`[PluginManager] Failed to load provider plugin ${file}:`, err instanceof Error ? err.message : String(err));
          }
        })
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('[PluginManager] Error reading provider plugins directory', error);
      }
      // Directory doesn't exist, which is fine - it will be created when needed
    }
  }

  private async loadToolPlugins(): Promise<void> {
    const toolDir = this.pluginDirectories.tools;
    
    try {
      const files = await fs.readdir(toolDir);
      const jsFiles = files.filter(file => 
        (file.endsWith('.js') || file.endsWith('.ts')) && 
        !file.endsWith('.d.ts')
      );
      
      await Promise.allSettled(
        jsFiles.map(async (file) => {
          const filePath = path.join(toolDir, file);
          try {
            const module = await import(filePath);
            const PluginClass = module.default || module;

            if (typeof PluginClass === 'function') {
              const instance = new PluginClass();
              if (this.isValidToolPlugin(instance)) {
                await this.registerTool(instance);
              } else {
                logger.warn(`[PluginManager] Invalid tool plugin: ${file}`);
              }
            }
          } catch (err: unknown) {
            logger.error(`[PluginManager] Failed to load tool plugin ${file}:`, err instanceof Error ? err.message : String(err));
          }
        })
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('[PluginManager] Error reading tool plugins directory', error);
      }
      // Directory doesn't exist, which is fine - it will be created when needed
    }
  }

  private isValidProviderPlugin(plugin: any): plugin is IProviderPlugin {
    return (
      plugin &&
      typeof plugin.id === 'string' &&
      typeof plugin.name === 'string' &&
      typeof plugin.description === 'string' &&
      typeof plugin.version === 'string' &&
      typeof plugin.complete === 'function' &&
      typeof plugin.isReady === 'function'
    );
  }

  private isValidToolPlugin(plugin: any): plugin is IToolPlugin {
    return (
      plugin &&
      typeof plugin.id === 'string' &&
      typeof plugin.name === 'string' &&
      typeof plugin.description === 'string' &&
      typeof plugin.version === 'string' &&
      typeof plugin.execute === 'function' &&
      typeof plugin.schema === 'object' &&
      typeof plugin.isReady === 'function'
    );
  }

  async registerProvider(provider: IProviderPlugin): Promise<void> {
    if (this.registry.providers.has(provider.id)) {
      logger.warn(`[PluginManager] Provider with ID ${provider.id} already registered, replacing...`);
    }
    
    // Initialize the provider if it has an initialize method
    if (provider.initialize) {
      try {
        await provider.initialize({});
      } catch (error) {
        logger.error(`[PluginManager] Failed to initialize provider ${provider.id}`, error);
        return;
      }
    }
    
    this.registry.providers.set(provider.id, provider);
    logger.info(`[PluginManager] Provider registered: ${provider.id}`);
  }

  async registerTool(tool: IToolPlugin): Promise<void> {
    if (this.registry.tools.has(tool.id)) {
      logger.warn(`[PluginManager] Tool with ID ${tool.id} already registered, replacing...`);
    }
    
    // Initialize the tool if it has an initialize method
    if (tool.initialize) {
      try {
        await tool.initialize({});
      } catch (error) {
        logger.error(`[PluginManager] Failed to initialize tool ${tool.id}`, error);
        return;
      }
    }
    
    this.registry.tools.set(tool.id, tool);
    logger.info(`[PluginManager] Tool registered: ${tool.id}`);
  }

  getProvider(id: string): IProviderPlugin | undefined {
    return this.registry.providers.get(id);
  }

  getTool(id: string): IToolPlugin | undefined {
    return this.registry.tools.get(id);
  }

  getAllProviders(): IProviderPlugin[] {
    return Array.from(this.registry.providers.values());
  }

  getAllTools(): IToolPlugin[] {
    return Array.from(this.registry.tools.values());
  }

  getRegistry(): PluginRegistry {
    return { ...this.registry }; // Return a copy to prevent external mutations
  }

  /**
   * Resolve the best available provider using 3-tier fallback:
   * 1. Explicit request (if provided, ready, and circuit closed)
   * 2. Default provider from config (if ready and circuit closed)
   * 3. First available ready provider with closed circuit
   *
   * @param requested - Explicitly requested provider ID
   * @param defaultProvider - Default provider ID (falls back to config.DEFAULT_PROVIDER)
   * @param requiredCapabilities - Optional capabilities filter
   */
  async resolveProvider(
    requested?: string,
    defaultProvider?: string,
    requiredCapabilities?: Partial<ProviderCapabilities>
  ): Promise<IProviderPlugin> {
    const { config } = await import('../config');
    const { circuitBreaker } = await import('./circuitBreaker');
    const effectiveDefault = defaultProvider || config.DEFAULT_PROVIDER;

    // Helper to check if provider meets capability requirements
    const meetsCapabilities = (provider: IProviderPlugin): boolean => {
      if (!requiredCapabilities) return true;
      const caps = provider.capabilities;
      if (!caps) return false; // If provider has no capabilities, it can't meet requirements

      for (const [key, value] of Object.entries(requiredCapabilities)) {
        const capValue = (caps as any)[key as keyof ProviderCapabilities];
        if (value === true && !capValue) {
          return false;
        }
        if (typeof value === 'number' && typeof capValue === 'number' && capValue < value) {
          return false;
        }
      }
      return true;
    };

    // Helper to check if provider is available (ready and circuit not open)
    const isAvailable = (providerId: string): boolean => {
      const provider = this.registry.providers.get(providerId);
      if (!provider || !provider.isReady()) return false;
      // We'll check circuit state in the actual resolution
      return true;
    };

    // 1. Try explicitly requested provider (if circuit allows)
    if (requested) {
      if (isAvailable(requested) && meetsCapabilities(this.registry.providers.get(requested)!)) {
        if (!(await circuitBreaker.isOpen(requested))) {
          logger.debug(`[PluginManager] Resolved explicit provider: ${requested}`);
          return this.registry.providers.get(requested)!;
        } else {
          logger.warn(`[PluginManager] Circuit breaker open for requested provider: ${requested}`);
        }
      } else {
        logger.warn(`[PluginManager] Requested provider ${requested} not ready or missing capabilities`);
      }
    }

    // 2. Try default provider (if circuit allows)
    if (effectiveDefault) {
      if (isAvailable(effectiveDefault) && meetsCapabilities(this.registry.providers.get(effectiveDefault)!)) {
        if (!(await circuitBreaker.isOpen(effectiveDefault))) {
          logger.debug(`[PluginManager] Resolved default provider: ${effectiveDefault}`);
          return this.registry.providers.get(effectiveDefault)!;
        } else {
          logger.warn(`[PluginManager] Circuit breaker open for default provider: ${effectiveDefault}`);
        }
      }
    }

    // 3. Find first ready provider that meets capabilities and has closed circuit
    for (const provider of this.registry.providers.values()) {
      if (provider.isReady() &&
          meetsCapabilities(provider) &&
          !(await circuitBreaker.isOpen(provider.id))) {
        logger.info(`[PluginManager] Resolved fallback provider: ${provider.id}`);
        return provider;
      }
    }

    throw new Error('No operational AI providers found in the plugin system. All available providers are either unhealthy or circuit is open.');
  }

  async reload(): Promise<void> {
    logger.info('[PluginManager] Reloading all plugins...');

    // Clear current registry
    this.registry.providers.clear();
    this.registry.tools.clear();

    // Reload all plugins
    await this.loadAllPlugins();

    logger.info('[PluginManager] Plugins reloaded successfully');
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();