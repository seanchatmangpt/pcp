import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { withAutoInclusive } from '../AutoInclusiveWrapper';
import { I18nProvider } from '../../../../core/i18n/I18nProvider';

// Mock useFocusTrap as it has side effects (setTimeout, AccessibilityInfo)
jest.mock('../../../../ui/a11y/hooks/useFocusTrap', () => ({
  useFocusTrap: jest.fn(),
}));

const translations = {
  en: {
    hello: 'Hello World',
    goodbye: 'Goodbye',
    nested: {
      key: 'Nested Value',
    },
  },
};

const InclusiveText = withAutoInclusive(Text);
const InclusiveView = withAutoInclusive(View);

describe('AutoInclusiveWrapper', () => {
  it('automatically translates string children', () => {
    render(
      <I18nProvider translations={translations}>
        <InclusiveText>hello</InclusiveText>
      </I18nProvider>
    );

    // In @testing-library/react-native, we look for the translated text
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('injects voice-to-intent labels', () => {
    render(
      <I18nProvider translations={translations}>
        <InclusiveText voiceIntent="GREET">hello</InclusiveText>
      </I18nProvider>
    );

    const element = screen.getByText('Hello World');
    expect(element.props.accessibilityLabel).toBe('Intent: GREET. Hello World');
  });

  it('supports disabling auto-translation', () => {
    render(
      <I18nProvider translations={translations}>
        <InclusiveText autoTranslate={false}>hello</InclusiveText>
      </I18nProvider>
    );

    expect(screen.getByText('hello')).toBeTruthy();
  });
});
