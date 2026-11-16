/**
 * @fileoverview Semantic I18n Context and Provider.
 * Provides Semantic Translation 2.0 capabilities to React components.
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { SemanticI18nContextValue, LayoutOrientation, SemanticIntent } from './types';
import { SemanticTranslationEngine } from './SemanticTranslationEngine';

const SemanticI18nContext = createContext<SemanticI18nContextValue | undefined>(undefined);

export const SemanticI18nProvider: React.FC<{
  children: React.ReactNode;
  initialCulture?: string;
}> = ({ children, initialCulture = 'en-US' }) => {
  const [culture, setCultureState] = useState(initialCulture);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize the engine to prevent unnecessary re-creations
  const engine = useMemo(() => new SemanticTranslationEngine(culture), [culture]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        await engine.initialize();
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [engine]);

  const setCulture = async (newCulture: string) => {
    setCultureState(newCulture);
  };

  const translate = (key: string, variables?: Record<string, string>): SemanticIntent => {
    try {
      return engine.translate(key, variables);
    } catch (err) {
      console.error(err);
      return { intent: 'error', text: key };
    }
  };

  const getOrientation = (): LayoutOrientation => {
    return engine.getOrientation();
  };

  const value: SemanticI18nContextValue = {
    culture,
    data: (engine as any).currentRDF, // Accessing private for context state if needed
    isLoading,
    error,
    translate,
    setCulture,
    getOrientation,
  };

  return <SemanticI18nContext.Provider value={value}>{children}</SemanticI18nContext.Provider>;
};

/**
 * Hook to access Semantic Translation 2.0 capabilities.
 */
export const useSemanticI18n = () => {
  const context = useContext(SemanticI18nContext);
  if (context === undefined) {
    throw new Error('useSemanticI18n must be used within a SemanticI18nProvider');
  }
  return context;
};
