import { useState, useEffect, useMemo } from 'react';
import { Quad } from '../rdf';
import { LocalInferenceEngine } from './engine';
import { InferenceRule, InferenceResult } from './types';
import { IVKGClient } from '../client';

/**
 * DX Hook: useGraphInference
 *
 * Performs local graph inference over cached RDF quads.
 * Automatically triggers inference when rules or client data changes.
 *
 * @param client - The VKG client instance to fetch quads from.
 * @param rules - Array of inference rules to apply.
 * @param options - Configuration for the inference process.
 * @returns { inferredQuads: Quad[], loading: boolean, error: Error | null, stats: InferenceResult | null }
 */
export function useGraphInference(
  client: IVKGClient,
  rules: InferenceRule[],
  options: { maxIterations?: number; enabled?: boolean } = {}
) {
  const { maxIterations = 5, enabled = true } = options;
  const [inferredQuads, setInferredQuads] = useState<Quad[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<InferenceResult | null>(null);

  // Memoize engine to prevent unnecessary re-initialization
  const engine = useMemo(() => new LocalInferenceEngine(rules), [rules]);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const runInference = async () => {
      try {
        // Fetch base quads from the client
        const allQuads = await client.match();

        if (!isMounted) return;

        // Execute local inference
        const result = engine.infer(allQuads, maxIterations);

        if (isMounted) {
          setInferredQuads(result.inferredQuads);
          setStats(result);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    };

    runInference();

    return () => {
      isMounted = false;
    };
  }, [client, engine, maxIterations, enabled]);

  return {
    inferredQuads,
    loading,
    error,
    stats,
    /**
     * Helper to check if a specific relationship has been inferred.
     */
    isInferred: (subject: string, predicate: string, object: string) => {
      return inferredQuads.some(
        (q) =>
          q.subject.value === subject &&
          q.predicate.value === predicate &&
          q.object.value === object
      );
    },
  };
}
