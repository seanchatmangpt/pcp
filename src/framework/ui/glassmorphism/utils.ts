import { StyleSheet } from 'react-native';
import { GlassIntensity, GlassTint } from './types';
import { ThemeSettings } from '../theme/types';

/**
 * Converts a hex color to RGBA with the specified alpha.
 */
export const getRGBA = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Gets the background and border colors for a glass effect based on the theme and props.
 */
export const getGlassStyles = (
  theme: ThemeSettings,
  intensity: GlassIntensity = 'medium',
  tint: GlassTint = 'default'
) => {
  const isDark = tint === 'dark' || (tint === 'default' && theme.colors.background === '#09090b'); // Heuristic for dark theme

  const intensityMap: Record<GlassIntensity, number> = {
    low: 0.1,
    medium: 0.2,
    high: 0.4,
  };

  const alpha = intensityMap[intensity];
  const backgroundColor = getRGBA(isDark ? '#000000' : '#ffffff', alpha);
  const borderColor = getRGBA(isDark ? '#ffffff' : '#000000', 0.1);

  return {
    backgroundColor,
    borderColor,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  };
};
