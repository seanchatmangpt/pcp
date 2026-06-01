import React, { forwardRef, useCallback } from 'react';
import { Pressable, Text, View, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '../../utils/cn';

/**
 * Variants available for the Button component.
 */
export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link';

/**
 * Sizes available for the Button component.
 */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Props for the highly customizable Button primitive.
 */
export interface ButtonProps extends React.ComponentPropsWithoutRef<typeof Pressable> {
  /**
   * The visual variant of the button.
   * @default 'default'
   */
  variant?: ButtonVariant;
  /**
   * The size of the button.
   * @default 'md'
   */
  size?: ButtonSize;
  /**
   * If true, shows a loading state and disables the button.
   * @default false
   */
  isLoading?: boolean;
  /**
   * Optional custom class name for the button container.
   */
  className?: string;
  /**
   * Optional custom class name for the button text.
   */
  textClassName?: string;
  /**
   * Children to render inside the button. Can be a string or React nodes.
   */
  children?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const variantStyles: Record<ButtonVariant, string> = {
  default: 'bg-neutral-900 dark:bg-neutral-100',
  primary: 'bg-blue-600 dark:bg-blue-500',
  secondary: 'bg-neutral-200 dark:bg-neutral-800',
  destructive: 'bg-red-500 dark:bg-red-600',
  outline: 'border border-neutral-300 dark:border-neutral-700 bg-transparent',
  ghost: 'bg-transparent',
  link: 'bg-transparent',
};

const textVariantStyles: Record<ButtonVariant, string> = {
  default: 'text-white dark:text-black font-semibold',
  primary: 'text-white font-semibold',
  secondary: 'text-neutral-900 dark:text-neutral-100 font-medium',
  destructive: 'text-white font-semibold',
  outline: 'text-neutral-900 dark:text-neutral-100 font-medium',
  ghost: 'text-neutral-900 dark:text-neutral-100 font-medium',
  link: 'text-blue-600 dark:text-blue-400 underline font-medium',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 rounded-md',
  md: 'px-4 py-2 rounded-md',
  lg: 'px-6 py-3 rounded-lg',
  icon: 'p-2 rounded-full',
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  icon: 'text-base',
};

/**
 * A highly customizable Button primitive with advanced NativeWind variants and polished animations.
 * Features a scaling effect on press and rich TypeScript interfaces.
 */
export const Button = forwardRef<View, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      isLoading = false,
      className,
      textClassName,
      children,
      disabled,
      onPressIn,
      onPressOut,
      ...props
    },
    ref
  ) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
      };
    });

    const handlePressIn = useCallback(
      (e: any) => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(0.8, { duration: 100 });
        onPressIn?.(e);
      },
      [scale, opacity, onPressIn]
    );

    const handlePressOut = useCallback(
      (e: any) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(1, { duration: 100 });
        onPressOut?.(e);
      },
      [scale, opacity, onPressOut]
    );

    const containerClasses = cn(
      'flex-row items-center justify-center',
      variantStyles[variant],
      sizeStyles[size],
      (disabled || isLoading) && 'opacity-50',
      className
    );

    const textClasses = cn(textVariantStyles[variant], textSizeStyles[size], textClassName);

    return (
      <AnimatedPressable
        ref={ref}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        className={containerClasses}
        style={animatedStyle}
        {...props}>
        {isLoading ? (
          <Text className={cn(textClasses, 'mr-2')}>Loading...</Text> // Simplified loading state
        ) : null}
        {typeof children === 'string' ? <Text className={textClasses}>{children}</Text> : children}
      </AnimatedPressable>
    );
  }
);

Button.displayName = 'Button';
