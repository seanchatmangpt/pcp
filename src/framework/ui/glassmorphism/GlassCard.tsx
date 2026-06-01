import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { cn } from '../../../utils/cn';
import { GlassCardProps } from './types';
import { getGlassStyles } from './utils';

/**
 * A premium Glassmorphism card component that integrates with the framework's theme.
 * Features a frosted glass effect with subtle borders and deep integration with `useTheme`.
 *
 * @example
 * ```tsx
 * <GlassCard intensity="high" className="p-4">
 *   <Text>Frosted Content</Text>
 * </GlassCard>
 * ```
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 'medium',
  tint = 'default',
  withBorder = true,
  className,
  style,
  ...props
}) => {
  const theme = useTheme();
  const glassStyles = getGlassStyles(theme, intensity, tint);

  return (
    <View
      style={[
        {
          backgroundColor: glassStyles.backgroundColor,
          borderColor: withBorder ? glassStyles.borderColor : 'transparent',
          borderWidth: withBorder ? glassStyles.borderWidth : 0,
        },
        style,
      ]}
      className={cn(
        'rounded-2xl overflow-hidden backdrop-blur-md', // backdrop-blur-md for web
        className
      )}
      {...props}>
      {children}
    </View>
  );
};

GlassCard.displayName = 'GlassCard';
