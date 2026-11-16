import React, { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeToDismissProps {
  /**
   * The child component to be swiped.
   */
  children: ReactNode;
  /**
   * Directions in which the component can be swiped to dismiss.
   * @default ['right']
   */
  directions?: SwipeDirection[];
  /**
   * Threshold percentage (0 to 1) of the screen/container width or height to trigger dismissal.
   * @default 0.4
   */
  threshold?: number;
  /**
   * Callback triggered when the component is dismissed.
   */
  onDismiss?: () => void;
  /**
   * Callback triggered when the swipe is cancelled (threshold not met).
   */
  onSwipeCancel?: () => void;
  /**
   * Whether the swipe to dismiss is enabled.
   * @default true
   */
  enabled?: boolean;
}

/**
 * A fluid Swipe-to-Dismiss wrapper component.
 * Provides native-feeling swipe gestures to dismiss any UI element.
 *
 * @example
 * ```tsx
 * <SwipeToDismiss onDismiss={() => console.log('Dismissed!')}>
 *   <Card />
 * </SwipeToDismiss>
 * ```
 */
export const SwipeToDismiss: React.FC<SwipeToDismissProps> = ({
  children,
  directions = ['right'],
  threshold = 0.4,
  onDismiss,
  onSwipeCancel,
  enabled = true,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((event: any) => {
      const canSwipeHorizontal = directions.includes('left') || directions.includes('right');
      const canSwipeVertical = directions.includes('up') || directions.includes('down');

      if (canSwipeHorizontal) {
        let x = event.translationX;
        if (!directions.includes('left') && x < 0) x = x * 0.2; // Resistance
        if (!directions.includes('right') && x > 0) x = x * 0.2; // Resistance
        translateX.value = x;
      }

      if (canSwipeVertical) {
        let y = event.translationY;
        if (!directions.includes('up') && y < 0) y = y * 0.2; // Resistance
        if (!directions.includes('down') && y > 0) y = y * 0.2; // Resistance
        translateY.value = y;
      }

      // Calculate opacity based on progress to threshold
      const progressX = Math.abs(translateX.value) / (screenWidth * threshold);
      const progressY = Math.abs(translateY.value) / (screenHeight * threshold);
      opacity.value = 1 - Math.max(progressX, progressY) * 0.5;
    })
    .onEnd((event: any) => {
      const xThreshold = screenWidth * threshold;
      const yThreshold = screenHeight * threshold;

      const shouldDismissRight = directions.includes('right') && event.translationX > xThreshold;
      const shouldDismissLeft = directions.includes('left') && event.translationX < -xThreshold;
      const shouldDismissDown = directions.includes('down') && event.translationY > yThreshold;
      const shouldDismissUp = directions.includes('up') && event.translationY < -yThreshold;

      if (shouldDismissRight || shouldDismissLeft || shouldDismissDown || shouldDismissUp) {
        const destX = shouldDismissRight ? screenWidth : shouldDismissLeft ? -screenWidth : 0;
        const destY = shouldDismissDown ? screenHeight : shouldDismissUp ? -screenHeight : 0;

        translateX.value = withTiming(destX, { duration: 200 });
        translateY.value = withTiming(destY, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          if (onDismiss) {
            runOnJS(onDismiss)();
          }
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        opacity.value = withSpring(1);
        if (onSwipeCancel) {
          runOnJS(onSwipeCancel)();
        }
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
});
