export type PerformanceTier = 'full' | 'lite';
export type PerformanceMode = 'auto' | 'full' | 'lite';

export interface DeviceCapability {
  ramGB: number;
  cpuCores: number;
  hasDiscreteGPU: boolean;
}

/**
 * Classify device as lite only if ALL three constraints are met:
 * - Under 8GB RAM
 * - 4 or fewer CPU cores
 * - Integrated GPU only
 */
export function detectTier(cap: DeviceCapability): PerformanceTier {
  const isLite = cap.ramGB < 8 && cap.cpuCores <= 4 && !cap.hasDiscreteGPU;
  return isLite ? 'lite' : 'full';
}

export function resolveTier(mode: PerformanceMode, detected: PerformanceTier): PerformanceTier {
  if (mode === 'auto') return detected;
  return mode;
}

/** Tier-aware constants */
export const TIER_CONFIG = {
  full: {
    telemetryIntervalMs: 10_000,
    socketBatchMs: 100,
    messageBufferSize: 20,
    knowledgeMapMaxNodes: Infinity,
    forceSimIterations: 300,
    monacoMinimap: true,
    monacoBracketColors: true,
  },
  lite: {
    telemetryIntervalMs: 30_000,
    socketBatchMs: 250,
    messageBufferSize: 10,
    knowledgeMapMaxNodes: 100,
    forceSimIterations: 100,
    monacoMinimap: false,
    monacoBracketColors: false,
  },
} as const;
