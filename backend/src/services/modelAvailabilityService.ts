import { config } from '../config';
import { WATERFALL_PRESETS } from '../constants/models';
import { logger } from '../utils/logger';

interface ModelStatus {
  model: string;
  provider: string;
  available: boolean;
  usedInPresets: string[];  // preset keys that reference this model
}

export interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;
  usedInPresets: string[];
}

interface AvailabilityScanResult {
  scannedAt: string;
  unavailable: ModelStatus[];
  upgrades: UpgradeSuggestion[];
  scanErrors: string[];      // providers that failed to respond
}

// Provider model list endpoints
const PROVIDER_ENDPOINTS: Record<string, { url: string; keyEnv: string; parseModels: (data: any) => string[] }> = {
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    keyEnv: 'GROQ_API_KEY',
    parseModels: (data) => (data.data || []).map((m: any) => m.id),
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    keyEnv: 'OPENROUTER_API_KEY',
    parseModels: (data) => (data.data || []).map((m: any) => m.id),
  },
  dashscope: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    keyEnv: 'DASHSCOPE_API_KEY',
    parseModels: (data) => (data.data || []).map((m: any) => m.id),
  },
  cerebras: {
    url: 'https://api.cerebras.ai/v1/models',
    keyEnv: 'CEREBRAS_API_KEY',
    parseModels: (data) => (data.data || []).map((m: any) => m.id),
  },
};

class ModelAvailabilityService {
  private lastScan: AvailabilityScanResult | null = null;
  private providerModelCache: Map<string, Set<string>> = new Map();

  /**
   * Extract all unique model+provider pairs referenced by waterfall presets.
   */
  private getPresetModels(): Map<string, { model: string; provider: string; presets: string[] }> {
    const models = new Map<string, { model: string; provider: string; presets: string[] }>();

    for (const [presetKey, preset] of Object.entries(WATERFALL_PRESETS)) {
      const sel = preset.selection;
      for (const phase of ['architect', 'reasoner', 'executor', 'reviewer'] as const) {
        const choice = sel[phase];
        if (typeof choice === 'object') {
          const key = `${choice.provider}/${choice.model}`;
          const existing = models.get(key);
          if (existing) {
            existing.presets.push(presetKey);
          } else {
            models.set(key, { model: choice.model, provider: choice.provider, presets: [presetKey] });
          }
        }
      }
    }
    return models;
  }

  /**
   * Extract a prefix from a model ID for fuzzy family matching.
   * Strips version numbers, size tags, and provider suffixes.
   * Examples:
   *   'qwen3.5:cloud'                          → 'qwen'
   *   'qwen/qwen3-32b'                         → 'qwen/qwen'
   *   'meta-llama/llama-3.3-70b-instruct:free' → 'meta-llama/llama'
   *   'moonshotai/kimi-k2-instruct-0905'       → 'moonshotai/kimi'
   *   'deepseek-v3.2:cloud'                    → 'deepseek'
   *   'openai/gpt-oss-120b'                    → 'openai/gpt-oss'
   */
  private extractModelPrefix(model: string): string {
    // Strip :cloud, :free, and similar suffixes first
    let clean = model.replace(/:(cloud|free|latest)$/i, '');
    // Strip trailing instruct/chat tags and date stamps
    clean = clean.replace(/[-_](instruct|chat|preview|exp)[-_]?\d*$/i, '');
    // Strip size tags like -70b, -32b, -480b, -120b
    clean = clean.replace(/[-_]\d+b$/i, '');
    // Strip version-like trailing segments: -v3.2, -3.3, .5, -0905
    clean = clean.replace(/[-.]?\d+(\.\d+)*$/g, '');
    // Strip trailing hyphens/dots from aggressive stripping
    clean = clean.replace(/[-_.]+$/, '');
    return clean.toLowerCase();
  }

  /**
   * Detect potential model upgrades by prefix-matching preset models
   * against each provider's cached model list.
   */
  private detectUpgrades(
    presetModels: Map<string, { model: string; provider: string; presets: string[] }>
  ): UpgradeSuggestion[] {
    const upgrades: UpgradeSuggestion[] = [];
    // Collect all model IDs already used in presets per provider
    const usedByProvider = new Map<string, Set<string>>();
    for (const [, entry] of presetModels) {
      const set = usedByProvider.get(entry.provider) ?? new Set();
      set.add(entry.model);
      usedByProvider.set(entry.provider, set);
    }

    for (const [, entry] of presetModels) {
      const liveModels = this.providerModelCache.get(entry.provider);
      if (!liveModels) continue;

      const prefix = this.extractModelPrefix(entry.model);
      if (prefix.length < 3) continue; // too short to be meaningful

      const usedModels = usedByProvider.get(entry.provider) ?? new Set();

      for (const candidate of liveModels) {
        // Skip if it's the same model or already used in a preset
        if (candidate === entry.model || usedModels.has(candidate)) continue;

        const candidatePrefix = this.extractModelPrefix(candidate);
        if (candidatePrefix === prefix) {
          // Deduplicate: don't suggest the same successor for the same current model twice
          const alreadySuggested = upgrades.some(
            u => u.current.model === entry.model
              && u.current.provider === entry.provider
              && u.successor.model === candidate
          );
          if (alreadySuggested) continue;

          upgrades.push({
            current: { model: entry.model, provider: entry.provider },
            successor: { model: candidate, provider: entry.provider },
            note: `${candidate} available on ${entry.provider}`,
            usedInPresets: [...new Set(entry.presets)],
          });
        }
      }
    }

    return upgrades;
  }

  /**
   * Fetch available models from a provider's API.
   */
  private async fetchProviderModels(provider: string): Promise<string[] | null> {
    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) return null;  // unknown provider (e.g. ollama — skip for now)

    const apiKey = (config as any)[endpoint.keyEnv] || process.env[endpoint.keyEnv];
    if (!apiKey) {
      logger.debug(`[ModelAvailability] No API key for ${provider}, skipping scan`);
      return null;
    }

    try {
      const response = await fetch(endpoint.url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        logger.warn(`[ModelAvailability] ${provider} returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      return endpoint.parseModels(data);
    } catch (err: unknown) {
      logger.warn(`[ModelAvailability] Failed to fetch ${provider} models:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  /**
   * Scan all providers and check preset model availability.
   * Non-blocking — errors are captured, not thrown.
   */
  async scan(): Promise<AvailabilityScanResult> {
    const presetModels = this.getPresetModels();
    const scanErrors: string[] = [];

    // Fetch model lists from all providers in parallel
    const providers = [...new Set([...presetModels.values()].map(m => m.provider))];
    await Promise.all(
      providers.map(async (provider) => {
        const models = await this.fetchProviderModels(provider);
        if (models === null) {
          scanErrors.push(provider);
          return { provider, models: null };
        }
        this.providerModelCache.set(provider, new Set(models));
        return { provider, models };
      })
    );

    // Cross-reference preset models against live model lists
    const unavailable: ModelStatus[] = [];
    for (const [, entry] of presetModels) {
      const liveModels = this.providerModelCache.get(entry.provider);
      if (!liveModels) continue;  // provider scan failed — don't flag as unavailable

      if (!liveModels.has(entry.model)) {
        unavailable.push({
          model: entry.model,
          provider: entry.provider,
          available: false,
          usedInPresets: [...new Set(entry.presets)],
        });
      }
    }

    // Detect potential upgrades via prefix matching
    const upgrades = this.detectUpgrades(presetModels);

    this.lastScan = {
      scannedAt: new Date().toISOString(),
      unavailable,
      upgrades,
      scanErrors,
    };

    // Log results
    if (unavailable.length > 0) {
      logger.warn(`[ModelAvailability] ${unavailable.length} preset model(s) unavailable:`);
      for (const m of unavailable) {
        logger.warn(`  - ${m.provider}/${m.model} (used in: ${m.usedInPresets.join(', ')})`);
      }
    } else if (scanErrors.length === 0) {
      logger.info('[ModelAvailability] All preset models verified available');
    }

    if (upgrades.length > 0) {
      logger.info(`[ModelAvailability] ${upgrades.length} upgrade suggestion(s) found:`);
      for (const u of upgrades) {
        logger.info(`  - ${u.current.provider}/${u.current.model} → ${u.successor.model} (presets: ${u.usedInPresets.join(', ')})`);
      }
    }

    return this.lastScan;
  }

  /** Get the last scan result (or null if no scan has run yet). */
  getLastScan(): AvailabilityScanResult | null {
    return this.lastScan;
  }

  /** Check if a specific model is known to be unavailable. */
  isUnavailable(provider: string, model: string): boolean {
    if (!this.lastScan) return false;
    return this.lastScan.unavailable.some(m => m.provider === provider && m.model === model);
  }
}

export const modelAvailabilityService = new ModelAvailabilityService();
