import React, { createContext, useContext, useMemo } from 'react';
import { useBehavioralAuth } from '../../../auth/behavioral/useBehavioralAuth';
import { useAppVitals } from '../../../admin/metrics/useAppVitals';
import { HapticFeedbackPattern } from '../../../ui/haptics/IntelligentHaptics';

/**
 * Configuration for adaptive interaction.
 */
export interface AdaptiveInteractionConfig {
  /** The calculated hit slop value to apply to components. */
  hitSlop: number;
  /** The recommended haptic feedback pattern. */
  hapticProfile: HapticFeedbackPattern;
  /** Scale factor for animation durations (1.0 is normal, > 1.0 is slower). */
  animationSpeedScale: number;
  /** The current trust score (0-1). */
  trustScore: number;
  /** Current average FPS. */
  fps: number;
}

const AdaptiveContext = createContext<AdaptiveInteractionConfig>({
  hitSlop: 10,
  hapticProfile: HapticFeedbackPattern.SELECTION,
  animationSpeedScale: 1.0,
  trustScore: 1.0,
  fps: 60,
});

/**
 * Hook to consume adaptive interaction configuration.
 */
export const useAdaptiveInteraction = () => useContext(AdaptiveContext);

export interface AdaptiveInteractionWrapperProps {
  children: React.ReactNode;
  /** Base hit slop in pixels. Defaults to 10. */
  baseHitSlop?: number;
}

/**
 * AdaptiveInteractionWrapper
 *
 * The core of AutoUX. It monitors BehavioralAuth trust scores and device performance
 * to dynamically adjust interaction parameters for all nested adaptive components.
 *
 * Integrates:
 * - auth/behavioral (Trust Score)
 * - admin/metrics (FPS)
 * - ui/haptics (Profiles)
 * - ui/animations (Speed Scaling)
 */
export const AdaptiveInteractionWrapper: React.FC<AdaptiveInteractionWrapperProps> = ({
  children,
  baseHitSlop = 10,
}) => {
  const { trustScore } = useBehavioralAuth();
  const { jsFps, uiFps } = useAppVitals();

  const avgFps = useMemo(() => (jsFps + uiFps) / 2, [jsFps, uiFps]);

  const config = useMemo((): AdaptiveInteractionConfig => {
    // 1. Hit Slop Adjustment
    // Lower trust -> require more precision (smaller hitSlop)
    // Lower FPS -> compensate for lag (larger hitSlop)
    const trustModifier = 0.5 + trustScore * 0.5; // 0.5 to 1.0
    const fpsModifier = avgFps < 30 ? 2.5 : avgFps < 45 ? 1.8 : 1.0;
    const hitSlop = Math.round(baseHitSlop * trustModifier * fpsModifier);

    // 2. Haptic Profile Selection
    let hapticProfile = HapticFeedbackPattern.SELECTION;
    if (trustScore < 0.4) {
      hapticProfile = HapticFeedbackPattern.HEAVY; // Emphasize caution
    } else if (avgFps < 30) {
      hapticProfile = HapticFeedbackPattern.MEDIUM; // Clearer feedback for laggy UI
    } else if (trustScore < 0.8) {
      hapticProfile = HapticFeedbackPattern.LIGHT;
    }

    // 3. Animation Speed Scaling
    // Low FPS -> Slower animations for perceived smoothness
    // Low Trust -> Slower animations to prevent accidental triggers
    let animationSpeedScale = 1.0;
    if (avgFps < 30) {
      animationSpeedScale = 1.5;
    } else if (avgFps < 50 || trustScore < 0.6) {
      animationSpeedScale = 1.2;
    }

    return {
      hitSlop,
      hapticProfile,
      animationSpeedScale,
      trustScore,
      fps: avgFps,
    };
  }, [trustScore, avgFps, baseHitSlop]);

  return <AdaptiveContext.Provider value={config}>{children}</AdaptiveContext.Provider>;
};
