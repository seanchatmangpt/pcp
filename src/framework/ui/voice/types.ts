import { ReactNode } from 'react';

/**
 * Represents a semantic action triggered by voice.
 */
export interface VoiceIntent {
  /** Unique identifier for the intent */
  id: string;
  /** Natural language patterns that trigger this intent */
  commands: string[];
  /** The action to execute when the intent is recognized */
  action: (params?: Record<string, any>) => void | Promise<void>;
  /** Optional description for accessibility and help systems */
  description?: string;
  /** Priority of the intent if multiple match */
  priority?: number;
}

/**
 * Options for the useVoiceIntent hook.
 */
export interface UseVoiceIntentOptions {
  /** Whether to start listening automatically */
  autoStart?: boolean;
  /** Callback when an intent is recognized */
  onIntentRecognized?: (intent: VoiceIntent) => void;
  /** Callback when no intent is recognized for a given command */
  onUnknownCommand?: (command: string) => void;
}

/**
 * Result of the useVoiceIntent hook.
 */
export interface UseVoiceIntentResult {
  /** Whether the voice system is currently listening */
  isListening: boolean;
  /** Whether the system is processing a command */
  isProcessing: boolean;
  /** Start listening for voice commands */
  startListening: () => Promise<void>;
  /** Stop listening for voice commands */
  stopListening: () => Promise<void>;
  /** Register new intents dynamically */
  registerIntents: (intents: VoiceIntent[]) => void;
  /** Unregister intents by ID */
  unregisterIntents: (intentIds: string[]) => void;
  /** Manually trigger an intent (useful for testing or other triggers) */
  triggerIntent: (command: string) => Promise<boolean>;
}

/**
 * Props for the VoiceCommandBoundary component.
 */
export interface VoiceCommandBoundaryProps {
  children: ReactNode;
  /** Intents available within this boundary */
  intents?: VoiceIntent[];
  /** Optional custom UI to show when listening */
  overlay?: ReactNode;
  /** Whether to enable voice commands for this boundary */
  enabled?: boolean;
}

/**
 * Internal context for the VoiceCommandBoundary.
 */
export interface VoiceContextValue {
  registerIntents: (intents: VoiceIntent[]) => void;
  unregisterIntents: (intentIds: string[]) => void;
  activeIntents: VoiceIntent[];
  isListening: boolean;
  setIsListening: (value: boolean) => void;
}
