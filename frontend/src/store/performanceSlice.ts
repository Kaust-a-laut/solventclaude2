import { StateCreator } from 'zustand';
import { AppState } from './types';
import {
  PerformanceTier,
  PerformanceMode,
  resolveTier,
} from '../lib/performanceTier';

export interface PerformanceSlice {
  performanceMode: PerformanceMode;
  detectedTier: PerformanceTier;
  activeTier: PerformanceTier;
  setPerformanceMode: (mode: PerformanceMode) => void;
  setDetectedTier: (tier: PerformanceTier) => void;
}

export const createPerformanceSlice: StateCreator<AppState, [], [], PerformanceSlice> = (set) => ({
  performanceMode: 'auto',
  detectedTier: 'full',
  activeTier: 'full',
  setPerformanceMode: (mode) =>
    set((state) => ({
      performanceMode: mode,
      activeTier: resolveTier(mode, state.detectedTier),
    })),
  setDetectedTier: (tier) =>
    set((state) => ({
      detectedTier: tier,
      activeTier: resolveTier(state.performanceMode, tier),
    })),
});
