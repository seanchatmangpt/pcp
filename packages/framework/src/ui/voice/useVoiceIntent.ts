import { useState, useCallback, useEffect, useRef } from 'react';
import { useVoiceContext } from './VoiceCommandBoundary';
import { UseVoiceIntentOptions, UseVoiceIntentResult, VoiceIntent } from './types';

/**
 * useVoiceIntent hook for mapping voice commands to semantic actions.
 *
 * @example
 * ```tsx
 * const { startListening, isListening } = useVoiceIntent({
 *   onIntentRecognized: (intent) => console.log(`Triggered: ${intent.id}`)
 * });
 *
 * useEffect(() => {
 *   registerIntents([{
 *     id: 'navigation.back',
 *     commands: ['go back', 'return'],
 *     action: () => navigation.goBack()
 *   }]);
 * }, []);
 * ```
 */
export const useVoiceIntent = (options: UseVoiceIntentOptions = {}): UseVoiceIntentResult => {
  const {
    registerIntents: ctxRegister,
    unregisterIntents: ctxUnregister,
    getActiveIntents,
    isListening,
    setIsListening,
  } = useVoiceContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const registeredIds = useRef<Set<string>>(new Set());

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const registerIntents = useCallback(
    (intents: VoiceIntent[]) => {
      const newIntents = intents.filter((i) => !registeredIds.current.has(i.id));
      if (newIntents.length > 0) {
        newIntents.forEach((i) => registeredIds.current.add(i.id));
        ctxRegister(newIntents);
      }
    },
    [ctxRegister]
  );

  const unregisterIntents = useCallback(
    (intentIds: string[]) => {
      const toRemove = intentIds.filter((id) => registeredIds.current.has(id));
      if (toRemove.length > 0) {
        toRemove.forEach((id) => registeredIds.current.delete(id));
        ctxUnregister(toRemove);
      }
    },
    [ctxUnregister]
  );

  // Clean up registered intents on unmount
  useEffect(() => {
    return () => {
      const activeIds = Array.from(registeredIds.current);
      if (activeIds.length > 0) {
        ctxUnregister(activeIds);
        registeredIds.current.clear();
      }
    };
  }, [ctxUnregister]);

  /**
   * Simple fuzzy matching for commands.
   * In a real implementation, this might use a more sophisticated NLP engine or the Web Speech API's confidence scores.
   */
  const findMatchingIntent = useCallback(
    (command: string): VoiceIntent | null => {
      const normalizedCommand = command.toLowerCase().trim();

      let bestMatch: VoiceIntent | null = null;
      let highestPriority = -1;

      for (const intent of getActiveIntents()) {
        const isMatch = intent.commands.some((cmd) => {
          const normalizedCmd = cmd.toLowerCase().trim();
          // Exact match or contains (basic fuzzy)
          return normalizedCommand === normalizedCmd || normalizedCommand.includes(normalizedCmd);
        });

        if (isMatch) {
          const priority = intent.priority ?? 0;
          if (priority > highestPriority) {
            highestPriority = priority;
            bestMatch = intent;
          }
        }
      }

      return bestMatch;
    },
    [getActiveIntents]
  );

  const triggerIntent = useCallback(
    async (command: string): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const intent = findMatchingIntent(command);
        if (intent) {
          await intent.action();
          optionsRef.current.onIntentRecognized?.(intent);
          return true;
        } else {
          optionsRef.current.onUnknownCommand?.(command);
          return false;
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [findMatchingIntent]
  );

  const startListening = useCallback(async () => {
    // In a real environment, this would initialize the speech recognition engine.
    // For this implementation, we simulate the state change.
    setIsListening(true);
  }, [setIsListening]);

  const stopListening = useCallback(async () => {
    setIsListening(false);
  }, [setIsListening]);

  useEffect(() => {
    if (options.autoStart) {
      startListening();
    }
  }, [options.autoStart, startListening]);

  return {
    isListening,
    isProcessing,
    startListening,
    stopListening,
    registerIntents,
    unregisterIntents,
    triggerIntent,
  };
};
