import { pluginManager } from './pluginManager';
import { circuitBreaker } from './circuitBreaker';
import { IProviderPlugin, ProviderCapabilities } from '../types/plugins';

export interface SelectionCriteria {
  priority: 'cost' | 'performance' | 'reliability';
  requirements: {
    minContext?: number;
    supportsVision?: boolean;
    inputTokens: number;
    outputTokens: number;
  };
}

export class ProviderSelector {
  async select(criteria: SelectionCriteria): Promise<IProviderPlugin> {
    const allProviders = pluginManager.getAllProviders();
    
    // 1. Filter by Health & Circuit Breaker
    const available = [];
    for (const p of allProviders) {
      if (!p.isReady()) continue;
      if (await circuitBreaker.isOpen(p.id)) continue;
      if (!this.meetsRequirements(p, criteria.requirements)) continue;
      available.push(p);
    }

    if (available.length === 0) throw new Error("No healthy providers match requirements");

    // 2. Sort by Criteria
    return available.sort((a, b) => {
      if (criteria.priority === 'cost') {
        return this.calculateCost(a, criteria) - this.calculateCost(b, criteria);
      }
      // Implement 'performance' or 'reliability' sorting here later
      return 0;
    })[0]!;
  }

  private meetsRequirements(p: IProviderPlugin, reqs: any): boolean {
    if (!p.capabilities) return false;
    if (reqs.supportsVision && !p.capabilities.supportsVision) return false;
    if (reqs.minContext && p.capabilities.contextWindow < reqs.minContext) return false;
    return true;
  }

  private calculateCost(p: IProviderPlugin, criteria: SelectionCriteria): number {
    if (!p.capabilities) return Infinity;
    const { input, output } = p.capabilities.costPer1k;
    return (
      (criteria.requirements.inputTokens / 1000) * input +
      (criteria.requirements.outputTokens / 1000) * output
    );
  }
}

export const providerSelector = new ProviderSelector();