import { OptimizationProfile, OptimizationLevel } from './types';

export const OPTIMIZATION_PROFILES: Record<OptimizationLevel, OptimizationProfile> = {
  peak: {
    level: 'peak',
    syncFrequencyMs: 1000,
    animationComplexity: 'full',
    zkpVerificationDepth: 'exhaustive',
    allowBackgroundSync: true,
    enableExpensiveHaptics: true,
  },
  balanced: {
    level: 'balanced',
    syncFrequencyMs: 5000,
    animationComplexity: 'reduced',
    zkpVerificationDepth: 'standard',
    allowBackgroundSync: true,
    enableExpensiveHaptics: true,
  },
  'power-saver': {
    level: 'power-saver',
    syncFrequencyMs: 30000,
    animationComplexity: 'minimal',
    zkpVerificationDepth: 'fast',
    allowBackgroundSync: false,
    enableExpensiveHaptics: false,
  },
  critical: {
    level: 'critical',
    syncFrequencyMs: 60000,
    animationComplexity: 'none',
    zkpVerificationDepth: 'minimal',
    allowBackgroundSync: false,
    enableExpensiveHaptics: false,
  },
};

export const FPS_THRESHOLDS = {
  STABLE: 55,
  POOR: 30,
  CRITICAL: 15,
};

export const BATTERY_THRESHOLDS = {
  LOW: 0.2,
  CRITICAL: 0.1,
};
