import {
  NamedNode,
  BlankNode,
  Literal,
  Variable,
  DefaultGraph,
  Quad,
  DataFactory,
} from '../rdf';

describe('RDF.js Data Model', () => {
  describe('NamedNode', () => {
    it('should create with value and have correct termType', () => {
      const node = new NamedNode('http://example.org');
      expect(node.termType).toBe('NamedNode');
      expect(node.value).toBe('http://example.org');
    });

    it('equals() should work correctly', () => {
      const node1 = new NamedNode('http://example.org');
      const node2 = new NamedNode('http://example.org');
      const node3 = new NamedNode('http://other.org');
      const otherNode = new BlankNode('http://example.org');

      expect(node1.equals(node2)).toBe(true);
      expect(node1.equals(node3)).toBe(false);
      expect(node1.equals(otherNode as any)).toBe(false);
      expect(node1.equals(null)).toBe(false);
      expect(node1.equals(undefined)).toBe(false);
    });
  });

  describe('BlankNode', () => {
    it('should create with value and have correct termType', () => {
      const node = new BlankNode('b1');
      expect(node.termType).toBe('BlankNode');
      expect(node.value).toBe('b1');
    });

    it('equals() should work correctly', () => {
      const node1 = new BlankNode('b1');
      const node2 = new BlankNode('b1');
      const node3 = new BlankNode('b2');
      const otherNode = new NamedNode('b1');

      expect(node1.equals(node2)).toBe(true);
      expect(node1.equals(node3)).toBe(false);
      expect(node1.equals(otherNode as any)).toBe(false);
      expect(node1.equals(null)).toBe(false);
      expect(node1.equals(undefined)).toBe(false);
    });
  });

  describe('Literal', () => {
    it('should create with string only (xsd:string datatype)', () => {
      const lit = new Literal('hello');
      expect(lit.termType).toBe('Literal');
      expect(lit.value).toBe('hello');
      expect(lit.language).toBe('');
      expect(lit.datatype.termType).toBe('NamedNode');
      expect(lit.datatype.value).toBe('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should create with string and language (rdf:langString datatype)', () => {
      const lit = new Literal('hello', 'en');
      expect(lit.language).toBe('en');
      expect(lit.datatype.value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    });

    it('should create with string and datatype', () => {
      const dt = new NamedNode('http://example.org/dt');
      const lit = new Literal('hello', dt);
      expect(lit.language).toBe('');
      expect(lit.datatype.equals(dt)).toBe(true);
    });

    it('equals() should work correctly', () => {
      const lit1 = new Literal('hello');
      const lit2 = new Literal('hello');
      const lit3 = new Literal('world');
      const litLang1 = new Literal('hello', 'en');
      const litLang2 = new Literal('hello', 'en');
      const litLang3 = new Literal('hello', 'fr');
      
      const dt1 = new NamedNode('http://example.org/dt');
      const dt2 = new NamedNode('http://example.org/dt2');
      const litDt1 = new Literal('hello', dt1);
      const litDt2 = new Literal('hello', dt1);
      const litDt3 = new Literal('hello', dt2);

      const otherNode = new NamedNode('hello');

      // Value diff
      expect(lit1.equals(lit2)).toBe(true);
      expect(lit1.equals(lit3)).toBe(false);

      // Language diff
      expect(litLang1.equals(litLang2)).toBe(true);
      expect(litLang1.equals(litLang3)).toBe(false);
      expect(lit1.equals(litLang1)).toBe(false); // different datatype and language

      // Datatype diff
      expect(litDt1.equals(litDt2)).toBe(true);
      expect(litDt1.equals(litDt3)).toBe(false);
      expect(lit1.equals(litDt1)).toBe(false);

      // Other tests
      expect(lit1.equals(otherNode as any)).toBe(false);
      expect(lit1.equals(null)).toBe(false);
      expect(lit1.equals(undefined)).toBe(false);
    });
  });

  describe('Variable', () => {
    it('should create with value and have correct termType', () => {
      const v = new Variable('x');
      expect(v.termType).toBe('Variable');
      expect(v.value).toBe('x');
    });

    it('equals() should work correctly', () => {
      const v1 = new Variable('x');
      const v2 = new Variable('x');
      const v3 = new Variable('y');
      const otherNode = new NamedNode('x');

      expect(v1.equals(v2)).toBe(true);
      expect(v1.equals(v3)).toBe(false);
      expect(v1.equals(otherNode as any)).toBe(false);
      expect(v1.equals(null)).toBe(false);
      expect(v1.equals(undefined)).toBe(false);
    });
  });

  describe('DefaultGraph', () => {
    it('should create with correct termType and empty value', () => {
      const dg = new DefaultGraph();
      expect(dg.termType).toBe('DefaultGraph');
      expect(dg.value).toBe('');
    });

    it('equals() should work correctly', () => {
      const dg1 = new DefaultGraph();
      const dg2 = new DefaultGraph();
      const otherNode = new NamedNode('');

      expect(dg1.equals(dg2)).toBe(true);
      expect(dg1.equals(otherNode as any)).toBe(false);
      expect(dg1.equals(null)).toBe(false);
      expect(dg1.equals(undefined)).toBe(false);
    });
  });

  describe('Quad', () => {
    it('should create with s, p, o and default graph', () => {
      const s = new NamedNode('s');
      const p = new NamedNode('p');
      const o = new NamedNode('o');
      const q = new Quad(s, p, o);

      expect(q.subject.equals(s)).toBe(true);
      expect(q.predicate.equals(p)).toBe(true);
      expect(q.object.equals(o)).toBe(true);
      expect(q.graph.termType).toBe('DefaultGraph');
    });

    it('should create with s, p, o, g', () => {
      const s = new NamedNode('s');
      const p = new NamedNode('p');
      const o = new NamedNode('o');
      const g = new NamedNode('g');
      const q = new Quad(s, p, o, g);

      expect(q.graph.equals(g)).toBe(true);
    });

    it('equals() should work correctly', () => {
      const s1 = new NamedNode('s1');
      const p1 = new NamedNode('p1');
      const o1 = new NamedNode('o1');
      const g1 = new NamedNode('g1');

      const s2 = new NamedNode('s2');
      const p2 = new NamedNode('p2');
      const o2 = new NamedNode('o2');
      const g2 = new NamedNode('g2');

      const q1 = new Quad(s1, p1, o1, g1);
      const q2 = new Quad(s1, p1, o1, g1);
      const qDiffS = new Quad(s2, p1, o1, g1);
      const qDiffP = new Quad(s1, p2, o1, g1);
      const qDiffO = new Quad(s1, p1, o2, g1);
      const qDiffG = new Quad(s1, p1, o1, g2);
      
      expect(q1.equals(q2)).toBe(true);
      expect(q1.equals(qDiffS)).toBe(false);
      expect(q1.equals(qDiffP)).toBe(false);
      expect(q1.equals(qDiffO)).toBe(false);
      expect(q1.equals(qDiffG)).toBe(false);
      
      expect(q1.equals(null)).toBe(false);
      expect(q1.equals(undefined)).toBe(false);
    });
  });

  describe('DataFactory', () => {
    it('should create namedNode', () => {
      const n = DataFactory.namedNode('http://example.org');
      expect(n).toBeInstanceOf(NamedNode);
      expect(n.value).toBe('http://example.org');
    });

    it('should create blankNode with specific id', () => {
      const b = DataFactory.blankNode('b1');
      expect(b).toBeInstanceOf(BlankNode);
      expect(b.value).toBe('b1');
    });

    it('should create blankNode with auto-generated id', () => {
      const b1 = DataFactory.blankNode();
      const b2 = DataFactory.blankNode();
      expect(b1).toBeInstanceOf(BlankNode);
      expect(b1.value.startsWith('b_')).toBe(true);
      expect(b2.value.startsWith('b_')).toBe(true);
      expect(b1.value).not.toBe(b2.value); // Extremely unlikely to be same
    });

    it('should create literal with string', () => {
      const l = DataFactory.literal('hello');
      expect(l).toBeInstanceOf(Literal);
      expect(l.value).toBe('hello');
      expect(l.language).toBe('');
      expect(l.datatype.value).toBe('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should create literal with string and language', () => {
      const l = DataFactory.literal('hello', 'en');
      expect(l).toBeInstanceOf(Literal);
      expect(l.language).toBe('en');
    });

    it('should create literal with string and datatype', () => {
      const dt = DataFactory.namedNode('http://example.org/dt');
      const l = DataFactory.literal('hello', dt);
      expect(l).toBeInstanceOf(Literal);
      expect(l.datatype.equals(dt)).toBe(true);
    });

    it('should create variable', () => {
      const v = DataFactory.variable('x');
      expect(v).toBeInstanceOf(Variable);
      expect(v.value).toBe('x');
    });

    it('should create defaultGraph', () => {
      const dg = DataFactory.defaultGraph();
      expect(dg).toBeInstanceOf(DefaultGraph);
    });

    it('should create quad with default graph', () => {
      const s = DataFactory.namedNode('s');
      const p = DataFactory.namedNode('p');
      const o = DataFactory.namedNode('o');
      const q = DataFactory.quad(s, p, o);

      expect(q).toBeInstanceOf(Quad);
      expect(q.subject).toBe(s);
      expect(q.predicate).toBe(p);
      expect(q.object).toBe(o);
      expect(q.graph).toBeInstanceOf(DefaultGraph);
    });

    it('should create quad with specific graph', () => {
      const s = DataFactory.namedNode('s');
      const p = DataFactory.namedNode('p');
      const o = DataFactory.namedNode('o');
      const g = DataFactory.namedNode('g');
      const q = DataFactory.quad(s, p, o, g);

      expect(q.graph).toBe(g);
    });
  });
});
