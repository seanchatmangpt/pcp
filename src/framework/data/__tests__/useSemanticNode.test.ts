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

  it('handles fetch error', async () => {
    const mockError = new Error('Database failed');
    mockVkgClient.match.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() =>
      useSemanticNode('https://schema.org/CreativeWork', '123', { vkgClient: mockVkgClient })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(mockError);
    expect(result.current.node).toBeNull();
  });

  it('mutates node successfully', async () => {
    const { result } = renderHook(() =>
      useSemanticNode('https://schema.org/CreativeWork', '123', { vkgClient: mockVkgClient })
    );

    const updateData = { name: 'Updated' };

    await act(async () => {
      await result.current.mutate(updateData);
    });

    expect(mockVkgClient.jsonLdToQuads).toHaveBeenCalledWith({
      ...updateData,
      '@id': '123',
      '@type': 'https://schema.org/CreativeWork',
    });
    expect(mockVkgClient.addQuads).toHaveBeenCalled();
    expect(result.current.node).toEqual({
      ...updateData,
      '@id': '123',
      '@type': 'https://schema.org/CreativeWork',
    });
  });

  it('throws error when mutating without id', async () => {
    const { result } = renderHook(() =>
      useSemanticNode('https://schema.org/CreativeWork', undefined, { vkgClient: mockVkgClient })
    );

    await expect(result.current.mutate({ name: 'Fail' })).rejects.toThrow(
      'Cannot mutate node without a valid identifier.'
    );
  });

  it('removes node successfully', async () => {
    const mockQuad = {} as any;
    mockVkgClient.match.mockResolvedValue([mockQuad]);

    const { result } = renderHook(() =>
      useSemanticNode('https://schema.org/CreativeWork', '123', { vkgClient: mockVkgClient })
    );

    await act(async () => {
      await result.current.remove();
    });

    expect(mockVkgClient.removeQuads).toHaveBeenCalledWith([mockQuad]);
    expect(result.current.node).toBeNull();
  });

  it('does nothing when removing without id', async () => {
    const { result } = renderHook(() =>
      useSemanticNode('https://schema.org/CreativeWork', undefined, { vkgClient: mockVkgClient })
    );

    await act(async () => {
      await result.current.remove();
    });

    expect(mockVkgClient.removeQuads).not.toHaveBeenCalled();
  });
});
