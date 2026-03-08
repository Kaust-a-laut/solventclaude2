import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestrationService } from './orchestrationService';

// Mock providerSelector so the no-override path doesn't require real providers
vi.mock('./providerSelector', () => ({
  providerSelector: {
    select: vi.fn().mockResolvedValue({
      id: 'mock-provider',
      defaultModel: 'mock-model',
      complete: vi.fn().mockResolvedValue('Mock response'),
      isReady: () => true,
      isHealthy: () => true
    })
  }
}));

// Mock circuitBreaker
vi.mock('./circuitBreaker', () => ({
  circuitBreaker: {
    recordSuccess: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock dependencies
vi.mock('./pluginManager', () => {
  const provider = {
    id: 'mock-provider',
    defaultModel: 'mock-model',
    complete: vi.fn().mockResolvedValue('Mock response'),
    isReady: () => true,
    isHealthy: () => true
  };
  return {
    pluginManager: {
      resolveProvider: vi.fn().mockResolvedValue(provider),
      getAllProviders: vi.fn().mockReturnValue([provider])
    }
  };
});

vi.mock('./vectorService', () => ({
  vectorService: {
    addEntry: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([])
  }
}));

describe('OrchestrationService', () => {
  let service: OrchestrationService;

  beforeEach(() => {
    service = new OrchestrationService();
    vi.clearAllMocks();
  });

  it('should use providerSelector for dynamic provider selection when no override given', async () => {
    const { providerSelector } = await import('./providerSelector');

    await service.runMission('consultation', 'Test goal', { async: false });

    // Without a providerOverride, orchestration routes through providerSelector.select()
    // which dynamically picks the best available provider. This confirms no hardcoded
    // provider string is used.
    expect(providerSelector.select).toHaveBeenCalled();
  });

  it('should pass providerOverride to resolveProvider', async () => {
    const { pluginManager } = await import('./pluginManager');

    await service.runMission('consultation', 'Test goal', {
      async: false,
      providerOverride: 'ollama'
    });

    expect(pluginManager.resolveProvider).toHaveBeenCalledWith(
      'ollama',
      undefined,
      undefined
    );
  });
});