import { SemanticQueryBuilder, semanticQuery } from '../builder';
import { DataFactory } from '../../rdf';
import { NS } from '../types';

const mockMatch = jest.fn();
const mockClient = {
  match: mockMatch,
  addQuads: jest.fn(),
  removeQuads: jest.fn(),
  jsonLdToQuads: jest.fn(),
  quadsToJsonLd: jest.fn(),
  getSyncEngine: jest.fn(),
  addJsonLd: jest.fn(),
};

describe('SemanticQueryBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs a simple match', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );
    mockMatch.mockResolvedValue([q]);

    const results = await semanticQuery(mockClient).match('http://s', 'http://p', '?o').execute();

    expect(mockMatch).toHaveBeenCalledWith(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      undefined
    );

    expect(results).toHaveLength(1);
    expect(results[0].o.value).toBe('http://o');
  });

  it('handles semantic properties with NS expansion', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode(NS.schema + 'name'),
      DataFactory.literal('Alice')
    );
    mockMatch.mockResolvedValue([q]);

    const results = await semanticQuery(mockClient)
      .match('http://s', 'schema:name', '?name')
      .execute();

    expect(mockMatch).toHaveBeenCalledWith(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode(NS.schema + 'name'),
      undefined
    );

    expect(results[0].name.value).toBe('Alice');
  });

  it('performs a join between two patterns', async () => {
    const q1 = DataFactory.quad(
      DataFactory.namedNode('http://person1'),
      DataFactory.namedNode(NS.rdf + 'type'),
      DataFactory.namedNode(NS.schema + 'Person')
    );
    const q2 = DataFactory.quad(
      DataFactory.namedNode('http://person1'),
      DataFactory.namedNode(NS.schema + 'name'),
      DataFactory.literal('Alice')
    );

    mockMatch.mockImplementation((s, p, o) => {
      if (p.value === NS.rdf + 'type') return Promise.resolve([q1]);
      if (p.value === NS.schema + 'name') return Promise.resolve([q2]);
      return Promise.resolve([]);
    });

    const results = await semanticQuery(mockClient)
      .match('?p', 'rdf:type', 'schema:Person')
      .match('?p', 'schema:name', '?name')
      .execute();

    expect(results).toHaveLength(1);
    expect(results[0].p.value).toBe('http://person1');
    expect(results[0].name.value).toBe('Alice');
  });

  it('filters results with select', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );
    mockMatch.mockResolvedValue([q]);

    const results = await semanticQuery(mockClient)
      .match('http://s', 'http://p', '?o')
      .select('?o')
      .execute();

    expect(results[0]).toHaveProperty('o');
    expect(results[0]).not.toHaveProperty('s');
  });

  it('returns empty results if no match found', async () => {
    mockMatch.mockResolvedValue([]);

    const results = await semanticQuery(mockClient).match('?s', 'http://p', 'http://o').execute();

    expect(results).toHaveLength(0);
  });

  it('handles multiple matches for a variable', async () => {
    const q1 = DataFactory.quad(
      DataFactory.namedNode('http://s1'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );
    const q2 = DataFactory.quad(
      DataFactory.namedNode('http://s2'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );
    mockMatch.mockResolvedValue([q1, q2]);

    const results = await semanticQuery(mockClient).match('?s', 'http://p', 'http://o').execute();

    expect(results).toHaveLength(2);
    expect(results[0].s.value).toBe('http://s1');
    expect(results[1].s.value).toBe('http://s2');
  });
});
