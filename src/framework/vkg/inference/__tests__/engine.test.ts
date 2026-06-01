import { LocalInferenceEngine } from '../engine';
import { DataFactory } from '../../rdf';
import { createTransitivityRule, createSymmetryRule } from '../index';

describe('LocalInferenceEngine', () => {
  const p = DataFactory.namedNode('http://example.org/parentOf');
  const gp = DataFactory.namedNode('http://example.org/grandparentOf');
  const alice = DataFactory.namedNode('http://example.org/Alice');
  const bob = DataFactory.namedNode('http://example.org/Bob');
  const charlie = DataFactory.namedNode('http://example.org/Charlie');

  it('infers transitive relationships', () => {
    const engine = new LocalInferenceEngine([
      createTransitivityRule('grandparentRule', p.value, gp.value),
    ]);

    const initialQuads = [DataFactory.quad(alice, p, bob), DataFactory.quad(bob, p, charlie)];

    const result = engine.infer(initialQuads);

    expect(result.inferredQuads).toHaveLength(1);
    expect(result.inferredQuads[0].subject.equals(alice)).toBe(true);
    expect(result.inferredQuads[0].predicate.equals(gp)).toBe(true);
    expect(result.inferredQuads[0].object.equals(charlie)).toBe(true);
    expect(result.iterations).toBe(2);
    expect(result.ruleStats['grandparentRule']).toBe(1);
  });

  it('infers symmetric relationships', () => {
    const friendOf = DataFactory.namedNode('http://example.org/friendOf');
    const engine = new LocalInferenceEngine([createSymmetryRule('symmetryRule', friendOf.value)]);

    const initialQuads = [DataFactory.quad(alice, friendOf, bob)];

    const result = engine.infer(initialQuads);

    expect(result.inferredQuads).toHaveLength(1);
    expect(result.inferredQuads[0].subject.equals(bob)).toBe(true);
    expect(result.inferredQuads[0].predicate.equals(friendOf)).toBe(true);
    expect(result.inferredQuads[0].object.equals(alice)).toBe(true);
  });

  it('stops when no new quads are inferred', () => {
    const engine = new LocalInferenceEngine([
      createSymmetryRule('symmetryRule', 'http://example.org/friendOf'),
    ]);

    const initialQuads = [
      DataFactory.quad(alice, DataFactory.namedNode('http://example.org/friendOf'), bob),
      DataFactory.quad(bob, DataFactory.namedNode('http://example.org/friendOf'), alice),
    ];

    const result = engine.infer(initialQuads);
    expect(result.inferredQuads).toHaveLength(0);
    expect(result.iterations).toBe(1);
  });

  it('handles multiple rules and iterations', () => {
    const engine = new LocalInferenceEngine([
      createSymmetryRule('symmetry', 'http://example.org/marriedTo'),
      createTransitivityRule(
        'ancestor',
        'http://example.org/childOf',
        'http://example.org/ancestorOf'
      ),
    ]);

    const marriedTo = DataFactory.namedNode('http://example.org/marriedTo');
    const childOf = DataFactory.namedNode('http://example.org/childOf');
    const ancestorOf = DataFactory.namedNode('http://example.org/ancestorOf');

    const quads = [
      DataFactory.quad(alice, marriedTo, bob),
      DataFactory.quad(charlie, childOf, bob),
      DataFactory.quad(bob, childOf, alice), // This doesn't make sense biologically but good for test
    ];

    const result = engine.infer(quads);
    expect(result.ruleStats['symmetry']).toBe(1);
    expect(result.ruleStats['ancestor']).toBeGreaterThanOrEqual(1);
  });

  it('respects maxIterations', () => {
    const engine = new LocalInferenceEngine([
      createSymmetryRule('symmetry', 'http://example.org/friendOf'),
    ]);
    const initialQuads = [
      DataFactory.quad(alice, DataFactory.namedNode('http://example.org/friendOf'), bob),
    ];

    const result = engine.infer(initialQuads, 0);
    expect(result.iterations).toBe(0);
    expect(result.inferredQuads).toHaveLength(0);
  });

  it('throws error for unbound variable in rule head', () => {
    const engine = new LocalInferenceEngine([
      {
        name: 'brokenRule',
        body: [],
        head: {
          subject: DataFactory.variable('unbound'),
          predicate: DataFactory.namedNode('http://p'),
          object: DataFactory.namedNode('http://o'),
        },
      },
    ]);

    expect(() => engine.infer([DataFactory.quad(alice, p, bob)])).toThrow(
      'Unbound variable in rule head: unbound'
    );
  });
});
