import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { Membrane } from '../../membrane/membrane';
import { SelfHealingManager } from '../../membrane/self-healing/manager';
import { AutoFixErrorBoundary } from '../../ui/auto-fix/AutoFixErrorBoundary';
import { MembraneConfig } from '../../membrane/types';
import { SelfHealingConfig } from '../../membrane/self-healing/types';

interface ResilientContextValue {
  membrane: Membrane;
  selfHealing: SelfHealingManager;
}

const ResilientContext = createContext<ResilientContextValue | null>(null);

/**
 * ResilientBoundary establishes a high-integrity execution context for sensitive application logic.
 * It combines the Operational Membrane, Autonomous Self-Healing, and Intelligent Auto-Fixing.
 */
export const ResilientBoundary: React.FC<{
  children: React.ReactNode;
  config: MembraneConfig;
  healingConfig?: SelfHealingConfig;
}> = ({ children, config, healingConfig }) => {
  const membrane = useMemo(() => new Membrane(config), [config]);
  // Default target to an empty object for general monitoring
  const selfHealing = useMemo(
    () => new SelfHealingManager(membrane, {}, healingConfig),
    [membrane, healingConfig]
  );

  useEffect(() => {
    return () => selfHealing.dispose();
  }, [selfHealing]);

  return (
    <ResilientContext.Provider value={{ membrane, selfHealing }}>
      <AutoFixErrorBoundary enableAutoFix={true}>{children}</AutoFixErrorBoundary>
    </ResilientContext.Provider>
  );
};

/**
 * Hook to access the resilient context.
 */
export const useResilientContext = () => {
  const ctx = useContext(ResilientContext);
  if (!ctx) throw new Error('useResilientContext must be used within ResilientBoundary');
  return ctx;
};
