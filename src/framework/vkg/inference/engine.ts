import { Quad, Term, Variable, DataFactory } from '../rdf';
import { InferenceRule, InferenceResult, Substitution, TriplePattern } from './types';

/**
 * Local Graph Inference Engine.
 * Implements forward-chaining inference over RDF quads using user-defined rules.
 */
export class LocalInferenceEngine {
  private rules: InferenceRule[] = [];

  constructor(rules: InferenceRule[] = []) {
    this.rules = rules;
  }

  /**
   * Adds a new inference rule to the engine.
   */
  addRule(rule: InferenceRule): void {
    this.rules.push(rule);
  }

  /**
   * Executes the inference process over a set of quads.
   * Uses forward chaining until no more new quads are inferred or max iterations reached.
   *
   * @param initialQuads The base set of quads to run inference on.
   * @param maxIterations Maximum number of inference cycles (defaults to 5).
   * @returns InferenceResult containing inferred quads and metadata.
   */
  infer(initialQuads: Quad[], maxIterations: number = 5): InferenceResult {
    let currentQuads = [...initialQuads];
    let allInferredQuads: Quad[] = [];
    let iterations = 0;
    const ruleStats: Record<string, number> = {};

    this.rules.forEach((r) => (ruleStats[r.name] = 0));

    let changed = true;
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      const newInferredThisIteration: Quad[] = [];

      for (const rule of this.rules) {
        const substitutions = this.matchBody(rule.body, currentQuads);
        for (const sub of substitutions) {
          const inferredQuad = this.applySubstitution(rule.head, sub);

          if (
            !this.containsQuad(currentQuads, inferredQuad) &&
            !this.containsQuad(newInferredThisIteration, inferredQuad)
          ) {
            newInferredThisIteration.push(inferredQuad);
            ruleStats[rule.name]++;
            changed = true;
          }
        }
      }

      currentQuads = [...currentQuads, ...newInferredThisIteration];
      allInferredQuads = [...allInferredQuads, ...newInferredThisIteration];
    }

    return {
      inferredQuads: allInferredQuads,
      iterations,
      ruleStats,
    };
  }

  /**
   * Matches the body of a rule against the current quad store.
   */
  private matchBody(body: TriplePattern[], quads: Quad[]): Substitution[] {
    return this.matchPatterns(body, quads, [{}]);
  }

  /**
   * Recursively matches multiple patterns, building up substitutions.
   */
  private matchPatterns(
    patterns: TriplePattern[],
    quads: Quad[],
    substitutions: Substitution[]
  ): Substitution[] {
    if (patterns.length === 0) return substitutions;

    const [first, ...rest] = patterns;
    const nextSubstitutions: Substitution[] = [];

    for (const sub of substitutions) {
      for (const quad of quads) {
        const newSub = this.matchPattern(first, quad, sub);
        if (newSub) {
          nextSubstitutions.push(newSub);
        }
      }
    }

    // Optimization: Unique substitutions to prevent exponential growth if many paths lead to same binding
    const uniqueNext = this.uniqueSubstitutions(nextSubstitutions);
    return this.matchPatterns(rest, quads, uniqueNext);
  }

  /**
   * Matches a single pattern against a quad, given an existing substitution.
   */
  private matchPattern(pattern: TriplePattern, quad: Quad, sub: Substitution): Substitution | null {
    const newSub = { ...sub };

    if (!this.matchTerm(pattern.subject, quad.subject, newSub)) return null;
    if (!this.matchTerm(pattern.predicate, quad.predicate, newSub)) return null;
    if (!this.matchTerm(pattern.object, quad.object, newSub)) return null;

    if (pattern.graph) {
      if (!this.matchTerm(pattern.graph, quad.graph, newSub)) return null;
    }

    return newSub;
  }

  /**
   * Matches a pattern term against a quad term.
   */
  private matchTerm(patternTerm: Term | Variable, quadTerm: Term, sub: Substitution): boolean {
    if (patternTerm.termType === 'Variable') {
      const varName = (patternTerm as Variable).value;
      if (sub[varName]) {
        return sub[varName].equals(quadTerm);
      } else {
        sub[varName] = quadTerm;
        return true;
      }
    } else {
      return (patternTerm as Term).equals(quadTerm);
    }
  }

  /**
   * Applies a substitution to a head pattern to produce an inferred Quad.
   */
  private applySubstitution(pattern: TriplePattern, sub: Substitution): Quad {
    const s = this.resolveTerm(pattern.subject, sub);
    const p = this.resolveTerm(pattern.predicate, sub);
    const o = this.resolveTerm(pattern.object, sub);
    const g = pattern.graph ? this.resolveTerm(pattern.graph, sub) : DataFactory.defaultGraph();
    return DataFactory.quad(s, p, o, g);
  }

  /**
   * Resolves a Term or Variable to a concrete Term using the substitution.
   */
  private resolveTerm(term: Term | Variable, sub: Substitution): Term {
    if (term.termType === 'Variable') {
      const resolved = sub[(term as Variable).value];
      if (!resolved) throw new Error(`Unbound variable in rule head: ${(term as Variable).value}`);
      return resolved;
    }
    return term as Term;
  }

  /**
   * Checks if a list of quads contains a specific quad.
   */
  private containsQuad(quads: Quad[], target: Quad): boolean {
    return quads.some((q) => q.equals(target));
  }

  /**
   * Helper to ensure unique substitutions in the pipeline.
   */
  private uniqueSubstitutions(subs: Substitution[]): Substitution[] {
    const seen = new Set<string>();
    return subs.filter((s) => {
      const key = Object.entries(s)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v.termType}:${v.value}`)
        .join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
