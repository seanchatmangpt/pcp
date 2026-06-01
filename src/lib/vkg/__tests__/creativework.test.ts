import { VirtualKnowledgeGraphClient } from '../client';
import { DataFactory } from '../rdf';
import { CreativeWork } from '../../../types/semantic/CreativeWork';

import { db } from '../../db/db';

// Mock Drizzle and Supabase
jest.mock('../../db/db', () => {
  const mockWhereSelectFn = jest.fn().mockImplementation(() => Promise.resolve([]));
  const mockFromFn = jest.fn().mockImplementation(() => {
    const promise = Promise.resolve([]);
    (promise as any).where = mockWhereSelectFn;
    return promise;
  });
  return {
    db: {
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue([]) }),
      select: jest.fn().mockReturnValue({ from: mockFromFn }),
      delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      _mockWhereSelect: mockWhereSelectFn,
    },
  };
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}));

describe('Schema.org CreativeWork Mapping', () => {
  let client: VirtualKnowledgeGraphClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new VirtualKnowledgeGraphClient();
  });

  it('successfully translates CreativeWork JSON-LD to RDF Quads and back', () => {
    const doc: CreativeWork = {
      '@id': 'urn:creativework:test-id',
      '@type': 'https://schema.org/CreativeWork',
      name: 'Test CreativeWork',
      description: 'Auto-generated test entity',
    };

    const quadsList = client.jsonLdToQuads(doc);
    
    // Assert type assertion is created
    const typeQuad = quadsList.find((q) => q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    expect(typeQuad?.object.value).toBe('https://schema.org/CreativeWork');

    // Assert literal attributes are created
    const nameQuad = quadsList.find((q) => q.predicate.value === 'https://schema.org/name');
    expect(nameQuad?.object.value).toBe('Test CreativeWork');

    // Reconstruct
    const [reconstructed] = client.quadsToJsonLd(quadsList);
    expect(reconstructed['@id']).toBe(doc['@id']);
    expect(reconstructed['name']).toBe(doc['name']);
    expect(reconstructed['description']).toBe(doc['description']);
  });
});
