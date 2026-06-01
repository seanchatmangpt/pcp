/**
 * @fileoverview Semantic Translation 2.0 Engine.
 * Interprets semantic intent and cultural RDF data.
 */

import { CulturalRDF, SemanticIntent, LayoutOrientation } from './types';

// Registry of available cultural RDF data
const CULTURE_REGISTRY: Record<string, () => any> = {
  'en-US': () => require('./data/en-US.json'),
  'ar-SA': () => require('./data/ar-SA.json'),
};

export class SemanticTranslationEngine {
  private currentRDF: CulturalRDF | null = null;
  private culture: string = 'en-US';

  constructor(initialCulture: string = 'en-US') {
    this.culture = initialCulture;
  }

  /**
   * Initializes the engine with the current culture's RDF data.
   */
  public async initialize(): Promise<void> {
    try {
      const loadFn = CULTURE_REGISTRY[this.culture] || CULTURE_REGISTRY['en-US'];
      this.currentRDF = loadFn();
    } catch (error) {
      console.error(`Failed to load RDF for culture: ${this.culture}`, error);
      throw new Error(`[SemanticI18n] RDF data unavailable for ${this.culture}`);
    }
  }

  /**
   * Sets the current culture and reloads RDF data.
   */
  public async setCulture(culture: string): Promise<void> {
    this.culture = culture;
    await this.initialize();
  }

  /**
   * Translates a key into a SemanticIntent with cultural adaptations.
   */
  public translate(key: string, variables: Record<string, string> = {}): SemanticIntent {
    if (!this.currentRDF) {
      throw new Error('[SemanticI18n] Engine not initialized. Call initialize() first.');
    }

    const mapping = this.currentRDF.mappings[key];

    if (!mapping) {
      console.warn(`[SemanticI18n] Missing mapping for key: ${key}`);
      return {
        intent: 'unknown',
        text: key,
        layout: this.currentRDF.orientation,
      };
    }

    // Process variable interpolation
    let processedText = mapping.text;
    Object.entries(variables).forEach(([vKey, vValue]) => {
      processedText = processedText.replace(new RegExp(`\\{${vKey}\\}`, 'g'), vValue);
    });

    return {
      ...mapping,
      text: processedText,
      // Inherit global layout if not specified in mapping
      layout: mapping.layout || this.currentRDF.orientation,
    };
  }

  /**
   * Returns the global layout orientation for the current culture.
   */
  public getOrientation(): LayoutOrientation {
    return this.currentRDF?.orientation || 'ltr';
  }

  /**
   * Returns the aesthetic configurations for the current culture.
   */
  public getAesthetic() {
    return this.currentRDF?.aesthetic || { spacingMultiplier: 1.0 };
  }

  /**
   * Returns the current culture code.
   */
  public getCulture(): string {
    return this.culture;
  }
}
