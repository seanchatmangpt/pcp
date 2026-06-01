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
    activeIntents,
    isListening,
    setIsListening,
  } = useVoiceContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const registeredIds = useRef<string[]>([]);

  const registerIntents = useCallback(
    (intents: VoiceIntent[]) => {
      const ids = intents.map((i) => i.id);
      registeredIds.current = [...registeredIds.current, ...ids];
      ctxRegister(intents);
    },
    [ctxRegister]
  );

  const unregisterIntents = useCallback(
    (intentIds: string[]) => {
      registeredIds.current = registeredIds.current.filter((id) => !intentIds.includes(id));
      ctxUnregister(intentIds);
    },
    [ctxUnregister]
  );

  // Clean up registered intents on unmount
  useEffect(() => {
    return () => {
      if (registeredIds.current.length > 0) {
        ctxUnregister(registeredIds.current);
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

      for (const intent of activeIntents) {
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
    [activeIntents]
  );

  const triggerIntent = useCallback(
    async (command: string): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const intent = findMatchingIntent(command);
        if (intent) {
          await intent.action();
          options.onIntentRecognized?.(intent);
          return true;
        } else {
          options.onUnknownCommand?.(command);
          return false;
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [findMatchingIntent, options]
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
