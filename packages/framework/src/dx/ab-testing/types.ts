/**
 * Configuration for an individual experiment.
 */
export interface ExperimentConfig<T extends string = string> {
  /**
   * Unique identifier for the experiment.
   */
  id: string;
  /**
   * List of variants for this experiment.
   */
  variants: T[];
  /**
   * Weights for each variant. Must sum to 1.
   * If not provided, variants are distributed equally.
   */
  weights?: number[];
  /**
   * Optional description of the experiment.
   */
  description?: string;
  /**
   * Sticky assignment (default: true).
   * If true, the variant is persisted and will remain the same for the user.
   */
  sticky?: boolean;
}

/**
 * Result of a variant assignment.
 */
export interface ExperimentAssignment<T extends string = string> {
  /**
   * The variant assigned to the user.
   */
  variant: T;
  /**
   * Whether the assignment was forced (e.g., via URL parameter or manual override).
   */
  isForced: boolean;
}

/**
 * Hook return type for useExperiment.
 */
export interface UseExperimentReturn<T extends string = string> {
  /**
   * The variant assigned to the user.
   */
  variant: T;
  /**
   * Function to manually set the variant.
   */
  setVariant: (variant: T) => void;
  /**
   * The full experiment configuration.
   */
  config: ExperimentConfig<T>;
}

/**
 * Context value for the ExperimentProvider.
 */
export interface ExperimentContextValue {
  /**
   * Get the assigned variant for a specific experiment.
   */
  getVariant: <T extends string>(experimentId: string) => T | undefined;
  /**
   * Manually set a variant for an experiment.
   */
  setVariant: (experimentId: string, variant: string) => void;
  /**
   * All active experiment configurations.
   */
  configs: Record<string, ExperimentConfig>;
}
