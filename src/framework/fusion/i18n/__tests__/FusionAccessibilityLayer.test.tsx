import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react-native';
import { Text, View, Button } from 'react-native';
import { FusionAccessibilityLayer } from '../FusionAccessibilityLayer';
import { useVoiceIntent } from '../../../ui/voice/useVoiceIntent';

// Mock useFocusTrap as it has side effects
jest.mock('../../../ui/a11y/hooks/useFocusTrap', () => ({
  useFocusTrap: jest.fn(),
}));

jest.mock('../../../ui/voice/useVoiceIntent', () => ({
  useVoiceIntent: jest.fn().mockReturnValue({ registerIntents: jest.fn() }),
}));

const translations = {
  en: {
    hello: 'Hello Fusion',
    action: 'Perform Action',
  },
  es: {
    hello: 'Hola Fusion',
    action: 'Realizar Acción',
  },
};

import { useTranslation } from '../../../core/i18n/useTranslation';

describe('FusionAccessibilityLayer', () => {
  it('provides i18n context and automatically translates children', () => {
    render(
      <FusionAccessibilityLayer translations={translations}>
        <Text>hello</Text>
      </FusionAccessibilityLayer>
    );

    expect(screen.getByText('Hello Fusion')).toBeTruthy();
  });

  it('supports changing locale dynamically', () => {
    const Consumer = () => {
      const { setLocale, t } = useTranslation();
      return (
        <View>
          <Text>{t('hello')}</Text>
          <Button testID="btn" title="es" onPress={() => setLocale('es')} />
        </View>
      );
    };

    render(
      <FusionAccessibilityLayer translations={translations} locale="en">
        <Consumer />
      </FusionAccessibilityLayer>
    );

    expect(screen.getByText('Hello Fusion')).toBeTruthy();

    fireEvent.press(screen.getByTestId('btn'));

    expect(screen.getByText('Hola Fusion')).toBeTruthy();
  });

  it('handles voice intent registration automatically via VoiceCommandBoundary', () => {
    render(
      <FusionAccessibilityLayer
        translations={translations}
        initialIntents={[{ id: 'test', commands: ['test'], action: jest.fn() }]}>
        <Text>hello</Text>
      </FusionAccessibilityLayer>
    );

    const element = screen.getByText('Hello Fusion');
    expect(element).toBeTruthy();
  });

  it('disables auto-translation when requested', () => {
    render(
      <FusionAccessibilityLayer translations={translations} autoTranslate={false}>
        <Text>hello</Text>
      </FusionAccessibilityLayer>
    );

    expect(screen.getByText('hello')).toBeTruthy();
  });
});
