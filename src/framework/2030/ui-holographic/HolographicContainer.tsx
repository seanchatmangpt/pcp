import React, { createContext, useContext, ReactNode } from 'react';
import { View } from 'react-native';
import { useHolographicSensors } from './useHolographicSensors';
import { HolographicContainerProps } from './types';

const HolographicContext = createContext<ReturnType<typeof useHolographicSensors> | null>(null);

/**
 * A root container that provides sensor data to all descendant holographic components.
 * This ensures only one sensor subscription is active per view hierarchy.
 */
export const HolographicContainer: React.FC<
  HolographicContainerProps & { children: ReactNode }
> = ({ children, isEnabled = true, style, ...props }) => {
  const sensor = useHolographicSensors();

  return (
    <HolographicContext.Provider value={isEnabled ? sensor : null}>
      <View style={[{ flex: 1 }, style]} {...props}>
        {children}
      </View>
    </HolographicContext.Provider>
  );
};

export const useHolographicContext = () => {
  const context = useContext(HolographicContext);
  return context;
};

HolographicContainer.displayName = 'HolographicContainer';
