import { VKGClientFacade, VirtualKnowledgeGraphClient } from '../client';
import { DataFactory } from '../rdf';

const mockMatch = jest.fn().mockResolvedValue([]);
const mockAddQuads = jest.fn().mockResolvedValue(undefined);
const mockRemoveQuads = jest.fn().mockResolvedValue(undefined);
const mockJsonLdToQuads = jest.fn().mockReturnValue([{ subject: 'mock' }]);
const mockQuadsToJsonLd = jest.fn().mockReturnValue([{ '@id': 'mock' }]);
const mockGetSyncEngine = jest.fn().mockReturnValue({ isSyncEngine: true });

jest.mock('../../../lib/vkg/client', () => {
  return {
    VirtualKnowledgeGraphClient: jest.fn().mockImplementation(() => {
      return {
        match: mockMatch,
        addQuads: mockAddQuads,
        removeQuads: mockRemoveQuads,
        jsonLdToQuads: mockJsonLdToQuads,
        quadsToJsonLd: mockQuadsToJsonLd,
        getSyncEngine: mockGetSyncEngine,
      };
    }),
  };
});

describe('VKG Framework - Client Facade', () => {
  let client: VKGClientFacade;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new VKGClientFacade();
  });

  it('delegates match() to base client', async () => {
    const s = DataFactory.namedNode('s');
    await client.match(s);
    expect(mockMatch).toHaveBeenCalledWith(s, undefined, undefined, undefined);
  });

  it('delegates addQuads() to base client', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('s'),
      DataFactory.namedNode('p'),
      DataFactory.namedNode('o')
    );
    await client.addQuads([q]);
    expect(mockAddQuads).toHaveBeenCalledWith([q]);
  });

  it('delegates removeQuads() to base client', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('s'),
      DataFactory.namedNode('p'),
      DataFactory.namedNode('o')
    );
    await client.removeQuads([q]);
    expect(mockRemoveQuads).toHaveBeenCalledWith([q]);
  });

  it('delegates jsonLdToQuads() to base client', () => {
    const res = client.jsonLdToQuads({ '@id': 'doc' });
    expect(mockJsonLdToQuads).toHaveBeenCalledWith({ '@id': 'doc' }, undefined);
    expect(res).toEqual([{ subject: 'mock' }]);
  });

  it('delegates quadsToJsonLd() to base client', () => {
    const res = client.quadsToJsonLd([]);
    expect(mockQuadsToJsonLd).toHaveBeenCalledWith([]);
    expect(res).toEqual([{ '@id': 'mock' }]);
  });

  it('delegates getSyncEngine() to base client', () => {
    const res = client.getSyncEngine();
    expect(mockGetSyncEngine).toHaveBeenCalled();
    expect(res.isSyncEngine).toBe(true);
  });

  it('addJsonLd() creates quads and adds them automatically', async () => {
    await client.addJsonLd({ '@id': 'doc' });
    expect(mockJsonLdToQuads).toHaveBeenCalledWith({ '@id': 'doc' }, undefined);
    expect(mockAddQuads).toHaveBeenCalledWith([{ subject: 'mock' }]);
  });
});
