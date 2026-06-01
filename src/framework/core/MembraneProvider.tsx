import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { MembraneContext as CoreMembraneContext } from '@/src/lib/membrane/context';
import { MembraneConfig } from '@/src/lib/membrane/types';

interface MembraneProviderProps {
  children: ReactNode;
  config?: Partial<MembraneConfig>;
}

const defaultMembraneConfig: MembraneConfig = {
  mode: 'strict',
  tenantId: 'default-tenant',
  authorityRole: 'anonymous',
};

const ReactMembraneContext = createContext<CoreMembraneContext | null>(null);

export function MembraneProvider({ children, config }: MembraneProviderProps) {
  const membrane = useMemo(() => {
    return new CoreMembraneContext({ ...defaultMembraneConfig, ...config });
  }, [config]);

  return <ReactMembraneContext.Provider value={membrane}>{children}</ReactMembraneContext.Provider>;
}

export function useMembrane() {
  const context = useContext(ReactMembraneContext);
  if (!context) {
    throw new Error('useMembrane must be used within a MembraneProvider');
  }
  return context;
}
