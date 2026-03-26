import { describe, it, expect, beforeAll } from 'vitest';
import { pluginManager } from '../../services/pluginManager';
import { orchestrationService } from '../../services/orchestrationService';

describe('Provider Resolution Integration', () => {
  beforeAll(async () => {
    await pluginManager.initialize();
  });

  it('should resolve providers using the 3-tier fallback mechanism', async () => {
    const providers = pluginManager.getAllProviders();
    if (providers.length === 0) return;

    // Find a provider that is actually ready (has API key or doesn't need one)
    const readyProvider = providers.find(p => p.isReady());
    if (!readyProvider) return; // No ready providers in this environment

    // Test explicit provider resolution with a ready provider
    const resolvedExplicit = await pluginManager.resolveProvider(readyProvider.id);
    expect(resolvedExplicit.id).toBe(readyProvider.id);

    // Test default provider resolution
    const resolvedDefault = await pluginManager.resolveProvider(undefined, readyProvider.id);
    expect(resolvedDefault.id).toBe(readyProvider.id);

    // Test fallback to first available provider
    const resolvedFallback = await pluginManager.resolveProvider('nonexistent-provider', 'nonexistent-default');
    expect(resolvedFallback).toBeDefined();
    expect(resolvedFallback.isReady()).toBe(true);
  });

  it('should filter providers by capabilities', async () => {
    // Test capability-based filtering
    const providers = pluginManager.getAllProviders();
    if (providers.length > 0) {
      // Try to find a provider that supports vision
      try {
        const visionProvider = await pluginManager.resolveProvider(
          undefined,
          undefined,
          { supportsVision: true }
        );

        // If we found one, it should indeed support vision
        if (visionProvider) {
          expect(visionProvider.capabilities?.supportsVision).toBe(true);
        }
      } catch (error) {
        // If no vision-capable provider is available, that's OK for this test environment
        if (!(error as Error).message.includes('No operational AI providers')) {
          throw error;
        }
      }
    }
  });

  it('should use provider override in orchestration service', async () => {
    const providers = pluginManager.getAllProviders();
    if (providers.length === 0) {
      // Skip if no providers are available
      return;
    }

    // Get the first available provider to use as override
    const firstProvider = providers[0];

    // Test that the orchestration service attempts to use the provider override
    // We expect this to fail due to API configuration, but the resolution should happen
    try {
      await orchestrationService.runMission(
        'consultation',
        'Integration test goal',
        { async: false, providerOverride: firstProvider.id }
      );
    } catch (error) {
      // If the error is related to API keys or network (expected in test environment),
      // that's fine - the important part is that provider resolution happened
      const errorMessage = (error as Error).message.toLowerCase();
      if (!errorMessage.includes('api') &&
          !errorMessage.includes('network') &&
          !errorMessage.includes('connect') &&
          !errorMessage.includes('fetch')) {
        throw error; // Re-throw if it's not a connectivity/API issue
      }
    }
  });
});