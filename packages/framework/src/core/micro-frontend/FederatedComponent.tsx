import React from 'react';
import { FederatedComponentProps } from './types';
import { useModuleFederation } from './useModuleFederation';

/**
 * A component that dynamically loads and renders a federated React Native component.
 *
 * @example
 * ```tsx
 * <FederatedComponent
 *   name="RemoteApp"
 *   url="https://example.com/remoteEntry.js"
 *   scope="remote_app"
 *   module="./Widget"
 *   fallback={<ActivityIndicator />}
 *   errorComponent={(err) => <Text>Failed to load: {err.message}</Text>}
 * />
 * ```
 */
export const FederatedComponent: React.FC<FederatedComponentProps> = ({
  name,
  url,
  scope,
  module: moduleName,
  fallback,
  errorComponent,
  props,
}) => {
  const { status, error, module } = useModuleFederation({
    name,
    url,
    scope,
    module: moduleName,
  });

  if (status === 'loading') {
    return <>{fallback || null}</>;
  }

  if (status === 'error' && error) {
    if (typeof errorComponent === 'function') {
      return <>{errorComponent(error)}</>;
    }
    return <>{errorComponent || null}</>;
  }

  if (status === 'ready' && module) {
    const Component = module.default;
    return <Component {...props} />;
  }

  return null;
};
