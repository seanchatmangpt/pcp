import { useState, useCallback, useMemo } from 'react';
import { Vector3, Euler, SpatialTransform, SpatialTrackingConfig } from './types';

/**
 * Hook to manage 3D spatial positioning and transformations.
 *
 * @param initialTransform - The starting transformation.
 * @param config - Optional configuration for tracking behavior.
 * @returns An object containing the current transform and methods to update it.
 *
 * @example
 * ```tsx
 * const { transform, setPosition } = useSpatialPosition({
 *   position: { x: 0, y: 0, z: 0 },
 *   rotation: { x: 0, y: 0, z: 0 },
 *   scale: { x: 1, y: 1, z: 1 }
 * });
 * ```
 */
export function useSpatialPosition(
  initialTransform: Partial<SpatialTransform> = {},
  config: SpatialTrackingConfig = {}
) {
  const [transform, setTransform] = useState<SpatialTransform>({
    position: { x: 0, y: 0, z: 0, ...initialTransform.position },
    rotation: { x: 0, y: 0, z: 0, ...initialTransform.rotation },
    scale: { x: 1, y: 1, z: 1, ...initialTransform.scale },
  });

  const setPosition = useCallback((position: Partial<Vector3>) => {
    setTransform((prev) => ({
      ...prev,
      position: { ...prev.position, ...position },
    }));
  }, []);

  const setRotation = useCallback((rotation: Partial<Euler>) => {
    setTransform((prev) => ({
      ...prev,
      rotation: { ...prev.rotation, ...rotation },
    }));
  }, []);

  const setScale = useCallback((scale: Partial<Vector3>) => {
    setTransform((prev) => ({
      ...prev,
      scale: { ...prev.scale, ...scale },
    }));
  }, []);

  const resetTransform = useCallback(() => {
    setTransform({
      position: { x: 0, y: 0, z: 0, ...initialTransform.position },
      rotation: { x: 0, y: 0, z: 0, ...initialTransform.rotation },
      scale: { x: 1, y: 1, z: 1, ...initialTransform.scale },
    });
  }, [initialTransform]);

  return useMemo(
    () => ({
      transform,
      setPosition,
      setRotation,
      setScale,
      resetTransform,
      config,
    }),
    [transform, setPosition, setRotation, setScale, resetTransform, config]
  );
}
