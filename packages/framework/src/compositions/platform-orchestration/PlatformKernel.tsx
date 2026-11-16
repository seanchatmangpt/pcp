import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useModuleFederation } from '../../core/micro-frontend/useModuleFederation';
import { FederatedModuleConfig } from '../../core/micro-frontend/types';

/**
 * Internal component to trigger pre-loading of a single federated module.
 */
const PreloadModule: React.FC<{ config: FederatedModuleConfig }> = ({ config }) => {
  useModuleFederation(config);
  return null;
};

export interface PlatformKernelProps {
  /**
   * List of federated modules to pre-load.
   */
  modules?: FederatedModuleConfig[];
  /**
   * Optional callback triggered when AppState changes.
   */
  onAppStateChange?: (status: AppStateStatus) => void;
}

/**
 * PlatformKernel manages the lifecycle and orchestration of the micro-frontend platform.
 * It monitors application state and triggers pre-loading of federated components.
 */
export const PlatformKernel: React.FC<PlatformKernelProps> = ({
  modules = [],
  onAppStateChange,
}) => {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
      if (onAppStateChange) {
        onAppStateChange(nextAppState);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [onAppStateChange]);

  return (
    <>
      {modules.map((config) => (
        <PreloadModule key={`${config.scope}:${config.name}:${config.module}`} config={config} />
      ))}
    </>
  );
};
