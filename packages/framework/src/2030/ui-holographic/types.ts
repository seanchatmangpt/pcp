import { ViewProps } from 'react-native';
import { GlassCardProps } from '../../ui/glassmorphism/types';

export interface HolographicSensorData {
  roll: number; // Rotation around X axis
  pitch: number; // Rotation around Y axis
  yaw: number; // Rotation around Z axis
}

export interface HolographicEffectProps {
  /**
   * Magnitude of the parallax effect. Higher values mean more movement.
   * @default 10
   */
  parallaxIntensity?: number;
  /**
   * Magnitude of the holographic sheen/glare effect.
   * @default 0.5
   */
  glareIntensity?: number;
  /**
   * If true, the effect will be inverted.
   * @default false
   */
  inverted?: boolean;
}

export interface HolographicContainerProps extends ViewProps {
  /**
   * Enable/disable the holographic effects for all children.
   * @default true
   */
  isEnabled?: boolean;
}

export interface HolographicGlassCardProps extends GlassCardProps, HolographicEffectProps {}
