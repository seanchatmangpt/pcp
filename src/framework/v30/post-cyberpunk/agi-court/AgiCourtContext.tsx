import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Mutation, CourtDecision, evaluateInCourt } from './agents';

export interface AgiCourtContextValue {
  proposeMutation: (mutation: Mutation) => Promise<CourtDecision>;
  history: CourtDecision[];
}

export const AgiCourtContext = createContext<AgiCourtContextValue | undefined>(undefined);

export const AgiCourtProvider = ({ children }: { children: ReactNode }) => {
  const [history, setHistory] = useState<CourtDecision[]>([]);

  const proposeMutation = useCallback(async (mutation: Mutation): Promise<CourtDecision> => {
    // Simulate async AGI processing delay in the Membrane
    const decision = evaluateInCourt(mutation);
    setHistory((prev) => [...prev, decision]);
    return decision;
  }, []);

  return (
    <AgiCourtContext.Provider value={{ proposeMutation, history }}>
      {children}
    </AgiCourtContext.Provider>
  );
};

export const useAgiCourt = (): AgiCourtContextValue => {
  const context = useContext(AgiCourtContext);
  if (!context) {
    throw new Error('useAgiCourt must be used within an AgiCourtProvider');
  }
  return context;
};
