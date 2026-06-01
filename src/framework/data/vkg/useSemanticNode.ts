import { useEffect, useState, useCallback } from 'react';
import { VirtualKnowledgeGraphClient } from '@/src/lib/vkg/client';
import { DataFactory } from '@/src/lib/vkg/rdf';

// The client is stateful but instantiated here as a singleton for the hooks,
// mirroring the previous hooks' behavior.
const defaultVkgClient = new VirtualKnowledgeGraphClient();

export interface UseSemanticNodeOptions {
  vkgClient?: VirtualKnowledgeGraphClient;
}

export function useSemanticNode<T extends { '@type': string | string[]; '@id': string }>(
  typeUri: string,
  id?: string,
  options?: UseSemanticNodeOptions
) {
  const [node, setNode] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<Error | null>(null);

  const client = options?.vkgClient ?? defaultVkgClient;

  const fetchNode = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const subject = DataFactory.namedNode(id);
      const predicateType = DataFactory.namedNode(
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      );
      const objectType = DataFactory.namedNode(typeUri);

      const typeQuads = await client.match(subject, predicateType, objectType);
      if (typeQuads.length === 0) {
        setNode(null);
        setLoading(false);
        return;
      }

      const nodeQuads = await client.match(subject);
      const [jsonLd] = client.quadsToJsonLd(nodeQuads);
      setNode((jsonLd as T) || null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id, typeUri, client]);

  useEffect(() => {
    fetchNode();
  }, [fetchNode]);

  const mutate = useCallback(
    async (updatedData: Omit<T, '@type' | '@id'>) => {
      if (!id) throw new Error('Cannot mutate node without a valid identifier.');
      const fullNode = {
        ...updatedData,
        '@id': id,
        '@type': typeUri,
      } as unknown as T;

      const quadsList = client.jsonLdToQuads(fullNode);
      await client.addQuads(quadsList);
      setNode(fullNode);
    },
    [id, typeUri, client]
  );

  const remove = useCallback(async () => {
    if (!id) return;
    const subject = DataFactory.namedNode(id);
    const nodeQuads = await client.match(subject);
    await client.removeQuads(nodeQuads);
    setNode(null);
  }, [id, client]);

  return {
    node,
    loading,
    error,
    mutate,
    remove,
    refresh: fetchNode,
  };
}
