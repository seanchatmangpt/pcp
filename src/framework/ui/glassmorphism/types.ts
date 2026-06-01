import { ViewProps, ViewStyle, TextStyle } from 'react-native';

/**
 * Common intensity levels for glassmorphism effects.
 */
export type GlassIntensity = 'low' | 'medium' | 'high';

/**
 * Common tint options for glassmorphism.
 */
export type GlassTint = 'light' | 'dark' | 'default';

/**
 * Base props for glassmorphism components.
 */
export interface GlassBaseProps {
  /**
   * The intensity of the blur/frosted effect.
   * @default 'medium'
   */
  intensity?: GlassIntensity;
  /**
   * The color tint applied to the glass.
   * @default 'default'
   */
  tint?: GlassTint;
  /**
   * If true, applies a subtle border that mimics light reflection.
   * @default true
   */
  withBorder?: boolean;
}

/**
 * Props for the GlassCard component.
 */
export interface GlassCardProps extends ViewProps, GlassBaseProps {
  /**
   * Optional custom border opacity.
   */
  borderOpacity?: number;
  /**
   * Tailwind classes to apply to the card.
   */
  className?: string;
}

/**
 * Props for the GlassButton component.
 */
export interface GlassButtonProps extends GlassBaseProps {
  /**
   * Children to render inside the button.
   */
  children?: React.ReactNode;
  /**
   * Function to call when the button is pressed.
   */
  onPress?: () => void;
  /**
   * Optional custom class name for the button.
   */
  className?: string;
  /**
   * Optional custom style for the button.
   */
  style?: ViewStyle;
  /**
   * Optional custom style for the text.
   */
  textStyle?: TextStyle;
  /**
   * If true, the button is disabled.
   */
  disabled?: boolean;
}
