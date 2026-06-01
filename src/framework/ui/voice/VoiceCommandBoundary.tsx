import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { VoiceIntent, VoiceCommandBoundaryProps, VoiceContextValue } from './types';

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);

/**
 * VoiceCommandBoundary provides a scoped container for voice intents.
 * It manages the registration and resolution of voice commands within its subtree.
 */
export const VoiceCommandBoundary: React.FC<VoiceCommandBoundaryProps> = ({
  children,
  intents: initialIntents = [],
  overlay,
  enabled = true,
}) => {
  const [activeIntents, setActiveIntents] = useState<VoiceIntent[]>(initialIntents);
  const [isListening, setIsListening] = useState(false);

  const registerIntents = useCallback((newIntents: VoiceIntent[]) => {
    setActiveIntents((prev) => {
      const filtered = prev.filter((p) => !newIntents.some((n) => n.id === p.id));
      return [...filtered, ...newIntents];
    });
  }, []);

  const unregisterIntents = useCallback((intentIds: string[]) => {
    setActiveIntents((prev) => prev.filter((p) => !intentIds.includes(p.id)));
  }, []);

  const value = useMemo(
    () => ({
      registerIntents,
      unregisterIntents,
      activeIntents,
      isListening,
      setIsListening,
    }),
    [registerIntents, unregisterIntents, activeIntents, isListening]
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <VoiceContext.Provider value={value}>
      {children}
      {isListening && overlay}
    </VoiceContext.Provider>
  );
};

/**
 * Hook to access the voice context within a VoiceCommandBoundary.
 */
export const useVoiceContext = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoiceContext must be used within a VoiceCommandBoundary');
  }
  return context;
};
