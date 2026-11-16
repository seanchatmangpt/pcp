import React from 'react';
import { View, ViewStyle } from 'react-native';
import { I18nProvider } from '../../core/i18n';
import { VoiceCommandBoundary } from '../../ui/voice';
import { withAutoInclusive } from '../../auto/i18n/a11y';
import { Translations } from '../../core/i18n/types';
import { VoiceIntent } from '../../ui/voice/types';

export interface FusionAccessibilityLayerProps {
  children: React.ReactNode;
  /**
   * The localized translations dictionary.
   */
  translations: Translations;
  /**
   * The default locale to use.
   * @default 'en'
   */
  locale?: string;
  /**
   * Whether voice-to-intent is enabled.
   * @default true
   */
  voiceEnabled?: boolean;
  /**
   * Initial voice intents for the root boundary.
   */
  initialIntents?: VoiceIntent[];
  /**
   * Optional overlay to show when voice is listening.
   */
  voiceOverlay?: React.ReactNode;
  /**
   * Whether to automatically translate all string children recursively.
   * @default true
   */
  autoTranslate?: boolean;
  /**
   * Style for the root container.
   */
  style?: ViewStyle;
}

// Create a root component that handles auto-translation and accessibility
const AutoInclusiveRoot = withAutoInclusive(View);

/**
 * FusionAccessibilityLayer is the "Inclusive by Default" entry point for the Pcp Framework.
 *
 * It fuses:
 * 1. core/i18n: Real-time localization and string interpolation.
 * 2. ui/voice: Voice-to-intent recognition and management.
 * 3. auto/i18n: Automatic recursive translation and a11y label injection.
 * 4. compositions/inclusive-ui: Semantic interaction patterns.
 *
 * By wrapping the entire application with this layer, developers get:
 * - Automatic translation of all Text components.
 * - Global voice command management.
 * - Consistent accessibility behavior.
 * - Voice-to-intent labels injected into the accessibility tree.
 */
export const FusionAccessibilityLayer: React.FC<FusionAccessibilityLayerProps> = ({
  children,
  translations,
  locale = 'en',
  voiceEnabled = true,
  initialIntents = [],
  voiceOverlay,
  autoTranslate = true,
  style = { flex: 1 },
}) => {
  return (
    <I18nProvider defaultLocale={locale} translations={translations}>
      <VoiceCommandBoundary enabled={voiceEnabled} intents={initialIntents} overlay={voiceOverlay}>
        <AutoInclusiveRoot autoTranslate={autoTranslate} style={style} testID="fusion-a11y-root">
          {children}
        </AutoInclusiveRoot>
      </VoiceCommandBoundary>
    </I18nProvider>
  );
};
