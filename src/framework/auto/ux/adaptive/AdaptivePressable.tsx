import React, { useCallback, useMemo } from 'react';
import { Pressable, PressableProps, GestureResponderEvent } from 'react-native';
import { useAdaptiveInteraction } from './AdaptiveInteractionWrapper';
import { useHaptics } from '../../../ui/haptics/useHaptics';

export interface AdaptivePressableProps extends PressableProps {
  /** Whether to trigger haptics on press. Defaults to true. */
  enableHaptics?: boolean;
}

/**
 * AdaptivePressable
 *
 * A drop-in replacement for Pressable that automatically applies
 * adaptive hit-slop and haptic feedback based on the surrounding
 * AdaptiveInteractionWrapper context.
 */
export const AdaptivePressable: React.FC<AdaptivePressableProps> = ({
  children,
  onPress,
  onPressIn,
  hitSlop: manualHitSlop,
  enableHaptics = true,
  ...props
}) => {
  const { hitSlop, hapticProfile } = useAdaptiveInteraction();
  const { trigger } = useHaptics();

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (enableHaptics) {
        trigger(hapticProfile);
      }
      onPressIn?.(event);
    },
    [enableHaptics, hapticProfile, trigger, onPressIn]
  );

  const adaptiveHitSlop = useMemo(() => {
    if (manualHitSlop) return manualHitSlop;
    return {
      top: hitSlop,
      bottom: hitSlop,
      left: hitSlop,
      right: hitSlop,
    };
  }, [hitSlop, manualHitSlop]);

  return (
    <Pressable {...props} hitSlop={adaptiveHitSlop} onPress={onPress} onPressIn={handlePressIn}>
      {children}
    </Pressable>
  );
};
