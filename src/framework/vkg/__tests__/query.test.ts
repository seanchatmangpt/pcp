import { RdfQueryBuilder } from '../query';
import { DataFactory } from '../rdf';

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

describe('RdfQueryBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds and executes a query', async () => {
    const builder = new RdfQueryBuilder(mockClient);
    mockMatch.mockResolvedValue([]);

    await builder
      .subject('http://example.com/s')
      .predicate('http://example.com/p')
      .object('http://example.com/o')
      .graph('http://example.com/g')
      .execute();

    expect(mockMatch).toHaveBeenCalledWith(
      DataFactory.namedNode('http://example.com/s'),
      DataFactory.namedNode('http://example.com/p'),
      DataFactory.namedNode('http://example.com/o'),
      DataFactory.namedNode('http://example.com/g')
    );
  });

  it('handles Term objects as well as strings', async () => {
    const builder = new RdfQueryBuilder(mockClient);
    mockMatch.mockResolvedValue([]);

    const s = DataFactory.namedNode('http://example.com/s');
    const p = DataFactory.namedNode('http://example.com/p');
    const o = DataFactory.literal('literal');
    const g = DataFactory.namedNode('http://example.com/g');

    await builder.subject(s).predicate(p).object(o).graph(g).execute();

    expect(mockMatch).toHaveBeenCalledWith(s, p, o, g);
  });

  it('handles blank nodes and literals in object string', async () => {
    const builder = new RdfQueryBuilder(mockClient);
    mockMatch.mockResolvedValue([]);

    await builder.object('_:b1').execute();
    expect(mockMatch).toHaveBeenCalledWith(
      undefined,
      undefined,
      DataFactory.blankNode('_:b1'),
      undefined
    );

    await builder.object('some literal').execute();
    expect(mockMatch).toHaveBeenCalledWith(
      undefined,
      undefined,
      DataFactory.literal('some literal'),
      undefined
    );
  });

  it('traverses relations', async () => {
    const builder = new RdfQueryBuilder(mockClient);

    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );

    mockMatch.mockResolvedValue([q]);

    const res = await builder.traverse('http://s', 'http://p');

    expect(mockMatch).toHaveBeenCalledWith(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      undefined,
      undefined
    );

    expect(res).toEqual([DataFactory.namedNode('http://o')]);
  });
});
