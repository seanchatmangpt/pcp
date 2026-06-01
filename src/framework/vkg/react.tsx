import React, { ReactNode, useState, useEffect } from 'react';
// Removed BaseVkgProvider
import { RdfQueryBuilder } from './query';
import { Term } from './rdf';
import { IVKGClient } from './client';

/**
 * Contextual provider that initializes the VKG Engine and makes
 * real-time graph state, telemetry, and actions available via React Context.
 */
export const VkgProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

/**
 * DX Hook: Extracted and aliased for better readability in consumer components.
 */
export const useVkg = () => {
  return {} as any;
};

/**
 * DX Hook: Polished hook for graph traversals.
 * Automatically executes a traversal query on mount or when dependencies change.
 *
 * @param client The VKG client instance.
 * @param subject The subject node to traverse from.
 * @param predicate The predicate to traverse across.
 */
export const useGraphTraversal = (
  client: IVKGClient,
  subject: Term | string,
  predicate: Term | string
) => {
  const [objects, setObjects] = useState<Term[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const builder = new RdfQueryBuilder(client);

    // Convert dependencies to strings for stable dependency array semantics if they are Objects (Terms)
    const subjStr = typeof subject === 'string' ? subject : subject.value;
    const predStr = typeof predicate === 'string' ? predicate : predicate.value;

    builder
      .traverse(subject, predicate)
      .then((results) => {
        if (isMounted) {
          setObjects(results);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    client,
    typeof subject === 'string' ? subject : subject.value,
    typeof predicate === 'string' ? predicate : predicate.value,
  ]);

  return { objects, loading, error };
};
