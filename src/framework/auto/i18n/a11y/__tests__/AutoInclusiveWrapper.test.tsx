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

  it('manages focus traps dynamically', () => {
    render(
      <I18nProvider translations={translations}>
        <InclusiveView focusTrap={true} testID="trap">
          <Text>Inside Trap</Text>
        </InclusiveView>
      </I18nProvider>
    );

    const trap = screen.getByTestId('trap');
    expect(trap.props.accessibilityViewIsModal).toBe(true);
    expect(trap.props.importantForAccessibility).toBe('yes');
  });

  it('recursive translation of children', () => {
    render(
      <I18nProvider translations={translations}>
        <InclusiveView>
          <View>
            <Text>hello</Text>
          </View>
        </InclusiveView>
      </I18nProvider>
    );

    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('combines voiceIntent with existing accessibilityLabel', () => {
    render(
      <I18nProvider translations={translations}>
        <InclusiveText voiceIntent="ACTION" accessibilityLabel="Custom Label">
          hello
        </InclusiveText>
      </I18nProvider>
    );

    const element = screen.getByText('Hello World');
    expect(element.props.accessibilityLabel).toBe('Intent: ACTION. Custom Label');
  });

  it('works with nested keys', () => {
    render(
      <I18nProvider translations={translations}>
        <InclusiveText>nested.key</InclusiveText>
      </I18nProvider>
    );

    expect(screen.getByText('Nested Value')).toBeTruthy();
  });

  it('handles non-string children gracefully', () => {
    render(
      <I18nProvider translations={translations}>
        <InclusiveView>
          <View testID="non-string" />
        </InclusiveView>
      </I18nProvider>
    );

    expect(screen.getByTestId('non-string')).toBeTruthy();
  });
});
