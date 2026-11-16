import { useEffect, useState, useCallback } from 'react';
import { VirtualKnowledgeGraphClient } from '@/src/lib/vkg/client';
import { DataFactory } from '@/src/lib/vkg/rdf';

const defaultVkgClient = new VirtualKnowledgeGraphClient();

/**
 * Options for the `usePaginatedSemanticNode` hook.
 */
export interface UsePaginatedSemanticNodeOptions {
  /**
   * Optional custom VKG client instance.
   */
  vkgClient?: VirtualKnowledgeGraphClient;
  /**
   * Number of items per page. Defaults to 10.
   */
  pageSize?: number;
}

/**
 * A hook that retrieves and paginates semantic nodes of a specified type.
 *
 * @template T - The type of the node.
 * @param {string} typeUri - The URI of the type to match.
 * @param {UsePaginatedSemanticNodeOptions} [options] - Pagination and client options.
 * @returns An object containing paginated nodes, loading state, error state, and pagination controls.
 */
export function usePaginatedSemanticNode<T extends { '@type': string | string[]; '@id': string }>(
  typeUri: string,
  options?: UsePaginatedSemanticNodeOptions
) {
  const [nodes, setNodes] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState<number>(1);
  const [allNodes, setAllNodes] = useState<T[]>([]);

  const client = options?.vkgClient ?? defaultVkgClient;
  const pageSize = options?.pageSize ?? 10;

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const predicateType = DataFactory.namedNode(
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      );
      const objectType = DataFactory.namedNode(typeUri);

      const typeQuads = await client.match(undefined, predicateType, objectType);

      if (typeQuads.length === 0) {
        setAllNodes([]);
        setLoading(false);
        return;
      }

      // get all full quads for the matched subjects
      const subjects = Array.from(new Set(typeQuads.map((q) => q.subject.value)));

      const allNodeQuads: any[] = [];
      for (const subjectVal of subjects) {
        const subjectNode = typeQuads.find((q) => q.subject.value === subjectVal)?.subject;
        if (subjectNode) {
          const quads = await client.match(subjectNode);
          allNodeQuads.push(...quads);
        }
      }

      const jsonLdNodes = client.quadsToJsonLd(allNodeQuads);

      // Filter the nodes correctly to ensure they are of the exact requested type
      const filtered = jsonLdNodes.filter((n) => {
        if (Array.isArray(n['@type'])) {
          return n['@type'].includes(typeUri);
        }
        return n['@type'] === typeUri;
      }) as T[];

      setAllNodes(filtered);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [typeUri, client]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const totalPages = Math.max(1, Math.ceil(allNodes.length / pageSize));

  useEffect(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    setNodes(allNodes.slice(start, end));
  }, [allNodes, page, pageSize]);

  const nextPage = useCallback(() => {
    setPage((p) => (p < totalPages ? p + 1 : p));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((p) => (p > 1 ? p - 1 : p));
  }, []);

  const setPageNum = useCallback(
    (p: number) => {
      if (p >= 1 && p <= totalPages) {
        setPage(p);
      }
    },
    [totalPages]
  );

  return {
    nodes,
    loading,
    error,
    page,
    totalPages,
    nextPage,
    prevPage,
    setPage: setPageNum,
    refresh: fetchNodes,
  };
}
