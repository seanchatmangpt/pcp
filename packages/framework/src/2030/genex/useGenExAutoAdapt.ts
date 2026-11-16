import { useEffect, useRef } from 'react';
import { useGenEx } from './GenExProvider';
import { useBehavioralAuth } from '../../auth/behavioral/useBehavioralAuth';

interface AutoAdaptOptions {
  /** Paths to ignore for navigation history */
  ignorePaths?: string[];
  /** Minimum trust score change to trigger adaptation */
  trustThreshold?: number;
}

/**
 * Automatically triggers GenEx regeneration based on behavioral trust score
 * and simulated navigation events.
 */
export function useGenExAutoAdapt(currentPath: string, options: AutoAdaptOptions = {}) {
  const { regenerate, lastTrustScore } = useGenEx();
  const { trustScore } = useBehavioralAuth();
  const navHistory = useRef<string[]>([]);

  const { trustThreshold = 0.1 } = options;

  // Track navigation history
  useEffect(() => {
    if (currentPath && navHistory.current[navHistory.current.length - 1] !== currentPath) {
      navHistory.current.push(currentPath);
      if (navHistory.current.length > 5) {
        navHistory.current.shift();
      }

      // Regenerate on navigation
      regenerate(trustScore, navHistory.current);
    }
  }, [currentPath, regenerate, trustScore]);

  // Track significant trust score changes
  useEffect(() => {
    const diff = Math.abs(trustScore - lastTrustScore);
    if (diff >= trustThreshold) {
      regenerate(trustScore, navHistory.current);
    }
  }, [trustScore, lastTrustScore, trustThreshold, regenerate]);

  return {
    trustScore,
    navHistory: navHistory.current,
  };
}
