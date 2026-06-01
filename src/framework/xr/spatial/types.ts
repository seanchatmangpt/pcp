/**
 * Represents a point in 3D space.
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Represents rotation in 3D space using Euler angles (in radians).
 */
export interface Euler {
  x: number;
  y: number;
  z: number;
  order?: 'XYZ' | 'YZX' | 'ZXY' | 'XZY' | 'YXZ' | 'ZYX';
}

/**
 * Represents a 3D transformation (position, rotation, scale).
 */
export interface SpatialTransform {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
}

/**
 * Configuration for spatial tracking.
 */
export interface SpatialTrackingConfig {
  enableHaptics?: boolean;
  smoothingFactor?: number; // 0 to 1
  coordinateSpace?: 'world' | 'local' | 'camera';
}
