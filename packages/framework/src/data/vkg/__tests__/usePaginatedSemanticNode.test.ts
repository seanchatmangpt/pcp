import { renderHook, act } from '@testing-library/react-native';
import { usePaginatedSemanticNode } from '../usePaginatedSemanticNode';
import { VirtualKnowledgeGraphClient } from '@/src/lib/vkg/client';

jest.mock('../../../../lib/vkg/client', () => {
  return {
    VirtualKnowledgeGraphClient: jest.fn().mockImplementation(() => ({
      match: jest.fn(),
      quadsToJsonLd: jest.fn(),
    })),
  };
});

describe('usePaginatedSemanticNode', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = new VirtualKnowledgeGraphClient();
    mockClient.match.mockClear();
    mockClient.quadsToJsonLd.mockClear();
  });

  it('should initialize and return empty list when no nodes matched', async () => {
    mockClient.match.mockResolvedValue([]);

    const { result } = renderHook(() =>
      usePaginatedSemanticNode('http://example.com/Type', { vkgClient: mockClient })
    );

    expect(result.current.loading).toBe(true);

    await act(async () => {
      // wait for fetchNodes to complete
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.nodes).toEqual([]);
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(1);
  });

  it('should paginate items correctly', async () => {
    const typeQuads = [
      { subject: { value: 'id1' } },
      { subject: { value: 'id2' } },
      { subject: { value: 'id3' } },
    ];

    // first match call gets the types
    mockClient.match.mockImplementation((subj: any, pred: any, obj: any) => {
      if (!subj) {
        return Promise.resolve(typeQuads);
      }
      return Promise.resolve([{ subject: subj }]);
    });

    mockClient.quadsToJsonLd.mockReturnValue([
      { '@id': 'id1', '@type': 'http://example.com/Type', name: 'Item 1' },
      { '@id': 'id2', '@type': 'http://example.com/Type', name: 'Item 2' },
      { '@id': 'id3', '@type': 'http://example.com/Type', name: 'Item 3' },
    ]);

    const { result } = renderHook(() =>
      usePaginatedSemanticNode('http://example.com/Type', { vkgClient: mockClient, pageSize: 2 })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.nodes.length).toBe(2);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.nodes[0]['@id']).toBe('id1');

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.page).toBe(2);
    expect(result.current.nodes.length).toBe(1);
    expect(result.current.nodes[0]['@id']).toBe('id3');

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.page).toBe(1);
    expect(result.current.nodes.length).toBe(2);

    act(() => {
      result.current.setPage(2);
    });

    expect(result.current.page).toBe(2);
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('db error');
    mockClient.match.mockRejectedValue(error);

    const { result } = renderHook(() =>
      usePaginatedSemanticNode('http://example.com/Type', { vkgClient: mockClient })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(error);
  });
});
