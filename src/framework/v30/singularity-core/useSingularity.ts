 
import { useState, useEffect, useMemo } from 'react';
import { SingularityKernel, SingularityConfig } from './SingularityKernel';

let globalKernel: SingularityKernel | null = null;

export const resetGlobalKernel = () => {
  globalKernel = null;
};

export const useSingularity = (config?: Partial<SingularityConfig>) => {
  const kernel = useMemo(() => {
    if (!globalKernel) {
      globalKernel = new SingularityKernel(config);
    }
    return globalKernel;
  }, [config]);

  const [state, setState] = useState(() => kernel.getSnapshot());

  useEffect(() => {
    const unsubscribe = kernel.subscribe(() => {
      setState(kernel.getSnapshot());
    });
    return unsubscribe;
  }, [kernel]);

  return {
    state,
    kernel,
  };
};
