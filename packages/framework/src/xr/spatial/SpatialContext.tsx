import React, { createContext, useContext, useMemo } from 'react';
import { SpatialTransform } from './types';

export interface SpatialContextValue {
  /**
   * The current world-space transform of the container.
   */
  worldTransform: SpatialTransform;
  /**
   * The unit scale factor (e.g., 1 unit = 1 meter).
   */
  unitScale: number;
}

const DefaultSpatialTransform: SpatialTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

const SpatialContext = createContext<SpatialContextValue>({
  worldTransform: DefaultSpatialTransform,
  unitScale: 1,
});

/**
 * Provider for spatial context, allowing nested components to be aware of their 3D environment.
 */
export const SpatialProvider: React.FC<{
  value?: Partial<SpatialContextValue>;
  children: React.ReactNode;
}> = ({ value, children }) => {
  const contextValue = useMemo(
    () => ({
      worldTransform: value?.worldTransform ?? DefaultSpatialTransform,
      unitScale: value?.unitScale ?? 1,
    }),
    [value]
  );

  return <SpatialContext.Provider value={contextValue}>{children}</SpatialContext.Provider>;
};

/**
 * Hook to access the current spatial context.
 */
export const useSpatialContext = () => useContext(SpatialContext);
