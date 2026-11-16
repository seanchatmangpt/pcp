import React, { useMemo } from 'react';
import { useAdaptiveInteraction } from './AdaptiveInteractionWrapper';
import { withSpring, withTiming } from 'react-native-reanimated';

/**
 * AdaptiveAnimation Utility
 *
 * Provides adaptive versions of common Reanimated functions that
 * automatically scale based on the AdaptiveInteractionWrapper context.
 */
export const useAdaptiveAnimation = () => {
  const { animationSpeedScale } = useAdaptiveInteraction();

  const adaptiveSpring = useMemo(() => {
    return (value: number, config?: any) => {
      'worklet';
      const adaptiveConfig = config ? { ...config } : {};

      // If we have duration, scale it
      if (adaptiveConfig.duration) {
        adaptiveConfig.duration *= animationSpeedScale;
      }

      // For spring, we might want to adjust damping/stiffness to slow it down
      // but duration is easier to reason about for general scaling.
      // Reanimated springs don't always have a 'duration' unless using specific configs.

      return withSpring(value, adaptiveConfig);
    };
  }, [animationSpeedScale]);

  const adaptiveTiming = useMemo(() => {
    return (value: number, config?: any) => {
      'worklet';
      const adaptiveConfig = config ? { ...config } : { duration: 300 };
      adaptiveConfig.duration = (adaptiveConfig.duration || 300) * animationSpeedScale;

      return withTiming(value, adaptiveConfig);
    };
  }, [animationSpeedScale]);

  return {
    adaptiveSpring,
    adaptiveTiming,
    animationSpeedScale,
  };
};

/**
 * AdaptiveAnimationWrapper
 *
 * A component that provides animation scaling context to its children.
 * (Currently redundant as AdaptiveInteractionWrapper already provides it,
 * but good for explicit animation-only adaptation).
 */
export const AdaptiveAnimation: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
