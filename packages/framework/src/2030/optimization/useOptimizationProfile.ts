import { useState, useEffect } from 'react';
import { uxOptimizer } from './SelfOptimizingUXEngine';
import { OptimizationMetrics } from './types';

/**
 * Hook to access real-time device vitals and the current optimization profile.
 * Components can use this to throttle animations, sync frequency, and ZKP depth.
 */
export function useOptimizationProfile(): OptimizationMetrics {
  const [metrics, setMetrics] = useState<OptimizationMetrics>(uxOptimizer.getMetrics());

  useEffect(() => {
    return uxOptimizer.subscribe((newMetrics) => {
      setMetrics(newMetrics);
    });
  }, []);

  return metrics;
}

/**
 * Specialized hook for specific optimization properties to avoid unnecessary re-renders
 * if only one aspect of the profile is needed.
 */
export function useSyncFrequency(): number {
  const { profile } = useOptimizationProfile();
  return profile.syncFrequencyMs;
}

export function useAnimationComplexity() {
  const { profile } = useOptimizationProfile();
  return profile.animationComplexity;
}

export function useZkpDepth() {
  const { profile } = useOptimizationProfile();
  return profile.zkpVerificationDepth;
}
