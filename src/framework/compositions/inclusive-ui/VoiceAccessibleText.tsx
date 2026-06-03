import React, { useMemo, useEffect, useRef } from 'react';
import { Text, TextProps } from 'react-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useA11y } from '../../ui/a11y/hooks/useA11y';
import { useVoiceIntent } from '../../ui/voice/useVoiceIntent';
import { AutoA11yOptions } from '../../ui/a11y/types';

export interface VoiceAccessibleTextProps extends TextProps {
  /**
   * The translation key for the text content.
   */
  i18nKey?: string;
  /**
   * Optional interpolation options for the translation.
   */
  i18nOptions?: Record<string, any>;
  /**
   * High-level accessibility options.
   */
  a11yOptions?: AutoA11yOptions;
  /**
   * Prefix for the voice focus command. Defaults to 'focus'.
   */
  voiceCommandPrefix?: string;
  /**
   * Callback triggered when the component is focused via voice.
   */
  onVoiceFocus?: () => void;
  /**
   * Optional custom voice commands that also trigger focus.
   */
  extraVoiceCommands?: string[];
}

const DEFAULT_EXTRA_COMMANDS: string[] = [];

/**
 * VoiceAccessibleText is a specialized composition that combines i18n, a11y, and voice intents.
 * It automatically localizes its content, applies appropriate accessibility labels,
 * and registers voice commands to allow users to interact with the text via voice.
 */
export const VoiceAccessibleText: React.FC<VoiceAccessibleTextProps> = ({
  i18nKey,
  i18nOptions,
  a11yOptions,
  voiceCommandPrefix = 'focus',
  onVoiceFocus,
  extraVoiceCommands = DEFAULT_EXTRA_COMMANDS,
  children,
  ...textProps
}) => {
  const { t } = useTranslation();

  // 1. Automatic Localization
  const content = useMemo(() => {
    if (i18nKey) {
      return t(i18nKey, i18nOptions);
    }
    return children;
  }, [i18nKey, i18nOptions, t, children]);

  // 2. Automatic A11y Labels
  const a11yProps = useA11y({
    label: typeof content === 'string' ? content : undefined,
    role: 'text',
    ...a11yOptions,
  });

  // 3. Voice Intent Integration
  const { registerIntents, unregisterIntents } = useVoiceIntent();

  const extraVoiceCommandsString = JSON.stringify(extraVoiceCommands || []);
  const memoizedExtraCommands = useMemo(() => {
    return extraVoiceCommands;
  }, [extraVoiceCommandsString]);

  const onVoiceFocusRef = useRef(onVoiceFocus);
  useEffect(() => {
    onVoiceFocusRef.current = onVoiceFocus;
  }, [onVoiceFocus]);

  useEffect(() => {
    let registeredId: string | null = null;
    if (typeof content === 'string' && content.length > 0) {
      const intentId = `voice-text-${content.replace(/\s+/g, '-').toLowerCase()}`;
      const commands = [`${voiceCommandPrefix} ${content}`, content, ...memoizedExtraCommands];

      registerIntents([
        {
          id: intentId,
          commands,
          action: () => {
            onVoiceFocusRef.current?.();
          },
          description: `Focuses on the text: ${content}`,
        },
      ]);
      registeredId = intentId;
    }
    return () => {
      if (registeredId) {
        unregisterIntents([registeredId]);
      }
    };
  }, [content, voiceCommandPrefix, memoizedExtraCommands, registerIntents, unregisterIntents]);

  return (
    <Text {...textProps} {...a11yProps}>
      {content}
    </Text>
  );
};
