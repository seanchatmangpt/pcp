import { ColorValue } from 'react-native';

/**
 * Represents a single particle's initial state and behavior.
 */
export interface Particle {
  /** Unique identifier for the particle. */
  id: string;
  /** Current X position. */
  x: number;
  /** Current Y position. */
  y: number;
  /** Horizontal velocity. */
  vx: number;
  /** Vertical velocity. */
  vy: number;
  /** Size of the particle in pixels. */
  size: number;
  /** Color of the particle. */
  color: ColorValue;
  /** Current rotation in degrees. */
  rotation: number;
  /** Speed of rotation. */
  rotationSpeed: number;
  /** Opacity of the particle (0 to 1). */
  opacity: number;
  /** Remaining life of the particle. */
  life: number;
}

/**
 * Configuration for the ParticleEmitter component.
 */
export interface ParticleEmitterProps {
  /**
   * Number of particles to emit in a single burst.
   * @default 50
   */
  count?: number;
  /**
   * Array of colors to randomly assign to particles.
   * @default ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']
   */
  colors?: ColorValue[];
  /**
   * Gravity constant affecting the vertical trajectory.
   * Higher values make particles fall faster.
   * @default 0.5
   */
  gravity?: number;
  /**
   * Range for the initial horizontal and vertical velocity.
   * vx and vy will be randomized within this range.
   */
  velocityRange?: { min: number; max: number };
  /**
   * Range for the particle size in pixels.
   */
  sizeRange?: { min: number; max: number };
  /**
   * Total duration of the animation in milliseconds.
   * @default 2000
   */
  duration?: number;
  /**
   * If true, the emission starts as soon as the component mounts.
   * @default true
   */
  autoStart?: boolean;
  /**
   * Callback function invoked when the animation completes.
   */
  onComplete?: () => void;
}

/**
 * Configuration for the ConfettiCannon component.
 */
export interface ConfettiCannonProps extends ParticleEmitterProps {
  /**
   * The point from which the confetti will explode.
   * Coordinates are relative to the component's parent.
   * If omitted, the confetti will explode from the center of the viewport.
   */
  origin?: { x: number; y: number };
  /**
   * The shape of the confetti particles.
   * @default 'mixed'
   */
  shape?: 'square' | 'circle' | 'mixed';
}
