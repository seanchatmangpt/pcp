import { renderHook, act } from '@testing-library/react-native';
import { useSemanticNode } from '../vkg/useSemanticNode';
import { createSemanticHook } from '../vkg/createSemanticHook';
import { VirtualKnowledgeGraphClient } from '@/src/lib/vkg/client';

// Mock dependencies
jest.mock('@/src/lib/vkg/client');

describe('Virtual Knowledge Graph (VKG) Hooks Integration', () => {
  let mockVkgClient: jest.Mocked<VirtualKnowledgeGraphClient>;

  beforeEach(() => {
    mockVkgClient = new VirtualKnowledgeGraphClient() as jest.Mocked<VirtualKnowledgeGraphClient>;
    mockVkgClient.match.mockResolvedValue([]);
    mockVkgClient.quadsToJsonLd.mockReturnValue([]);
    mockVkgClient.addQuads.mockResolvedValue(undefined);
    mockVkgClient.removeQuads.mockResolvedValue(undefined);
    mockVkgClient.jsonLdToQuads.mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('useSemanticNode', () => {
    it('initializes with null node and loading false if no id is provided', () => {
      const { result } = renderHook(() =>
        useSemanticNode('https://schema.org/CreativeWork', undefined, { vkgClient: mockVkgClient })
      );

      expect(result.current.node).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('fetches node successfully', async () => {
      const mockQuad = {} as any;
      const mockJsonLd = { '@id': '123', '@type': 'https://schema.org/CreativeWork', name: 'Test' };

      mockVkgClient.match.mockResolvedValueOnce([mockQuad]); // type match
      mockVkgClient.match.mockResolvedValueOnce([mockQuad]); // node match
      mockVkgClient.quadsToJsonLd.mockReturnValue([mockJsonLd]);

      const { result } = renderHook(() =>
        useSemanticNode('https://schema.org/CreativeWork', '123', { vkgClient: mockVkgClient })
      );

      expect(result.current.loading).toBe(true);

      await act(async () => {
        // wait for effect to resolve
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.node).toEqual(mockJsonLd);
      expect(result.current.error).toBeNull();
    });

    it('handles node not found (no type quads)', async () => {
      mockVkgClient.match.mockResolvedValueOnce([]); // no type match

      const { result } = renderHook(() =>
        useSemanticNode('https://schema.org/CreativeWork', '123', { vkgClient: mockVkgClient })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.node).toBeNull();
    });
  });

  describe('createSemanticHook', () => {
    it('creates a hook bound to the given typeUri', async () => {
      const mockQuad = {} as any;
      const mockJsonLd = { '@id': '123', '@type': 'https://schema.org/MyType', name: 'Test' };

      mockVkgClient.match.mockResolvedValueOnce([mockQuad]); // type match
      mockVkgClient.match.mockResolvedValueOnce([mockQuad]); // node match
      mockVkgClient.quadsToJsonLd.mockReturnValue([mockJsonLd]);

      const useMyType = createSemanticHook<{ '@type': string; '@id': string; name?: string }>(
        'https://schema.org/MyType'
      );

      const { result } = renderHook(() => useMyType('123', { vkgClient: mockVkgClient }));

      expect(result.current.loading).toBe(true);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockVkgClient.match).toHaveBeenCalledWith(
        expect.objectContaining({ value: '123' }),
        expect.objectContaining({ value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' }),
        expect.objectContaining({ value: 'https://schema.org/MyType' })
      );
      expect(result.current.loading).toBe(false);
      expect(result.current.node).toEqual(mockJsonLd);
    });
  });
});
