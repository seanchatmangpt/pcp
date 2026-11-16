import { useExperimentContext } from './ExperimentProvider';
import { ExperimentConfig, UseExperimentReturn } from './types';

/**
 * Hook to access A/B testing experiment state.
 *
 * @param experimentId The unique identifier for the experiment.
 * @returns The assigned variant, a function to override it, and the experiment configuration.
 *
 * @example
 * const { variant } = useExperiment('new-onboarding-flow');
 * if (variant === 'B') return <NewOnboarding />;
 * return <OldOnboarding />;
 */
export function useExperiment<T extends string>(experimentId: string): UseExperimentReturn<T> {
  const { getVariant, setVariant, configs } = useExperimentContext();
  const variant = getVariant<T>(experimentId);
  const config = configs[experimentId] as ExperimentConfig<T>;

  if (!config) {
    throw new Error(
      `Experiment "${experimentId}" was not found. Please ensure it is defined in the ExperimentProvider configs.`
    );
  }

  if (variant === undefined) {
    // This should ideally not happen if the provider is correctly initialized
    throw new Error(`Variant for experiment "${experimentId}" is undefined.`);
  }

  return {
    variant,
    setVariant: (v: T) => setVariant(experimentId, v),
    config,
  };
}
