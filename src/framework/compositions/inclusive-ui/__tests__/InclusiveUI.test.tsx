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

    it('registers voice intents for focus', async () => {
      const onVoiceFocus = jest.fn();
      let capturedIntents: any[] = [];

      const IntentTracker = () => {
        const { activeIntents } = useVoiceContext();
        capturedIntents = activeIntents;
        return <VoiceAccessibleText i18nKey="hello" onVoiceFocus={onVoiceFocus} />;
      };

      render(
        <AllProviders>
          <IntentTracker />
        </AllProviders>
      );

      const intent = capturedIntents.find((i) => i.id.startsWith('voice-text-'));
      expect(intent).toBeDefined();
      expect(intent.commands).toContain('focus Hello World');
      expect(intent.commands).toContain('Hello World');

      await act(async () => {
        await intent.action();
      });
      expect(onVoiceFocus).toHaveBeenCalled();
    });

    it('supports extra voice commands', () => {
      let capturedIntents: any[] = [];

      const IntentTracker = () => {
        const { activeIntents } = useVoiceContext();
        capturedIntents = activeIntents;
        return (
          <VoiceAccessibleText
            i18nKey="hello"
            extraVoiceCommands={['custom command', 'another one']}
          />
        );
      };

      render(
        <AllProviders>
          <IntentTracker />
        </AllProviders>
      );

      const intent = capturedIntents.find((i) => i.id.startsWith('voice-text-'));
      expect(intent.commands).toContain('custom command');
      expect(intent.commands).toContain('another one');
    });
  });

  describe('useInclusiveInteraction', () => {
    it('provides a11y props and registers voice intents', async () => {
      const action = jest.fn();
      let capturedIntents: any[] = [];

      const TestComponent = () => {
        const { a11yProps, label } = useInclusiveInteraction({
          id: 'test-action',
          i18nKey: 'hello',
          action,
          a11yOptions: { hint: 'Test Hint' },
        });
        const { activeIntents } = useVoiceContext();
        capturedIntents = activeIntents;
        return <View {...a11yProps} testID="target" />;
      };

      render(
        <AllProviders>
          <TestComponent />
        </AllProviders>
      );

      expect(screen.getByTestId('target').props.accessibilityLabel).toBe('Hello World');
      expect(screen.getByTestId('target').props.accessibilityHint).toBe('Test Hint');

      const intent = capturedIntents.find((i) => i.id === 'inclusive-test-action');
      expect(intent).toBeDefined();
      expect(intent.commands).toContain('Hello World');

      await act(async () => {
        await intent.action();
      });
      expect(action).toHaveBeenCalled();
    });

    it('uses fallback label if i18nKey is missing', () => {
      const TestComponent = () => {
        const { label } = useInclusiveInteraction({
          id: 'fallback-test',
          label: 'Static Label',
          action: () => {},
        });
        return <View testID="target" accessibilityLabel={label} />;
      };

      render(
        <AllProviders>
          <TestComponent />
        </AllProviders>
      );

      expect(screen.getByTestId('target').props.accessibilityLabel).toBe('Static Label');
    });

    it('supports custom voice commands and priority', () => {
      let capturedIntents: any[] = [];

      const TestComponent = () => {
        useInclusiveInteraction({
          id: 'custom-test',
          label: 'Action',
          voiceCommands: ['do action'],
          priority: 100,
          action: () => {},
        });
        const { activeIntents } = useVoiceContext();
        capturedIntents = activeIntents;
        return null;
      };

      render(
        <AllProviders>
          <TestComponent />
        </AllProviders>
      );

      const intent = capturedIntents.find((i) => i.id === 'inclusive-custom-test');
      expect(intent.commands).toEqual(['do action']);
      expect(intent.priority).toBe(100);
    });
  });
});
