import { createQuadFromStrings, DataFactory } from '../rdf';

describe('VKG Framework - RDF DX Utilities', () => {
  it('should create an RDF Quad with NamedNodes by default if http://', () => {
    const quad = createQuadFromStrings(
      'http://example.org/subject',
      'http://example.org/predicate',
      'http://example.org/object',
      'http://example.org/graph'
    );

    expect(quad.subject.termType).toBe('NamedNode');
    expect(quad.subject.value).toBe('http://example.org/subject');

    expect(quad.predicate.termType).toBe('NamedNode');
    expect(quad.predicate.value).toBe('http://example.org/predicate');

    expect(quad.object.termType).toBe('NamedNode');
    expect(quad.object.value).toBe('http://example.org/object');

    expect(quad.graph.termType).toBe('NamedNode');
    expect(quad.graph.value).toBe('http://example.org/graph');
  });

  it('should create BlankNodes if strings start with _:', () => {
    const quad = createQuadFromStrings('_:b1', 'http://example.org/predicate', '_:b2');

    expect(quad.subject.termType).toBe('BlankNode');
    expect(quad.subject.value).toBe('_:b1');

    expect(quad.object.termType).toBe('BlankNode');
    expect(quad.object.value).toBe('_:b2');

    expect(quad.graph.termType).toBe('DefaultGraph');
  });

  it('should create Literals for normal strings in the object position', () => {
    const quad = createQuadFromStrings(
      'http://example.org/subject',
      'http://example.org/predicate',
      'hello world'
    );

    expect(quad.object.termType).toBe('Literal');
    expect(quad.object.value).toBe('hello world');
  });

  it('should re-export base DataFactory correctly', () => {
    const blank = DataFactory.blankNode('b_test');
    expect(blank.termType).toBe('BlankNode');
    expect(blank.value).toBe('b_test');
  });
});
