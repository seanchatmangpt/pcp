import {
  Term,
  NamedNode,
  BlankNode,
  Literal,
  Variable,
  DefaultGraph,
  Quad,
  DataFactory,
} from '@/src/lib/vkg/rdf';

export { Term, NamedNode, BlankNode, Literal, Variable, DefaultGraph, Quad, DataFactory };

/**
 * DX Utility: Conveniently create an RDF Quad from raw string values.
 * Infers term types (e.g. BlankNode if starting with `_:`, Literal otherwise).
 */
export function createQuadFromStrings(
  subject: string,
  predicate: string,
  object: string,
  graph?: string
): Quad {
  const s = subject.startsWith('_:')
    ? DataFactory.blankNode(subject)
    : DataFactory.namedNode(subject);
  const p = DataFactory.namedNode(predicate);

  let o: Term;
  if (object.startsWith('http://') || object.startsWith('https://')) {
    o = DataFactory.namedNode(object);
  } else if (object.startsWith('_:')) {
    o = DataFactory.blankNode(object);
  } else {
    o = DataFactory.literal(object);
  }

  const g = graph ? DataFactory.namedNode(graph) : DataFactory.defaultGraph();
  return DataFactory.quad(s, p, o, g);
}
