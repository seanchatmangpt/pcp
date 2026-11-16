import React, { useMemo } from 'react';
import { semanticComponentRegistry } from './registry';
import { AutoFixer } from './AutoFixer';

/**
 * Hook to automatically resolve a React component for a given RDF type.
 * If the component is missing, it provides an Auto-Fixer UI.
 */
export function useAutoScaffold(rdfType: string) {
  const component = useMemo(() => {
    return semanticComponentRegistry.resolve(rdfType);
  }, [rdfType]);

  const isMissing = !component;

  // We return a "Guarded" component that automatically shows the fixer if missing
  const GuardedComponent = useMemo(() => {
    if (component) return component;

    // Fallback component that renders the AutoFixer
    const Fallback = (props: any) => <AutoFixer type={rdfType} {...props} />;
    return Fallback;
  }, [component, rdfType]);

  return {
    component: GuardedComponent,
    isMissing,
    type: rdfType,
  };
}
