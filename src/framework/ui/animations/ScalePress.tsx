import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ScalePressProps extends PressableProps {
  /**
   * The scale value when the component is pressed.
   * @default 0.95
   */
  activeScale?: number;
  /**
   * Spring configuration for the scale animation.
   */
  springConfig?: Parameters<typeof withSpring>[1];
  /**
   * Optional style for the container.
   */
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * A highly-polished scale-on-press animation wrapper.
 * Provides 120fps micro-interaction for any UI component.
 *
 * @example
 * <ScalePress onPress={() => console.log('Pressed!')}>
 *   <View style={styles.button}>
 *     <Text>Click Me</Text>
 *   </View>
 * </ScalePress>
 */
export const ScalePress: React.FC<ScalePressProps> = ({
  children,
  activeScale = 0.95,
  springConfig = {
    damping: 10,
    stiffness: 100,
    mass: 0.5,
  },
  containerStyle,
  ...pressableProps
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    scale.value = withSpring(activeScale, springConfig);
    pressableProps.onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, springConfig);
    pressableProps.onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...pressableProps}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[containerStyle, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
};
