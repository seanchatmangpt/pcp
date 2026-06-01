import React, { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface PinchToZoomProps {
  /**
   * The child component to be zoomed.
   */
  children: ReactNode;
  /**
   * Maximum zoom scale.
   * @default 5
   */
  maxScale?: number;
  /**
   * Minimum zoom scale.
   * @default 1
   */
  minScale?: number;
  /**
   * Whether to enable double-tap to reset zoom.
   * @default true
   */
  enableDoubleTap?: boolean;
}

/**
 * A fluid Pinch-to-Zoom wrapper component.
 * Allows users to pinch to zoom and pan any UI element with native performance.
 *
 * @example
 * ```tsx
 * <PinchToZoom maxScale={3}>
 *   <Image source={{ uri: '...' }} style={{ width: 300, height: 300 }} />
 * </PinchToZoom>
 * ```
 */
export const PinchToZoom: React.FC<PinchToZoomProps> = ({
  children,
  maxScale = 5,
  minScale = 1,
  enableDoubleTap = true,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event: any) => {
      scale.value = Math.min(Math.max(event.scale, minScale), maxScale);
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event: any) => {
      if (scale.value > 1) {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(enableDoubleTap)
    .onStart(() => {
      if (scale.value > 1.1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else {
        scale.value = withSpring(2);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: focalX.value },
      { translateY: focalY.value },
      { translateX: -screenWidth / 2 },
      { translateY: -screenHeight / 2 },
      { scale: scale.value },
      { translateX: -focalX.value },
      { translateY: -focalY.value },
      { translateX: screenWidth / 2 },
      { translateY: screenHeight / 2 },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const gesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
