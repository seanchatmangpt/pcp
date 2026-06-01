/**
 * @fileoverview Type definitions for Generative Experience (GenEx).
 */

import { BehavioralMetrics } from '../../auth/behavioral/types';

export interface GenExAesthetic {
  /** Primary color in hex or CSS variable */
  primaryColor: string;
  /** Background color in hex or CSS variable */
  backgroundColor: string;
  /** Spacing multiplier (e.g., 1.0 for default, 1.2 for more "airy") */
  spacingScale: number;
  /** Border radius in pixels */
  borderRadius: number;
}

export interface GenExVariant {
  /** Unique identifier for the variant */
  id: string;
  /** Human-readable name */
  name: string;
  /** Aesthetic configuration for this variant */
  aesthetic: GenExAesthetic;
  /** Component-specific overrides or configurations */
  layoutType: 'compact' | 'relaxed' | 'focused' | 'expansive';
}

export interface GenExState {
  /** The currently active variant */
  currentVariant: GenExVariant;
  /** Trust score used for the last generation */
  lastTrustScore: number;
  /** History of suggested variants */
  history: GenExVariant[];
  /** Whether the engine is currently generating a new variant */
  isGenerating: boolean;
}

export interface GenExOptions {
  /** The local inference engine to use */
  engineId?: string;
  /** Frequency of adaptation (e.g., on certain navigation events) */
  adaptationStrategy: 'eager' | 'lazy' | 'manual';
}

export interface GenExContextValue extends GenExState {
  /** Force a re-generation of the UI variant */
  regenerate: (trustScore: number, navHistory: string[]) => Promise<void>;
  /** Manually switch to a specific variant */
  setVariant: (variant: GenExVariant) => void;
}
