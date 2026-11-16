import React, { ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import { useNeuralIntent, UseNeuralIntentConfig, SensorData } from './useNeuralIntent';

export interface BciBoundaryProps extends UseNeuralIntentConfig {
  children: ReactNode;
  onIntent?: (intent: string) => void;
  // A prop to allow an external source to pump data in
  dataSource?: { subscribe: (cb: (data: SensorData) => void) => () => void };
}

export function BciBoundary({ children, onIntent, dataSource, ...config }: BciBoundaryProps) {
  const { intent, injectData } = useNeuralIntent(config);

  useEffect(() => {
    if (intent !== 'NONE' && onIntent) {
      onIntent(intent);
    }
  }, [intent, onIntent]);

  useEffect(() => {
    if (dataSource) {
      const unsubscribe = dataSource.subscribe(injectData);
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [dataSource, injectData]);

  return (
    <View testID="bci-boundary" className="bci-boundary-container">
      {children}
    </View>
  );
}
