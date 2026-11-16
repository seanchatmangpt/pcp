/**
 * Represents a suggested fix for an error.
 */
export interface SuggestedFix {
  /** Unique identifier for the fix */
  id: string;
  /** Human-readable title of the fix */
  title: string;
  /** Detailed description of what the fix will do */
  description: string;
  /** The action to perform when the fix is applied */
  action: () => Promise<void> | void;
  /** Severity or impact level */
  impact: 'low' | 'medium' | 'high';
}

/**
 * Result of stack trace analysis.
 */
export interface ErrorAnalysis {
  /** Detected patterns or causes */
  causes: string[];
  /** Recommended fixes based on the analysis */
  suggestions: SuggestedFix[];
  /** Whether the error is likely related to persistent state */
  isStateRelated: boolean;
  /** Whether the error is likely related to a specific module */
  moduleName?: string;
}
