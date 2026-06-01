/**
 * @fileoverview Continuous Behavioral Biometrics Hook.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BehavioralAuthState, BehavioralAuthOptions, BehavioralMetrics } from './types';

/**
 * Hook that calculates a "trust score" based on continuous behavioral biometrics.
 *
 * It monitors:
 * - Typing speed (inter-keystroke intervals)
 * - Navigation rhythm (interaction frequency)
 * - Touch pressure (currently stubbed)
 *
 * @param options - Configuration for the behavioral analysis.
 * @returns The current behavioral auth state, including trust score and metrics.
 */
export function useBehavioralAuth(options: BehavioralAuthOptions = {}): BehavioralAuthState {
  const { updateInterval = 5000, sensitivity = 0.5 } = options;

  const [state, setState] = useState<
    Omit<BehavioralAuthState, 'recordKeystroke' | 'recordInteraction'>
  >({
    trustScore: 1.0,
    metrics: {
      typingSpeed: 0,
      touchPressure: 0.5, // Default stubbed value
      navigationRhythm: 0,
      lastUpdated: Date.now(),
    },
    isActive: true,
  });

  // Refs for tracking raw data without triggering re-renders
  const keystrokeTimestamps = useRef<number[]>([]);
  const interactionTimestamps = useRef<number[]>([]);

  /**
   * Manually record a keystroke event.
   * Useful in React Native where global keydown events are not available.
   */
  const recordKeystroke = useCallback(() => {
    keystrokeTimestamps.current.push(Date.now());
  }, []);

  /**
   * Manually record an interaction event.
   */
  const recordInteraction = useCallback(() => {
    interactionTimestamps.current.push(Date.now());
  }, []);

  const calculateMetrics = useCallback((): BehavioralMetrics => {
    const now = Date.now();

    // Calculate typing speed (average interval between keystrokes in last window)
    let typingSpeed = 0;
    if (keystrokeTimestamps.current.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < keystrokeTimestamps.current.length; i++) {
        intervals.push(keystrokeTimestamps.current[i] - keystrokeTimestamps.current[i - 1]);
      }
      typingSpeed = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    // Calculate navigation/interaction rhythm (interactions per minute)
    const recentInteractions = interactionTimestamps.current.filter((t) => now - t < 60000);
    const navigationRhythm = recentInteractions.length;

    // Cleanup old timestamps (keep last 10 seconds for typing, 1 minute for rhythm)
    keystrokeTimestamps.current = keystrokeTimestamps.current.filter((t) => now - t < 10000);
    interactionTimestamps.current = recentInteractions;

    return {
      typingSpeed,
      touchPressure: 0.7, // Stubbed value reflecting "normal" pressure
      navigationRhythm,
      lastUpdated: now,
    };
  }, []);

  const calculateTrustScore = useCallback(
    (metrics: BehavioralMetrics): number => {
      let score = 1.0;

      // Heuristic 1: Extremely fast typing might indicate a bot/macro (less than 50ms interval)
      if (metrics.typingSpeed > 0 && metrics.typingSpeed < 50) {
        score -= sensitivity * 0.3;
      }

      // Heuristic 2: Extreme navigation bursts (more than 100 interactions per minute)
      if (metrics.navigationRhythm > 100) {
        score -= sensitivity * 0.4;
      }

      return Math.max(0, Math.min(1.0, score));
    },
    [sensitivity]
  );

  useEffect(() => {
    const hasWindow = typeof window !== 'undefined';

    const handleKeyDown = () => recordKeystroke();
    const handleInteraction = () => recordInteraction();

    if (hasWindow && window.addEventListener) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousedown', handleInteraction);
      window.addEventListener('touchstart', handleInteraction);
    }

    const interval = setInterval(() => {
      const newMetrics = calculateMetrics();
      const newScore = calculateTrustScore(newMetrics);

      setState((prev) => ({
        ...prev,
        trustScore: newScore,
        metrics: newMetrics,
      }));
    }, updateInterval);

    return () => {
      if (hasWindow && window.removeEventListener) {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('mousedown', handleInteraction);
        window.removeEventListener('touchstart', handleInteraction);
      }
      clearInterval(interval);
    };
  }, [updateInterval, calculateMetrics, calculateTrustScore, recordKeystroke, recordInteraction]);

  return {
    ...state,
    recordKeystroke,
    recordInteraction,
  };
}
