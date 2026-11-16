import React, { useEffect } from 'react';
import { StyleProp, ViewStyle, ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface FadeInProps extends ViewProps {
  /**
   * Duration of the animation in milliseconds.
   * @default 500
   */
  duration?: number;
  /**
   * Delay before the animation starts in milliseconds.
   * @default 0
   */
  delay?: number;
  /**
   * Optional style for the container.
   */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * A smooth fade-in animation wrapper.
 * Plug-and-play for any framework UI component to add entry polish.
 *
 * @example
 * <FadeIn delay={200}>
 *   <Text>Fading in...</Text>
 * </FadeIn>
 */
export const FadeIn: React.FC<FadeInProps> = ({
  children,
  duration = 500,
  delay = 0,
  style,
  ...viewProps
}) => {
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.exp),
      })
    );
  }, [delay, duration, opacity]);

  return (
    <Animated.View {...viewProps} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};
