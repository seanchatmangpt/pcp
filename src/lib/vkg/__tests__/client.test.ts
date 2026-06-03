import { VirtualKnowledgeGraphClient, VKGRdfSyncEngine } from '../client';
import { DataFactory, Quad } from '../rdf';

import { db } from '../../db/db';
import { supabase } from '@/lib/supabase';

// Mock the database client structure
jest.mock('../../db/db', () => {
  const mockReturningFn = jest.fn();
  const mockValuesFn = jest.fn().mockReturnValue({ returning: mockReturningFn });
  const mockInsertFn = jest.fn().mockReturnValue({ values: mockValuesFn });

  const mockWhereSelectFn = jest.fn().mockImplementation(() => Promise.resolve([]));
  const mockFromFn = jest.fn().mockImplementation(() => {
    const promise = Promise.resolve([]);
    (promise as any).where = mockWhereSelectFn;
    return promise;
  });
  const mockSelectFn = jest.fn().mockReturnValue({ from: mockFromFn });

  const mockWhereDeleteFn = jest.fn().mockImplementation(() => Promise.resolve());
  const mockDeleteFn = jest.fn().mockImplementation(() => {
    const promise = Promise.resolve();
    (promise as any).where = mockWhereDeleteFn;
    return promise;
  });

  return {
    db: {
      insert: mockInsertFn,
      select: mockSelectFn,
      delete: mockDeleteFn,

      // Expose mock sub-functions for assertions
      _mockReturning: mockReturningFn,
      _mockValues: mockValuesFn,
      _mockInsert: mockInsertFn,
      _mockWhereSelect: mockWhereSelectFn,
      _mockFrom: mockFromFn,
      _mockSelect: mockSelectFn,
      _mockWhereDelete: mockWhereDeleteFn,
      _mockDelete: mockDeleteFn,
    },
  };
});

// Mock Supabase client supporting chainable and thenable queries
jest.mock('@/lib/supabase', () => {
  const mockUpsert = jest.fn();
  const mockDeleteEq = jest.fn();
  
  mockDeleteEq.mockImplementation(() => {
    const p = Promise.resolve({ error: null });
    (p as any).eq = mockDeleteEq;
    return p;
  });

  const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });
  const mockFrom = jest.fn().mockReturnValue({
    upsert: mockUpsert,
    delete: mockDelete,
  });

  return {
    supabase: {
      from: mockFrom,
      _mockUpsert: mockUpsert,
      _mockDelete: mockDelete,
      _mockEqDelete: mockDeleteEq,
      _mockFrom: mockFrom,
    },
  };
});

// Mock SyncEngine queueJob
const mockQueueJob = jest.fn();
jest.mock('../../sync/syncEngine', () => {
  return {
    SyncEngine: class MockSyncEngine {
      public queueJob = mockQueueJob;
      public pushChanges = jest.fn();
    },
  };
}, { virtual: true });

const mockedDb = db as any;
const mockedSupabase = supabase as any;

describe('VirtualKnowledgeGraphClient (RDF.js Spec)', () => {
  let client: VirtualKnowledgeGraphClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new VirtualKnowledgeGraphClient();
    jest.spyOn(client.getSyncEngine() as any, 'queueJob').mockImplementation(mockQueueJob);
  });

  describe('getSyncEngine', () => {
    it('returns the sync engine instance', () => {
      const engine = client.getSyncEngine();
      expect(engine).toBeInstanceOf(VKGRdfSyncEngine);
    });
  });

  describe('jsonLdToQuads', () => {
    it('parses a basic Schema.org Person JSON-LD document into standard RDF Quads', () => {
      const doc = {
        '@id': 'person:alice',
        '@type': 'Person',
        name: 'Alice Cooper',
        knows: 'person:bob',
      };

      const quadsList = client.jsonLdToQuads(doc);
      expect(quadsList.length).toBe(3);
    });

    it('returns an empty array when doc is null or not an object', () => {
      expect(client.jsonLdToQuads(null)).toEqual([]);
      expect(client.jsonLdToQuads("string" as any)).toEqual([]);
    });

    it('ignores non-string @type values', () => {
      const doc = { '@id': 'test', '@type': 123 };
      const quads = client.jsonLdToQuads(doc);
      expect(quads.find(q => q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type')).toBeUndefined();
    });

    it('ignores null or undefined properties', () => {
      const doc = {
        '@id': 'person:bob',
        name: null,
        age: undefined,
        active: true
      };
      const quadsList = client.jsonLdToQuads(doc);
      expect(quadsList.length).toBe(1);
    });

    it('handles symbol primitives falling back to String', () => {
      const sym = Symbol('test');
      const doc = {
        '@id': 'test:1',
        symProp: sym as any,
      };
      const quadsList = client.jsonLdToQuads(doc);
      expect(quadsList[0].object.termType).toBe('Literal');
      expect(quadsList[0].object.value).toBe(String(sym));
    });

    it('handles arrays of primitive values', () => {
      const doc = {
        '@id': 'test:1',
        aliases: ['A', 'B']
      };
      const quadsList = client.jsonLdToQuads(doc);
      expect(quadsList.length).toBe(2);
      expect(quadsList.map(q => q.object.value)).toEqual(['A', 'B']);
    });

    it('generates a blank node subject when @id is missing', () => {
      const doc = { '@type': 'Person', name: 'No Name' };
      const quads = client.jsonLdToQuads(doc);
      expect(quads[0].subject.termType).toBe('BlankNode');
      expect(quads[0].subject.value.startsWith('_:')).toBe(true);
    });

    it('preserves http/https prefixes in @type and predicates', () => {
      const doc = {
        '@id': 'http://example.com/me',
        '@type': 'http://example.com/MyType',
        'http://example.com/myProp': 'Value'
      };
      const quads = client.jsonLdToQuads(doc);
      const typeQuad = quads.find(q => q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      expect(typeQuad?.object.value).toBe('http://example.com/MyType');
      
      const propQuad = quads.find(q => q.predicate.value === 'http://example.com/myProp');
      expect(propQuad).toBeDefined();
    });

    it('ignores empty objects and creates quads for nested objects without @id resulting in blank nodes', () => {
      const doc = {
        '@id': 'parent',
        empty: {}, // will be ignored
        nested: { name: 'Nested' } // should generate blank node
      };
      const quads = client.jsonLdToQuads(doc);
      const nestedLink = quads.find(q => q.predicate.value === 'https://schema.org/nested');
      expect(nestedLink?.object.termType).toBe('BlankNode');
    });

    it('handles nested objects returning empty quads (e.g. only @context)', () => {
      const doc = {
        '@id': 'parent',
        nested: { '@context': 'http://schema.org' }
      };
      const quads = client.jsonLdToQuads(doc);
      expect(quads.find(q => q.predicate.value === 'https://schema.org/nested')).toBeUndefined();
    });

    it('maps float numbers to double datatype', () => {
      const doc = { '@id': 'p1', floatProp: 3.14 };
      const quads = client.jsonLdToQuads(doc);
      expect((quads[0].object as any).datatype.value).toBe('http://www.w3.org/2001/XMLSchema#double');
    });

    it('extracts nested objects as separate quads and links them via subject nodes', () => {
      const complexDoc = {
        '@id': 'message:1',
        '@type': 'Message',
        text: 'Semantic web is cool',
        sender: {
          '@id': 'person:sender-1',
          '@type': 'Person',
          name: 'Sender One',
        },
      };

      const quadsList = client.jsonLdToQuads(complexDoc);

      expect(quadsList.length).toBe(5);

      const linkQuad = quadsList.find(
        (q) => q.subject.value === 'message:1' && q.predicate.value === 'https://schema.org/sender'
      );
      expect(linkQuad).toBeDefined();
      expect(linkQuad?.object.value).toBe('person:sender-1');
      expect(linkQuad?.object.termType).toBe('NamedNode');
    });

    it('correctly maps typed primitive literals like booleans and numbers', () => {
      const doc = {
        '@id': 'post:1',
        '@type': 'BlogPosting',
        isPublished: true,
        wordCount: 350,
      };

      const quadsList = client.jsonLdToQuads(doc);

      const boolQuad = quadsList.find((q) => q.predicate.value === 'https://schema.org/isPublished');
      expect(boolQuad?.object.termType).toBe('Literal');
      expect(boolQuad?.object.value).toBe('true');
      expect((boolQuad?.object as any).datatype.value).toBe('http://www.w3.org/2001/XMLSchema#boolean');

      const numQuad = quadsList.find((q) => q.predicate.value === 'https://schema.org/wordCount');
      expect(numQuad?.object.termType).toBe('Literal');
      expect(numQuad?.object.value).toBe('350');
      expect((numQuad?.object as any).datatype.value).toBe('http://www.w3.org/2001/XMLSchema#integer');
    });

    it('handles multiple type assertions as an array', () => {
      const doc = {
        '@id': 'urn:sermon:1',
        '@type': ['CreativeWork', 'Sermon'],
        name: 'The Good Word',
      };

      const quadsList = client.jsonLdToQuads(doc);
      
      const typeQuads = quadsList.filter((q) => q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      expect(typeQuads.length).toBe(2);
      expect(typeQuads.map(q => q.object.value)).toContain('https://schema.org/CreativeWork');
      expect(typeQuads.map(q => q.object.value)).toContain('https://schema.org/Sermon');
    });

    it('correctly treats strings with colons and spaces as Literals, not NamedNodes', () => {
      const doc = {
        '@id': 'urn:sermon:2',
        '@type': 'Sermon',
        name: 'Title: Redemption',
        duration: 'Duration: 30 minutes',
      };

      const quadsList = client.jsonLdToQuads(doc);

      const nameQuad = quadsList.find((q) => q.predicate.value === 'https://schema.org/name');
      expect(nameQuad?.object.termType).toBe('Literal');
      expect(nameQuad?.object.value).toBe('Title: Redemption');

      const durationQuad = quadsList.find((q) => q.predicate.value === 'https://schema.org/duration');
      expect(durationQuad?.object.termType).toBe('Literal');
      expect(durationQuad?.object.value).toBe('Duration: 30 minutes');
    });
  });

  describe('quadsToJsonLd', () => {
    it('pushes to an existing array of types', () => {
      const subject = DataFactory.namedNode('urn:sermon:1');
      const typePred = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

      const testQuads = [
        DataFactory.quad(subject, typePred, DataFactory.namedNode('https://schema.org/CreativeWork')),
        DataFactory.quad(subject, typePred, DataFactory.namedNode('https://schema.org/Sermon')),
        DataFactory.quad(subject, typePred, DataFactory.namedNode('https://schema.org/VideoObject')),
      ];

      const jsonLd = client.quadsToJsonLd(testQuads);
      expect(jsonLd[0]['@type']).toEqual([
        'https://schema.org/CreativeWork',
        'https://schema.org/Sermon',
        'https://schema.org/VideoObject'
      ]);
    });

    it('maps literal values correctly (boolean, numbers)', () => {
      const subject = DataFactory.namedNode('urn:post:1');
      const testQuads = [
        DataFactory.quad(subject, DataFactory.namedNode('https://schema.org/isPublished'), DataFactory.literal('true', DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'))),
        DataFactory.quad(subject, DataFactory.namedNode('https://schema.org/wordCount'), DataFactory.literal('350', DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer'))),
        DataFactory.quad(subject, DataFactory.namedNode('https://schema.org/rating'), DataFactory.literal('4.5', DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double'))),
      ];

      const jsonLd = client.quadsToJsonLd(testQuads);
      expect(jsonLd[0].isPublished).toBe(true);
      expect(jsonLd[0].wordCount).toBe(350);
      expect(jsonLd[0].rating).toBe(4.5);
    });

    it('groups properties into arrays when multiple quads have the same predicate', () => {
      const subject = DataFactory.namedNode('urn:post:1');
      const aliasPred = DataFactory.namedNode('https://schema.org/alias');
      const testQuads = [
        DataFactory.quad(subject, aliasPred, DataFactory.literal('A')),
        DataFactory.quad(subject, aliasPred, DataFactory.literal('B')),
        DataFactory.quad(subject, aliasPred, DataFactory.literal('C')),
      ];

      const jsonLd = client.quadsToJsonLd(testQuads);
      expect(jsonLd[0].alias).toEqual(['A', 'B', 'C']);
    });

    it('resolves nested array objects correctly', () => {
      const parent = DataFactory.namedNode('urn:parent:1');
      const child1 = DataFactory.namedNode('urn:child:1');
      const child2 = DataFactory.namedNode('urn:child:2');
      const knows = DataFactory.namedNode('https://schema.org/knows');
      
      const testQuads = [
        DataFactory.quad(parent, knows, child1),
        DataFactory.quad(parent, knows, child2),
        DataFactory.quad(child1, DataFactory.namedNode('https://schema.org/name'), DataFactory.literal('C1')),
        DataFactory.quad(child2, DataFactory.namedNode('https://schema.org/name'), DataFactory.literal('C2')),
      ];

      const jsonLd = client.quadsToJsonLd(testQuads);
      expect(jsonLd.length).toBe(1);
      expect(jsonLd[0].knows).toEqual([
        { '@id': 'urn:child:1', name: 'C1' },
        { '@id': 'urn:child:2', name: 'C2' },
      ]);
    });

    it('handles predicates not starting with schema.org', () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('s1'),
          DataFactory.namedNode('http://custom.com/prop'),
          DataFactory.literal('value')
        )
      ];
      const res = client.quadsToJsonLd(quads);
      expect(res[0]['http://custom.com/prop']).toBe('value');
    });

    it('leaves child references unresolved if they are not in the dataset', () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('s1'),
          DataFactory.namedNode('https://schema.org/knows'),
          DataFactory.namedNode('missing-person')
        )
      ];
      const res = client.quadsToJsonLd(quads);
      expect(res[0].knows).toEqual({ '@id': 'missing-person' });
    });

    it('returns an empty array when given an empty list of quads (fallback for root nodes)', () => {
      const res = client.quadsToJsonLd([]);
      expect(res).toEqual([]);
    });

    it('reconstructs a nested JSON-LD document from flat RDF Quads', () => {
      const alice = DataFactory.namedNode('person:alice');
      const knows = DataFactory.namedNode('https://schema.org/knows');
      const name = DataFactory.namedNode('https://schema.org/name');
      const bob = DataFactory.namedNode('person:bob');
      const typePred = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

      const testQuads = [
        DataFactory.quad(alice, typePred, DataFactory.namedNode('https://schema.org/Person')),
        DataFactory.quad(alice, name, DataFactory.literal('Alice')),
        DataFactory.quad(alice, knows, bob),
        DataFactory.quad(bob, typePred, DataFactory.namedNode('https://schema.org/Person')),
        DataFactory.quad(bob, name, DataFactory.literal('Bob')),
      ];

      const jsonLd = client.quadsToJsonLd(testQuads);

      expect(jsonLd.length).toBe(1);
      const root = jsonLd[0];
      expect(root['@id']).toBe('person:alice');
      expect(root['name']).toBe('Alice');
      expect(root['knows']).toEqual({
        '@id': 'person:bob',
        '@type': 'https://schema.org/Person',
        name: 'Bob',
      });
    });

    it('reconstructs multiple types from flat RDF Quads into an array in JSON-LD', () => {
      const subject = DataFactory.namedNode('urn:sermon:1');
      const typePred = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      const namePred = DataFactory.namedNode('https://schema.org/name');

      const testQuads = [
        DataFactory.quad(subject, typePred, DataFactory.namedNode('https://schema.org/CreativeWork')),
        DataFactory.quad(subject, typePred, DataFactory.namedNode('https://schema.org/Sermon')),
        DataFactory.quad(subject, namePred, DataFactory.literal('The Good Word')),
      ];

      const jsonLd = client.quadsToJsonLd(testQuads);

      expect(jsonLd.length).toBe(1);
      const root = jsonLd[0];
      expect(root['@id']).toBe('urn:sermon:1');
      expect(root['@type']).toEqual([
        'https://schema.org/CreativeWork',
        'https://schema.org/Sermon',
      ]);
      expect(root['name']).toBe('The Good Word');
    });
  });

  describe('match', () => {
    it('reconstructs NamedNode and BlankNode objects correctly (and handles empty match conditions)', async () => {
      const dbRecords = [
        {
          id: 1,
          subject: 'person:alice',
          subjectTermType: 'NamedNode',
          predicate: 'https://schema.org/knows',
          objectValue: 'person:bob',
          objectTermType: 'NamedNode',
          graph: 'http://graph.com',
          graphTermType: 'NamedNode',
        },
        {
          id: 2,
          subject: '_:b1',
          subjectTermType: 'BlankNode',
          predicate: 'https://schema.org/knows',
          objectValue: '_:b2',
          objectTermType: 'BlankNode',
          graph: '_:g1',
          graphTermType: 'BlankNode',
        }
      ];

      mockedDb._mockFrom.mockImplementationOnce(() => {
        const p = Promise.resolve(dbRecords);
        (p as any).where = mockedDb._mockWhereSelect;
        return p;
      });

      const matchedQuads = await client.match(); // No filters
      expect(matchedQuads.length).toBe(2);
      expect(matchedQuads[0].object.termType).toBe('NamedNode');
      expect(matchedQuads[0].graph.termType).toBe('NamedNode');
      expect(matchedQuads[1].object.termType).toBe('BlankNode');
      expect(matchedQuads[1].graph.termType).toBe('BlankNode');
    });

    it('queries the SQLite table filtering by subject and predicate, reconstructing RDF.js terms', async () => {
      const dbRecords = [
        {
          id: 1,
          subject: 'person:alice',
          subjectTermType: 'NamedNode',
          predicate: 'https://schema.org/name',
          objectValue: 'Alice Cooper',
          objectTermType: 'Literal',
          objectDatatype: 'http://www.w3.org/2001/XMLSchema#string',
          objectLanguage: null,
          graph: '',
          graphTermType: 'DefaultGraph',
        },
      ];

      mockedDb._mockWhereSelect.mockResolvedValueOnce(dbRecords);

      const subjectFilter = DataFactory.namedNode('person:alice');
      const predicateFilter = DataFactory.namedNode('https://schema.org/name');

      const matchedQuads = await client.match(subjectFilter, predicateFilter);

      expect(matchedQuads.length).toBe(1);
      const matched = matchedQuads[0];
      expect(matched.subject.termType).toBe('NamedNode');
      expect(matched.subject.value).toBe('person:alice');
      expect(matched.predicate.value).toBe('https://schema.org/name');
      expect(matched.object.termType).toBe('Literal');
      expect(matched.object.value).toBe('Alice Cooper');
    });

    it('applies exact termType filters to the SQLite query conditions', async () => {
      mockedDb._mockWhereSelect.mockResolvedValueOnce([]);

      const subjectFilter = DataFactory.blankNode('_:b1');
      const predicateFilter = DataFactory.namedNode('https://schema.org/knows');
      const objectFilter = DataFactory.namedNode('person:bob');
      const graphFilter = DataFactory.namedNode('https://schema.org/MyGraph');

      await client.match(subjectFilter, predicateFilter, objectFilter, graphFilter);

      expect(mockedDb._mockSelect).toHaveBeenCalled();
      expect(mockedDb._mockFrom).toHaveBeenCalled();
      expect(mockedDb._mockWhereSelect).toHaveBeenCalled();
    });
  });

  describe('addQuads', () => {
    it('skips duplicate quads', async () => {
      const quad = DataFactory.quad(
        DataFactory.namedNode('person:alice'),
        DataFactory.namedNode('https://schema.org/name'),
        DataFactory.literal('Alice')
      );
      mockedDb._mockWhereSelect.mockResolvedValueOnce([
        {
          id: 1,
          subject: 'person:alice',
          subjectTermType: 'NamedNode',
          predicate: 'https://schema.org/name',
          objectValue: 'Alice',
          objectTermType: 'Literal',
          graph: '',
          graphTermType: 'DefaultGraph',
        }
      ]);

      await client.addQuads([quad]);

      expect(mockedDb._mockInsert).not.toHaveBeenCalled();
    });

    it('writes non-duplicate quads locally and schedules a sync queue job', async () => {
      mockedDb._mockWhereSelect.mockResolvedValueOnce([]);

      const quad = DataFactory.quad(
        DataFactory.namedNode('person:alice'),
        DataFactory.namedNode('https://schema.org/name'),
        DataFactory.literal('Alice')
      );

      await client.addQuads([quad]);

      expect(mockedDb._mockInsert).toHaveBeenCalled();
      expect(mockedDb._mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'person:alice',
          predicate: 'https://schema.org/name',
          objectValue: 'Alice',
        })
      );

      expect(mockQueueJob).toHaveBeenCalledWith({
        jobType: 'RDF_ADD_QUAD',
        payload: JSON.stringify(quad),
        entityId: 'person:alice',
      });
    });

    it('handles inserting quads with NamedNode objects and Literals with language', async () => {
      mockedDb._mockWhereSelect.mockResolvedValue([]);
      const quad1 = DataFactory.quad(
        DataFactory.namedNode('person:1'),
        DataFactory.namedNode('https://schema.org/knows'),
        DataFactory.namedNode('person:2')
      );
      const quad2 = DataFactory.quad(
        DataFactory.namedNode('person:1'),
        DataFactory.namedNode('https://schema.org/name'),
        DataFactory.literal('Bonjour', 'fr')
      );
      await client.addQuads([quad1, quad2]);
      expect(mockedDb._mockValues).toHaveBeenCalledWith(expect.objectContaining({ objectTermType: 'NamedNode', objectDatatype: null, objectLanguage: null }));
      expect(mockedDb._mockValues).toHaveBeenCalledWith(expect.objectContaining({ objectTermType: 'Literal', objectLanguage: 'fr' }));
    });
  });

  describe('removeQuads', () => {
    it('removes quads from local storage and schedules deletion sync jobs', async () => {
      const quad = DataFactory.quad(
        DataFactory.namedNode('person:alice'),
        DataFactory.namedNode('https://schema.org/name'),
        DataFactory.literal('Alice')
      );

      await client.removeQuads([quad]);

      expect(mockedDb._mockDelete).toHaveBeenCalled();
      expect(mockQueueJob).toHaveBeenCalledWith({
        jobType: 'RDF_REMOVE_QUAD',
        payload: JSON.stringify(quad),
        entityId: 'person:alice',
      });
    });
  });
});

describe('VKGRdfSyncEngine Concrete Dispatcher', () => {
  let engine: VKGRdfSyncEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new VKGRdfSyncEngine();
  });

  it('throws an error if upsert fails', async () => {
    const quad = DataFactory.quad(
      DataFactory.namedNode('person:123'),
      DataFactory.namedNode('https://schema.org/name'),
      DataFactory.literal('Sync User')
    );

    mockedSupabase._mockUpsert.mockResolvedValueOnce({ error: { message: 'Network Error' } });

    await expect((engine as any).dispatchJob({
      jobType: 'RDF_ADD_QUAD',
      payload: JSON.stringify(quad),
      entityId: 'person:123',
    })).rejects.toThrow('Supabase RDF sync failed for quad: Network Error');
  });

  it('throws an error if delete fails', async () => {
    const quad = DataFactory.quad(
      DataFactory.namedNode('person:123'),
      DataFactory.namedNode('https://schema.org/name'),
      DataFactory.literal('Sync User')
    );

    mockedSupabase._mockEqDelete.mockImplementation(() => {
      const p = Promise.resolve({ error: { message: 'Delete Error' } });
      (p as any).eq = mockedSupabase._mockEqDelete;
      return p;
    });

    await expect((engine as any).dispatchJob({
      jobType: 'RDF_REMOVE_QUAD',
      payload: JSON.stringify(quad),
      entityId: 'person:123',
    })).rejects.toThrow('Supabase RDF sync deletion failed: Delete Error');
  });

  it('throws an error for unrecognized job types', async () => {
    await expect((engine as any).dispatchJob({
      jobType: 'UNKNOWN_JOB',
      payload: JSON.stringify({}),
      entityId: null,
    })).rejects.toThrow('Unrecognized RDF sync job type: UNKNOWN_JOB');
  });

  it('performs upsert on RDF_ADD_QUAD', async () => {
    const quad = DataFactory.quad(
      DataFactory.namedNode('person:123'),
      DataFactory.namedNode('https://schema.org/name'),
      DataFactory.literal('Sync User')
    );

    mockedSupabase._mockUpsert.mockResolvedValueOnce({ error: null });

    await (engine as any).dispatchJob({
      jobType: 'RDF_ADD_QUAD',
      payload: JSON.stringify(quad),
      entityId: 'person:123',
    });

    expect(mockedSupabase._mockFrom).toHaveBeenCalledWith('rdf_quads_ld');
    expect(mockedSupabase._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'person:123',
        predicate: 'https://schema.org/name',
        object_value: 'Sync User',
      })
    );
  });

  it('performs upsert on RDF_ADD_QUAD with missing datatype and language', async () => {
    const rawQuad = {
      subject: { termType: 'NamedNode', value: 'person:123' },
      predicate: { termType: 'NamedNode', value: 'https://schema.org/name' },
      object: { termType: 'Literal', value: 'Sync User' },
      graph: { termType: 'DefaultGraph', value: '' }
    };
    mockedSupabase._mockUpsert.mockResolvedValueOnce({ error: null });
    await (engine as any).dispatchJob({
      jobType: 'RDF_ADD_QUAD',
      payload: JSON.stringify(rawQuad),
      entityId: 'person:123',
    });
    expect(mockedSupabase._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        object_datatype: null,
        object_language: null
      })
    );
  });

  it('performs delete on RDF_REMOVE_QUAD', async () => {
    const quad = DataFactory.quad(
      DataFactory.namedNode('person:123'),
      DataFactory.namedNode('https://schema.org/name'),
      DataFactory.literal('Sync User')
    );
    
    mockedSupabase._mockEqDelete.mockImplementation(() => {
      const p = Promise.resolve({ error: null });
      (p as any).eq = mockedSupabase._mockEqDelete;
      return p;
    });

    await (engine as any).dispatchJob({
      jobType: 'RDF_REMOVE_QUAD',
      payload: JSON.stringify(quad),
      entityId: 'person:123',
    });

    expect(mockedSupabase._mockFrom).toHaveBeenCalledWith('rdf_quads_ld');
    expect(mockedSupabase._mockDelete).toHaveBeenCalled();
    expect(mockedSupabase._mockEqDelete).toHaveBeenCalledWith('subject', 'person:123');
  });
});
