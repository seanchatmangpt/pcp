import { ViewProps } from 'react-native';

/**
 * Supported semantic intent schema types.
 */
export type SchemaType = 'json-schema' | 'rdf';

/**
 * Basic semantic field definition.
 */
export interface SemanticField {
  key: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'uri';
  format?: 'email' | 'url' | 'multiline' | 'image' | 'color';
  description?: string;
  semanticType?: string; // RDF type or semantic concept
  predicate?: string;
  required?: boolean;
}

/**
 * Layout hint for the generative engine.
 */
export interface LayoutHint {
  priority?: number;
  span?: 1 | 2 | 3 | 4; // grid columns
  variant?: 'card' | 'flat' | 'hero' | 'compact';
  position?: 'header' | 'body' | 'footer' | 'sidebar';
}

/**
 * A simplified JSON schema subset for UI generation.
 */
export interface GenerativeSchema {
  title?: string;
  description?: string;
  fields: SemanticField[];
  layoutHints?: Record<string, LayoutHint>;
}

/**
 * Props for the GenerativeView component.
 */
export interface GenerativeViewProps extends ViewProps {
  /**
   * The semantic intent or schema defining the structure.
   */
  schema: GenerativeSchema;
  /**
   * The actual data to be rendered.
   */
  data: Record<string, any>;
  /**
   * Optional custom theme overrides for this specific view.
   */
  themeOverrides?: any;
  /**
   * Callback when a value within the generative view is interacted with.
   */
  onAction?: (key: string, value: any) => void;
}

/**
 * Internal representation of a layout node.
 */
export interface LayoutNode {
  key: string;
  field: SemanticField;
  value: any;
  hint: LayoutHint;
}
