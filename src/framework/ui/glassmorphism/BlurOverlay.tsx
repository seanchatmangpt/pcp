import React from 'react';
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { cn } from '../../../utils/cn';
import { GlassBaseProps } from './types';
import { getGlassStyles } from './utils';

export interface BlurOverlayProps extends GlassBaseProps {
  /**
   * Optional callback when the overlay is pressed.
   */
  onPress?: () => void;
  /**
   * Children to render on top of the blur.
   */
  children?: React.ReactNode;
  /**
   * Optional custom class name.
   */
  className?: string;
  /**
   * If true, the overlay is visible.
   * @default true
   */
  visible?: boolean;
}

/**
 * A full-screen or container-filling blur overlay.
 * Ideal for modals, drawers, or temporary UI states.
 */
export const BlurOverlay: React.FC<BlurOverlayProps> = ({
  intensity = 'high',
  tint = 'default',
  onPress,
  children,
  className,
  visible = true,
}) => {
  const theme = useTheme();
  const glassStyles = getGlassStyles(theme, intensity, tint);

  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: glassStyles.backgroundColor,
          },
        ]}
        className={cn('backdrop-blur-xl items-center justify-center', className)}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
};

BlurOverlay.displayName = 'BlurOverlay';
