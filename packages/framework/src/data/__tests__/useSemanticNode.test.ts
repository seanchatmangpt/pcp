import { renderHook, act } from '@testing-library/react-native';
import { useSemanticNode } from '../vkg/useSemanticNode';
import { VirtualKnowledgeGraphClient } from '@/src/lib/vkg/client';
import { DataFactory } from '@/src/lib/vkg/rdf';

// Mock dependencies
jest.mock('../../../lib/vkg/client');

describe('useSemanticNode', () => {
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
