import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { GenExEngine } from '../genex/GenExEngine';
import { PredictionEngine } from '../predictive/PredictionEngine';
import { PcpFrameworkProvider } from '../../core/PcpFrameworkProvider';
import { ILocalInferenceEngine } from '../../ai/on-device/types';

/**
 * Pcp 2030 Context State
 */
export interface Pcp2030ContextState {
  /** The GenEx engine for autonomous UI generation */
  genEx: GenExEngine;
  /** The Prediction engine for anticipatory UX */
  predictive: PredictionEngine;
  /** Version of the 2030 frontier layer */
  version: string;
}

const Pcp2030Context = createContext<Pcp2030ContextState | undefined>(undefined);

export interface Pcp2030Props {
  children: ReactNode;
  /** On-device inference engine required for GenEx */
  inferenceEngine: ILocalInferenceEngine;
  /** Optional configuration overrides for the framework */
  config?: any;
}

/**
 * Pcp2030 Provider
 *
 * The ultimate supreme entry point for the Pcp Framework 2030 edition.
 * It composes Auto, Fusion, and Frontier (GenEx/Predictive) capabilities
 * into a single unified orchestration layer.
 *
 * Best Practices:
 * 1. Always wrap the root of your application with <Pcp2030 />.
 * 2. Ensure an ILocalInferenceEngine is provided for on-device frontier features.
 * 3. Use usePcp2030() hook to access the unified engine suite.
 */
export const Pcp2030: React.FC<Pcp2030Props> = ({ children, inferenceEngine, config }) => {
  const genEx = useMemo(() => new GenExEngine(inferenceEngine), [inferenceEngine]);
  const predictive = useMemo(() => new PredictionEngine(), []);

  const value = useMemo(
    () => ({
      genEx,
      predictive,
      version: '2030.1.1-ultimate',
    }),
    [genEx, predictive]
  );

  return (
    <Pcp2030Context.Provider value={value}>
      <PcpFrameworkProvider {...config}>{children}</PcpFrameworkProvider>
    </Pcp2030Context.Provider>
  );
};

/**
 * usePcp2030 Hook
 *
 * Access the ultimate Pcp 2030 frontier capabilities.
 *
 * @returns The composed engine suite including GenEx and Predictive layers.
 * @throws Error if used outside of a <Pcp2030 /> provider.
 */
export const usePcp2030 = (): Pcp2030ContextState => {
  const context = useContext(Pcp2030Context);
  if (!context) {
    throw new Error('usePcp2030 must be used within a Pcp2030 provider');
  }
  return context;
};
