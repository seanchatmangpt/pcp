/**
 * @fileoverview Implementation of the W3C/RDF.js Data Model Specification.
 * Ref: https://rdf.js.org/data-model-spec/
 * Provides zero-dependency semantic web terms and quad structures.
 */

export interface Term {
  readonly termType: string;
  readonly value: string;
  equals(other: Term | null | undefined): boolean;
}

export class NamedNode implements Term {
  readonly termType = 'NamedNode';

  constructor(readonly value: string) {}

  equals(other: Term | null | undefined): boolean {
    return !!other && other.termType === 'NamedNode' && other.value === this.value;
  }
}

export class BlankNode implements Term {
  readonly termType = 'BlankNode';

  constructor(readonly value: string) {}

  equals(other: Term | null | undefined): boolean {
    return !!other && other.termType === 'BlankNode' && other.value === this.value;
  }
}

export class Literal implements Term {
  readonly termType = 'Literal';
  readonly language: string;
  readonly datatype: NamedNode;

  constructor(readonly value: string, languageOrDatatype?: string | NamedNode) {
    if (typeof languageOrDatatype === 'string') {
      this.language = languageOrDatatype;
      this.datatype = new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    } else if (languageOrDatatype && languageOrDatatype.termType === 'NamedNode') {
      this.language = '';
      this.datatype = languageOrDatatype;
    } else {
      this.language = '';
      this.datatype = new NamedNode('http://www.w3.org/2001/XMLSchema#string');
    }
  }

  equals(other: Term | null | undefined): boolean {
    if (!other || other.termType !== 'Literal') {
      return false;
    }
    const lit = other as Literal;
    return (
      lit.value === this.value &&
      lit.language === this.language &&
      lit.datatype.equals(this.datatype)
    );
  }
}

export class Variable implements Term {
  readonly termType = 'Variable';

  constructor(readonly value: string) {}

  equals(other: Term | null | undefined): boolean {
    return !!other && other.termType === 'Variable' && other.value === this.value;
  }
}

export class DefaultGraph implements Term {
  readonly termType = 'DefaultGraph';
  readonly value = '';

  equals(other: Term | null | undefined): boolean {
    return !!other && other.termType === 'DefaultGraph';
  }
}

export class Quad {
  constructor(
    readonly subject: Term,
    readonly predicate: Term,
    readonly object: Term,
    readonly graph: Term = new DefaultGraph()
  ) {}

  equals(other: Quad | null | undefined): boolean {
    return (
      !!other &&
      this.subject.equals(other.subject) &&
      this.predicate.equals(other.predicate) &&
      this.object.equals(other.object) &&
      this.graph.equals(other.graph)
    );
  }
}

/**
 * Standard RDF.js DataFactory implementation.
 */
export const DataFactory = {
  namedNode(value: string): NamedNode {
    return new NamedNode(value);
  },

  blankNode(value?: string): BlankNode {
    const id = value || `b_${Math.random().toString(36).substring(2, 11)}`;
    return new BlankNode(id);
  },

  literal(value: string, languageOrDatatype?: string | NamedNode): Literal {
    return new Literal(value, languageOrDatatype);
  },

  variable(value: string): Variable {
    return new Variable(value);
  },

  defaultGraph(): DefaultGraph {
    return new DefaultGraph();
  },

  quad(subject: Term, predicate: Term, object: Term, graph?: Term): Quad {
    return new Quad(subject, predicate, object, graph || new DefaultGraph());
  },
};
