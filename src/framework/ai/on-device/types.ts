/**
 * Configuration options for local inference.
 */
export interface LocalInferenceConfig {
  /**
   * The model ID to use. Defaults to 'phi-2-orange'.
   */
  modelId?: string;
  /**
   * Temperature for sampling. Higher values make output more random.
   */
  temperature?: number;
  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;
  /**
   * Whether to stream the response.
   */
  stream?: boolean;
}

/**
 * Result of a local inference operation.
 */
export interface LocalInferenceResult {
  /**
   * The generated text.
   */
  text: string;
  /**
   * Metadata about the inference operation.
   */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * State of the local inference hook.
 */
export interface LocalInferenceState {
  /**
   * Whether inference is currently in progress.
   */
  isLoading: boolean;
  /**
   * Any error that occurred during inference.
   */
  error: Error | null;
  /**
   * The result of the last inference operation.
   */
  result: LocalInferenceResult | null;
}

/**
 * Options for the runInference function.
 */
export interface RunInferenceOptions extends Partial<LocalInferenceConfig> {
  /**
   * The prompt to send to the model.
   */
  prompt: string;
}

/**
 * Interface for the local inference engine.
 */
export interface ILocalInferenceEngine {
  /**
   * Runs inference on the given prompt.
   */
  infer(options: RunInferenceOptions): Promise<LocalInferenceResult>;
  /**
   * Streams inference results for the given prompt.
   */
  streamInfer(
    options: RunInferenceOptions,
    onToken: (token: string) => void
  ): Promise<LocalInferenceResult>;
}
