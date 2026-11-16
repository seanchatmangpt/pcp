import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useNeuroSymbolicQuery } from '../useNeuroSymbolicQuery';
import { DataFactory } from '../../../vkg/rdf';

const mockClient = {
  match: jest.fn(),
  addQuads: jest.fn(),
  removeQuads: jest.fn(),
  jsonLdToQuads: jest.fn(),
  quadsToJsonLd: jest.fn(),
  getSyncEngine: jest.fn(),
  addJsonLd: jest.fn(),
} as any;

describe('useNeuroSymbolicQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs pure symbolic query when neuro constraints are absent', async () => {
    const quad = DataFactory.quad(
      DataFactory.namedNode('http://subject'),
      DataFactory.namedNode('http://predicate'),
      DataFactory.literal('object'),
      DataFactory.defaultGraph()
    );
    mockClient.match.mockResolvedValue([quad]);

    const { result } = renderHook(() =>
      useNeuroSymbolicQuery(mockClient, {
        symbolic: { subject: 'http://subject' },
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].quad).toBe(quad);
    expect(result.current.data[0].score).toBe(1.0);
    expect(mockClient.match).toHaveBeenCalled();
  });

  it('performs neuro-symbolic query with fuzzy semantic search', async () => {
    const quad1 = DataFactory.quad(
      DataFactory.namedNode('http://s1'),
      DataFactory.namedNode('http://p'),
      DataFactory.literal('Target Match'),
      DataFactory.defaultGraph()
    );
    const quad2 = DataFactory.quad(
      DataFactory.namedNode('http://s2'),
      DataFactory.namedNode('http://p'),
      DataFactory.literal('Irrelevant'),
      DataFactory.defaultGraph()
    );
    mockClient.match.mockResolvedValue([quad1, quad2]);

    const { result } = renderHook(() =>
      useNeuroSymbolicQuery(mockClient, {
        symbolic: { predicate: 'http://p' },
        neuro: { prompt: 'Target Match', threshold: 0.1 }, // Low threshold to ensure results
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.length).toBeGreaterThan(0);
    expect(result.current.data[0].score).toBeGreaterThanOrEqual(0.1);
    // Results should be sorted by score
    if (result.current.data.length > 1) {
      expect(result.current.data[0].score).toBeGreaterThanOrEqual(result.current.data[1].score);
    }
  });

  it('filters results based on neuro threshold', async () => {
    const quad1 = DataFactory.quad(
      DataFactory.namedNode('http://s1'),
      DataFactory.namedNode('http://p'),
      DataFactory.literal('Some Text'),
      DataFactory.defaultGraph()
    );
    mockClient.match.mockResolvedValue([quad1]);

    // Use a very high threshold that our stub is unlikely to meet for some inputs
    // or just trust that the filter logic works.
    const { result } = renderHook(() =>
      useNeuroSymbolicQuery(mockClient, {
        symbolic: { predicate: 'http://p' },
        neuro: { prompt: 'Something very specific', threshold: 1.1 }, // Impossible threshold
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(0);
  });
});
