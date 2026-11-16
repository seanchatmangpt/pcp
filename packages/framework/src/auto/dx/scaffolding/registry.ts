import { ComponentType } from 'react';

/**
 * Registry for mapping RDF types (e.g., https://schema.org/Person)
 * to their corresponding React components.
 */
class SemanticComponentRegistry {
  private registry = new Map<string, ComponentType<any>>();

  /**
   * Register a component for a specific RDF type.
   */
  register(rdfType: string, component: ComponentType<any>) {
    this.registry.set(rdfType, component);
  }

  /**
   * Resolve a component for a specific RDF type.
   */
  resolve(rdfType: string): ComponentType<any> | undefined {
    return this.registry.get(rdfType);
  }

  /**
   * Clear the registry (useful for testing).
   */
  clear() {
    this.registry.clear();
  }
}

export const semanticComponentRegistry = new SemanticComponentRegistry();
