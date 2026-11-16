import { useState, useCallback } from 'react';

/**
 * Options for `useOptimisticMutation`.
 */
export interface UseOptimisticMutationOptions<T, R> {
  /**
   * The actual asynchronous mutation function.
   */
  mutationFn: (variables: T) => Promise<R>;
  /**
   * Called immediately before the mutation runs.
   * Useful for setting optimistic UI state.
   * Can return a context object that will be passed to `onSuccess` or `onError`.
   */
  onMutate?: (variables: T) => Promise<any> | any;
  /**
   * Called after a successful mutation.
   */
  onSuccess?: (data: R, variables: T, context: any) => Promise<void> | void;
  /**
   * Called when the mutation fails.
   * Useful for rolling back optimistic UI state.
   */
  onError?: (error: Error, variables: T, context: any) => Promise<void> | void;
}

/**
 * A data hook that provides optimistic mutation wrappers.
 *
 * @template T - The type of variables passed to the mutation function.
 * @template R - The return type of the mutation function.
 * @param {UseOptimisticMutationOptions<T, R>} options - The mutation options.
 * @returns An object containing the mutation execution function, its loading state, and any error.
 */
export function useOptimisticMutation<T, R>(options: UseOptimisticMutationOptions<T, R>) {
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (variables: T) => {
      setIsMutating(true);
      setError(null);
      let context: any;
      try {
        if (options.onMutate) {
          context = await options.onMutate(variables);
        }
        const data = await options.mutationFn(variables);
        if (options.onSuccess) {
          await options.onSuccess(data, variables, context);
        }
        return data;
      } catch (err: any) {
        setError(err);
        if (options.onError) {
          await options.onError(err, variables, context);
        }
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [options]
  );

  return { mutate, isMutating, error };
}
