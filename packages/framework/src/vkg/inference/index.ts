export * from './types';
export * from './engine';
export * from './hook';

import { DataFactory } from '../rdf';
import { InferenceRule } from './types';

/**
 * DX Factory: Create a simple transitivity rule.
 * Example: parentOf(A, B) && parentOf(B, C) => grandparentOf(A, C)
 */
export function createTransitivityRule(
  name: string,
  predicate: string,
  inferredPredicate: string
): InferenceRule {
  return {
    name,
    body: [
      {
        subject: DataFactory.variable('a'),
        predicate: DataFactory.namedNode(predicate),
        object: DataFactory.variable('b'),
      },
      {
        subject: DataFactory.variable('b'),
        predicate: DataFactory.namedNode(predicate),
        object: DataFactory.variable('c'),
      },
    ],
    head: {
      subject: DataFactory.variable('a'),
      predicate: DataFactory.namedNode(inferredPredicate),
      object: DataFactory.variable('c'),
    },
  };
}

/**
 * DX Factory: Create a simple symmetry rule.
 * Example: friendOf(A, B) => friendOf(B, A)
 */
export function createSymmetryRule(name: string, predicate: string): InferenceRule {
  return {
    name,
    body: [
      {
        subject: DataFactory.variable('a'),
        predicate: DataFactory.namedNode(predicate),
        object: DataFactory.variable('b'),
      },
    ],
    head: {
      subject: DataFactory.variable('b'),
      predicate: DataFactory.namedNode(predicate),
      object: DataFactory.variable('a'),
    },
  };
}
