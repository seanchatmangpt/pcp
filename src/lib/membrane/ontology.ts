export interface SemanticTerm {
  subject: string;
  predicate: string;
  object: string;
}

export class Ontology {
  private static publicVocabularies = [
    'http://schema.org',
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'http://www.w3.org/ns/prov',
    'http://www.w3.org/ns/odrl',
    'http://www.w3.org/ns/activitystreams',
    'urn:zoe:'
  ];

  /**
   * Check if a predicate URI starts with an approved public vocabulary prefix
   */
  static isPredicateValid(predicate: string): boolean {
    return this.publicVocabularies.some(vocab => predicate.startsWith(vocab));
  }

  /**
   * Verify that semantic mappings preserve base properties after migration
   */
  static verifyOntologyDrift(
    v1: Record<string, string>,
    v2: Record<string, string>,
    mappingRules: Record<string, string>
  ): { stable: boolean; driftDetails?: string } {
    for (const key of Object.keys(v1)) {
      const v2Key = mappingRules[key] || key;
      if (!v2[v2Key] || v2[v2Key] !== v1[key]) {
        return {
          stable: false,
          driftDetails: `Missing or drifted predicate mapping for key '${key}'. Expected equivalent value '${v1[key]}'.`
        };
      }
    }
    return { stable: true };
  }
}
