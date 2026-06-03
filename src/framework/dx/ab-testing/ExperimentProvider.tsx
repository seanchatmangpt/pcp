import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { ExperimentConfig, ExperimentContextValue } from './types';
import { createMMKV } from 'react-native-mmkv';

const AB_STORAGE_ID = 'pcp-ab-testing';

interface StorageInterface {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

const storage = createMMKV({ id: AB_STORAGE_ID });

const ExperimentContext = createContext<ExperimentContextValue | undefined>(undefined);

interface ExperimentProviderProps {
  children: React.ReactNode;
  configs: ExperimentConfig[];
  /**
   * Optional initial assignments for SSR or testing.
   */
  initialAssignments?: Record<string, string>;
}

/**
 * Provides A/B testing context to the application.
 * Manages experiment configurations and variant assignments with persistence.
 */
export const ExperimentProvider: React.FC<ExperimentProviderProps> = ({
  children,
  configs,
  initialAssignments = {},
}) => {
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const loaded: Record<string, string> = { ...initialAssignments };
    configs.forEach((config) => {
      const stored = storage.getString(config.id);
      if (stored && config.variants.includes(stored)) {
        loaded[config.id] = stored;
      } else {
        // Assign new variant
        const variant = assignVariant(config);
        loaded[config.id] = variant;
        if (config.sticky !== false) {
          storage.set(config.id, variant);
        }
      }
    });
    return loaded;
  });

  const configMap = useMemo(() => {
    return configs.reduce(
      (acc, config) => {
        acc[config.id] = config;
        return acc;
      },
      {} as Record<string, ExperimentConfig>
    );
  }, [configs]);

  const getVariant = useCallback(
    <T extends string>(experimentId: string): T | undefined => {
      return assignments[experimentId] as T | undefined;
    },
    [assignments]
  );

  const setVariant = useCallback((experimentId: string, variant: string) => {
    setAssignments((prev) => ({
      ...prev,
      [experimentId]: variant,
    }));
    storage.set(experimentId, variant);
  }, []);

  const value = useMemo(
    () => ({
      getVariant,
      setVariant,
      configs: configMap,
    }),
    [getVariant, setVariant, configMap]
  );

  return <ExperimentContext.Provider value={value}>{children}</ExperimentContext.Provider>;
};

/**
 * Assigns a variant based on weights or equal distribution.
 */
function assignVariant(config: ExperimentConfig): string {
  const { variants, weights } = config;
  if (!weights || weights.length !== variants.length) {
    // Equal distribution
    const index = Math.floor(Math.random() * variants.length);
    return variants[index];
  }

  const random = Math.random();
  let cumulativeWeight = 0;
  for (let i = 0; i < variants.length; i++) {
    cumulativeWeight += weights[i];
    if (random < cumulativeWeight) {
      return variants[i];
    }
  }

  return variants[variants.length - 1];
}

/**
 * Internal hook to access the experiment context.
 */
export const useExperimentContext = () => {
  const context = useContext(ExperimentContext);
  if (!context) {
    throw new Error('useExperimentContext must be used within an ExperimentProvider');
  }
  return context;
};
