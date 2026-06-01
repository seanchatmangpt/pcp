import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useA11y } from '../../ui/a11y/hooks/useA11y';
import { useVoiceIntent } from '../../ui/voice/useVoiceIntent';
import { AutoA11yOptions, A11yProps } from '../../ui/a11y/types';

export interface InclusiveInteractionOptions {
  /** Unique identifier for the interaction */
  id: string;
  /** Translation key for the label */
  i18nKey?: string;
  /** Translation options for interpolation */
  i18nOptions?: Record<string, any>;
  /** Fallback or explicit label if i18nKey is not provided */
  label?: string;
  /** High-level accessibility options */
  a11yOptions?: AutoA11yOptions;
  /** Explicit voice commands. If not provided, the label is used as a command. */
  voiceCommands?: string[];
  /** The semantic action to execute */
  action: () => void | Promise<void>;
  /** Priority of the voice intent */
  priority?: number;
}

export interface InclusiveInteractionResult {
  /** Computed accessibility props to be spread on a component */
  a11yProps: A11yProps;
  /** The localized or fallback label */
  label: string;
  /** The translation function for further use */
  t: (key: string, options?: any) => string;
}

/**
 * useInclusiveInteraction is a powerful hook that composes i18n, a11y, and voice
 * into a single semantic interaction pattern.
 *
 * It ensures that any interaction in the Pcp Framework is "Inclusive by Default"
 * by requiring both a localized label and handling voice intents alongside standard touch/click.
 */
export function useInclusiveInteraction(
  options: InclusiveInteractionOptions
): InclusiveInteractionResult {
  const { t } = useTranslation();

  // 1. Resolve localized label
  const label = useMemo(() => {
    if (options.i18nKey) {
      return t(options.i18nKey, options.i18nOptions);
    }
    return options.label || '';
  }, [options.i18nKey, options.i18nOptions, options.label, t]);

  // 2. Compute a11y props
  const a11yProps = useA11y({
    ...options.a11yOptions,
    label: label || options.a11yOptions?.label,
  });

  // 3. Integrate Voice Intents
  const { registerIntents, unregisterIntents } = useVoiceIntent();

  const memoizedVoiceCommands = useMemo(() => {
    return options.voiceCommands;
  }, [options.voiceCommands]);

  const actionRef = useRef(options.action);
  useEffect(() => {
    actionRef.current = options.action;
  }, [options.action]);

  useEffect(() => {
    const commands = memoizedVoiceCommands || (label ? [label] : []);
    const intentId = `inclusive-${options.id}`;

    if (commands.length > 0) {
      registerIntents([
        {
          id: intentId,
          commands,
          action: () => actionRef.current(),
          priority: options.priority,
          description: options.a11yOptions?.hint || label,
        },
      ]);
    }
    return () => {
      if (commands.length > 0) {
        unregisterIntents([intentId]);
      }
    };
  }, [
    options.id,
    label,
    memoizedVoiceCommands,
    options.priority,
    options.a11yOptions?.hint,
    registerIntents,
    unregisterIntents,
  ]);

  return {
    a11yProps,
    label,
    t,
  };
}
