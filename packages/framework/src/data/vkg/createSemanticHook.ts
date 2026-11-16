import { useSemanticNode, UseSemanticNodeOptions } from './useSemanticNode';

export function createSemanticHook<T extends { '@type': string | string[]; '@id': string }>(
  typeUri: string
) {
  return function useBoundSemanticNode(id?: string, options?: UseSemanticNodeOptions) {
    return useSemanticNode<T>(typeUri, id, options);
  };
}
