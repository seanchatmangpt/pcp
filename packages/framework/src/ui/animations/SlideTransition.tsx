import React, { useEffect } from 'react';
import { StyleProp, ViewStyle, ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

type SlideDirection = 'up' | 'down' | 'left' | 'right';

interface SlideTransitionProps extends ViewProps {
  /**
   * The direction from which the component slides in.
   * @default 'up'
   */
  direction?: SlideDirection;
  /**
   * Distance of the slide in pixels.
   * @default 50
   */
  offset?: number;
  /**
   * Delay before the animation starts in milliseconds.
   * @default 0
   */
  delay?: number;
  /**
   * Spring configuration for the slide animation.
   */
  springConfig?: Parameters<typeof withSpring>[1];
  /**
   * Optional style for the container.
   */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * A polished slide-in transition wrapper.
 * Ideal for list items, cards, and modal-like entries.
 *
 * @example
 * <SlideTransition direction="right" delay={100}>
 *   <View style={styles.card} />
 * </SlideTransition>
 */
export const SlideTransition: React.FC<SlideTransitionProps> = ({
  children,
  direction = 'up',
  offset = 50,
  delay = 0,
  springConfig = {
    damping: 15,
    stiffness: 120,
    mass: 0.8,
  },
  style,
  ...viewProps
}) => {
  const translateX = useSharedValue(
    direction === 'left' ? -offset : direction === 'right' ? offset : 0
  );
  const translateY = useSharedValue(
    direction === 'up' ? offset : direction === 'down' ? -offset : 0
  );
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, springConfig));
    translateX.value = withDelay(delay, withSpring(0, springConfig));
    translateY.value = withDelay(delay, withSpring(0, springConfig));
  }, [delay, opacity, springConfig, translateX, translateY]);

  return (
    <Animated.View {...viewProps} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};
