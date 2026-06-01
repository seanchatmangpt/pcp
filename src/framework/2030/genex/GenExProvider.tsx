import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { GenExVariant, GenExState, GenExContextValue, GenExOptions } from './types';
import { GenExEngine } from './GenExEngine';
import { defaultLocalInferenceEngine } from '../../ai/on-device/LocalInferenceEngine';

const GenExContext = createContext<GenExContextValue | undefined>(undefined);

export const useGenEx = () => {
  const context = useContext(GenExContext);
  if (!context) {
    throw new Error('useGenEx must be used within a GenExProvider');
  }
  return context;
};

interface GenExProviderProps {
  children: React.ReactNode;
  options?: GenExOptions;
  initialTrustScore?: number;
}

const DEFAULT_VARIANT: GenExVariant = {
  id: 'default',
  name: 'Standard Experience',
  aesthetic: {
    primaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    spacingScale: 1.0,
    borderRadius: 8,
  },
  layoutType: 'relaxed',
};

export const GenExProvider: React.FC<GenExProviderProps> = ({
  children,
  options,
  initialTrustScore = 1.0,
}) => {
  const [state, setState] = useState<GenExState>({
    currentVariant: DEFAULT_VARIANT,
    lastTrustScore: initialTrustScore,
    history: [DEFAULT_VARIANT],
    isGenerating: false,
  });

  const engine = useMemo(() => new GenExEngine(defaultLocalInferenceEngine), []);

  const setVariant = useCallback((variant: GenExVariant) => {
    setState((prev) => ({
      ...prev,
      currentVariant: variant,
      history: [variant, ...prev.history].slice(0, 10),
    }));
  }, []);

  const regenerate = useCallback(
    async (trustScore: number, navHistory: string[]) => {
      setState((prev) => ({ ...prev, isGenerating: true }));
      try {
        const variant = await engine.generateVariant(trustScore, navHistory);
        setState((prev) => ({
          ...prev,
          currentVariant: variant,
          lastTrustScore: trustScore,
          history: [variant, ...prev.history].slice(0, 10),
          isGenerating: false,
        }));
      } catch (error) {
        console.error('Failed to regenerate GenEx variant:', error);
        setState((prev) => ({ ...prev, isGenerating: false }));
      }
    },
    [engine]
  );

  const value: GenExContextValue = {
    ...state,
    regenerate,
    setVariant,
  };

  return <GenExContext.Provider value={value}>{children}</GenExContext.Provider>;
};
