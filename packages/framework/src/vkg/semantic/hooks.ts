import { useState, useEffect, useMemo } from 'react';
import { IVKGClient } from '../client';
import { QueryResult } from './types';
import { semanticQuery, SemanticQueryBuilder } from './builder';

/**
 * Hook for executing complex semantic queries.
 *
 * @param client The VKG client.
 * @param buildQuery A function that configures the SemanticQueryBuilder.
 * @param deps Dependencies that should trigger a re-run of the query.
 */
export function useSemanticQuery(
  client: IVKGClient,
  buildQuery: (builder: SemanticQueryBuilder) => void,
  deps: any[] = []
) {
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const builder = semanticQuery(client);
    buildQuery(builder);

    builder
      .execute()
      .then((res) => {
        if (isMounted) {
          setResults(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [client, ...deps]);

  return { results, loading, error };
}

/**
 * Hook for a single-pattern match, providing a simpler API for common cases.
 */
export function useSemanticMatch(
  client: IVKGClient,
  subject: string | null,
  predicate: string,
  object: string | null = null
) {
  return useSemanticQuery(
    client,
    (q) => {
      if (subject && object) {
        q.match(subject, predicate, object);
      } else if (subject) {
        q.match(subject, predicate, '?o').select('?o');
      } else if (object) {
        q.match('?s', predicate, object).select('?s');
      }
    },
    [subject, predicate, object]
  );
}
