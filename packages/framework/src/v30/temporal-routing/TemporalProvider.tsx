import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { TemporalNavigator } from './TemporalNavigator';
import { MembraneChain } from './MembraneChain';
import { TemporalRoute } from './types';

interface TemporalContextValue {
  navigator: TemporalNavigator;
  currentRoute: TemporalRoute | null;
  navigate: (path: string, state?: Record<string, any>) => void;
  travelTo: (timestamp: number) => void;
}

const TemporalContext = createContext<TemporalContextValue | null>(null);

export const TemporalProvider: React.FC<{ children: React.ReactNode; chain?: MembraneChain }> = ({
  children,
  chain,
}) => {
  const [navigator] = useState(() => new TemporalNavigator(chain || new MembraneChain()));
  const [currentRoute, setCurrentRoute] = useState<TemporalRoute | null>(
    navigator.getCurrentRoute()
  );

  useEffect(() => {
    const unsubscribe = navigator.subscribe(setCurrentRoute);
    return () => {
      unsubscribe();
    };
  }, [navigator]);

  const value = useMemo(
    () => ({
      navigator,
      currentRoute,
      navigate: (path: string, state: Record<string, any> = {}) => navigator.navigate(path, state),
      travelTo: (timestamp: number) => navigator.travelTo(timestamp),
    }),
    [navigator, currentRoute]
  );

  return <TemporalContext.Provider value={value}>{children}</TemporalContext.Provider>;
};

export const useTimeTravel = () => {
  const context = useContext(TemporalContext);
  if (!context) {
    throw new Error('useTimeTravel must be used within a TemporalProvider');
  }
  return context;
};
