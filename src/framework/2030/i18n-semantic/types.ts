/**
 * @fileoverview Type definitions for Semantic Translation 2.0.
 * Focuses on cultural intent and semantic layout adaptations.
 */

export type LayoutOrientation = 'ltr' | 'rtl';

export interface SemanticAesthetic {
  /** Cultural color significance (e.g., red means danger in US but prosperity in CN) */
  colorPalette?: Record<string, string>;
  /** Spacing adjustments for different scripts */
  spacingMultiplier?: number;
  /** Font family preferred for the culture */
  fontFamily?: string;
}

export interface SemanticIntent {
  /** The core message/intent key */
  intent: string;
  /** Translated text */
  text: string;
  /** Cultural-specific icon name (from @expo/vector-icons or similar) */
  icon?: string;
  /** Layout direction for this specific intent (if different from global) */
  layout?: LayoutOrientation;
  /** Extra metadata for the UI to interpret */
  metadata?: Record<string, any>;
}

export interface CulturalRDF {
  /** RDF Context */
  '@context'?: string;
  /** RDF Type */
  '@type'?: 'CulturalContext';
  /** ISO Language-Region code */
  culture: string;
  /** Global layout orientation for this culture */
  orientation: LayoutOrientation;
  /** Aesthetic preferences for this culture */
  aesthetic: SemanticAesthetic;
  /** Map of keys to semantic intents */
  mappings: Record<string, SemanticIntent>;
}

export interface SemanticI18nState {
  /** Current culture code */
  culture: string;
  /** Loaded RDF data for the current culture */
  data: CulturalRDF | null;
  /** Is loading data */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

export interface SemanticI18nContextValue extends SemanticI18nState {
  /** Translate a key into a full SemanticIntent */
  translate: (key: string, variables?: Record<string, string>) => SemanticIntent;
  /** Change the current culture */
  setCulture: (culture: string) => Promise<void>;
  /** Get global layout orientation */
  getOrientation: () => LayoutOrientation;
}
