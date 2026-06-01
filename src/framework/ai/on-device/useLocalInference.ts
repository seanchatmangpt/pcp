import { useState, useCallback, useRef } from 'react';
import {
  LocalInferenceConfig,
  LocalInferenceResult,
  LocalInferenceState,
  RunInferenceOptions,
} from './types';
import { defaultLocalInferenceEngine } from './LocalInferenceEngine';

/**
 * Hook to perform on-device LLM inference.
 * Abstracts the complexity of managing local model lifecycle and state.
 *
 * @param config Default configuration for inference.
 * @returns State and functions to run local inference.
 *
 * @example
 * ```tsx
 * const { runInference, isLoading, result } = useLocalInference({ modelId: 'phi-2' });
 *
 * const handleAsk = async () => {
 *   await runInference({ prompt: 'What is the meaning of life?' });
 * };
 * ```
 */
export function useLocalInference(config: LocalInferenceConfig = {}) {
  const [state, setState] = useState<LocalInferenceState>({
    isLoading: false,
    error: null,
    result: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Executes local inference.
   * Supports both streaming and non-streaming modes based on config.
   */
  const runInference = useCallback(
    async (options: RunInferenceOptions) => {
      // Abort previous inference if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const mergedOptions = { ...config, ...options };

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        let result: LocalInferenceResult;

        if (mergedOptions.stream) {
          // Handle streaming
          let accumulatedText = '';
          result = await defaultLocalInferenceEngine.streamInfer(mergedOptions, (token) => {
            accumulatedText += token;
            setState((prev) => ({
              ...prev,
              result: {
                ...prev.result,
                text: accumulatedText,
              } as LocalInferenceResult,
            }));
          });
        } else {
          // Handle non-streaming
          result = await defaultLocalInferenceEngine.infer(mergedOptions);
        }

        setState({
          isLoading: false,
          error: null,
          result,
        });

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (error.name === 'AbortError') {
          setState((prev) => ({ ...prev, isLoading: false }));
          return null;
        }

        setState({
          isLoading: false,
          error,
          result: null,
        });

        throw error;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [config]
  );

  /**
   * Resets the inference state.
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({
      isLoading: false,
      error: null,
      result: null,
    });
  }, []);

  return {
    ...state,
    runInference,
    reset,
  };
}
