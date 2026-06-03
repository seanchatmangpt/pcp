// @ts-nocheck
import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { cn } from '../../../utils/cn';
import { GlassButtonProps } from './types';
import { getGlassStyles } from './utils';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * An interactive glassmorphism button with polished animations.
 * Provides a high-end feel with tactile scaling feedback and frosted aesthetics.
 */
export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  onPress,
  intensity = 'low',
  tint = 'default',
  withBorder = true,
  className,
  style,
  textStyle,
  disabled = false,
}) => {
  const theme = useTheme();
  const glassStyles = getGlassStyles(theme, intensity, tint);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(0.9, { duration: 100 });
  }, [scale, opacity]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(1, { duration: 100 });
  }, [scale, opacity]);

  return (
    // @ts-ignore
      <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        {
          backgroundColor: glassStyles.backgroundColor,
          borderColor: withBorder ? glassStyles.borderColor : 'transparent',
          borderWidth: withBorder ? glassStyles.borderWidth : 0,
        },
        animatedStyle,
        style,
      ]}
      className={cn(
        'px-6 py-3 rounded-xl items-center justify-center backdrop-blur-sm',
        disabled && 'opacity-50',
        className
      )}>
      {typeof children === 'string' ? (
        <Text
          style={[
            {
              color: theme.colors.text,
              fontSize: 16 * theme.fontScale,
              fontWeight: '600',
            },
            textStyle,
          ]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
};

GlassButton.displayName = 'GlassButton';
