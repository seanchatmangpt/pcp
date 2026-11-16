import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { View } from 'react-native';
import { VoiceAccessibleText } from '../VoiceAccessibleText';
import { useInclusiveInteraction } from '../useInclusiveInteraction';
import { I18nProvider } from '../../../core/i18n/I18nProvider';
import { VoiceCommandBoundary, useVoiceContext } from '../../../ui/voice/VoiceCommandBoundary';

const translations = {
  en: {
    hello: 'Hello World',
    welcome: 'Welcome {{name}}',
  },
};

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider translations={translations} defaultLocale="en">
    <VoiceCommandBoundary>{children}</VoiceCommandBoundary>
  </I18nProvider>
);

describe('Inclusive UI Compositions', () => {
  describe('VoiceAccessibleText', () => {
    it('renders localized text and applies a11y props', () => {
      render(
        <AllProviders>
          <VoiceAccessibleText i18nKey="hello" testID="text" />
        </AllProviders>
      );

      const text = screen.getByTestId('text');
      // In @testing-library/react-native, children might be an array or a single value
      const content = Array.isArray(text.children) ? text.children[0] : text.children;
      expect(content).toBe('Hello World');
      expect(text.props.accessibilityLabel).toBe('Hello World');
      expect(text.props.accessibilityRole).toBe('text');
    });

    it('interpolates translations', () => {
      render(
        <AllProviders>
          <VoiceAccessibleText i18nKey="welcome" i18nOptions={{ name: 'Pcp' }} testID="text" />
        </AllProviders>
      );

      const text = screen.getByTestId('text');
      const content = Array.isArray(text.children) ? text.children[0] : text.children;
      expect(content).toBe('Welcome Pcp');
    });

    it('uses children as fallback when i18nKey is not provided', () => {
      render(
        <AllProviders>
          <VoiceAccessibleText testID="text">Fallback Text</VoiceAccessibleText>
        </AllProviders>
      );

      const text = screen.getByTestId('text');
      const content = Array.isArray(text.children) ? text.children[0] : text.children;
      expect(content).toBe('Fallback Text');
      expect(text.props.accessibilityLabel).toBe('Fallback Text');
    });
  });
});
