import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text, View, Pressable } from 'react-native';
import { I18nProvider } from '../I18nProvider';
import { useTranslation } from '../useTranslation';
import { Translations } from '../types';

const translations: Translations = {
  en: {
    welcome: 'Welcome {{name}}!',
    items: {
      zero: 'No items',
      one: 'One item',
      other: '{{count}} items',
    },
    nested: {
      key: 'Nested Value',
    },
    onlyInEn: 'English only',
  },
  es: {
    welcome: '¡Bienvenido {{name}}!',
    items: {
      zero: 'Sin artículos',
      one: 'Un artículo',
      other: '{{count}} artículos',
    },
  },
};

function TestComponent() {
  const { t, setLocale, locale } = useTranslation();
  return (
    <View>
      <Text testID="welcome">{t('welcome', { name: 'Pcp' })}</Text>
      <Text testID="count-0">{t('items', { count: 0 })}</Text>
      <Text testID="count-1">{t('items', { count: 1 })}</Text>
      <Text testID="count-5">{t('items', { count: 5 })}</Text>
      <Text testID="nested">{t('nested.key')}</Text>
      <Text testID="locale">{locale}</Text>
      <Text testID="fallback">{t('onlyInEn')}</Text>
      <Pressable onPress={() => setLocale('es')} testID="switch-es">
        <Text>Switch to ES</Text>
      </Pressable>
      <Text testID="missing">{t('missing.key')}</Text>
    </View>
  );
}

describe('I18n System', () => {
  it('translates basic keys and performs interpolation', () => {
    render(
      <I18nProvider translations={translations}>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('welcome').children[0]).toBe('Welcome Pcp!');
  });

  it('handles pluralization correctly', () => {
    render(
      <I18nProvider translations={translations}>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('count-0').children[0]).toBe('No items');
    expect(screen.getByTestId('count-1').children[0]).toBe('One item');
    expect(screen.getByTestId('count-5').children[0]).toBe('5 items');
  });

  it('resolves nested keys', () => {
    render(
      <I18nProvider translations={translations}>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('nested').children[0]).toBe('Nested Value');
  });

  it('supports dynamic locale switching', () => {
    render(
      <I18nProvider translations={translations}>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('locale').children[0]).toBe('en');

    fireEvent.press(screen.getByTestId('switch-es'));

    expect(screen.getByTestId('locale').children[0]).toBe('es');
    expect(screen.getByTestId('welcome').children[0]).toBe('¡Bienvenido Pcp!');
    expect(screen.getByTestId('count-0').children[0]).toBe('Sin artículos');
  });

  it('falls back to default locale if key is missing in current locale', () => {
    render(
      <I18nProvider translations={translations} defaultLocale="en">
        <TestComponent />
      </I18nProvider>
    );

    fireEvent.press(screen.getByTestId('switch-es'));

    // 'onlyInEn' is not in 'es', should fallback to 'en'
    expect(screen.getByTestId('fallback').children[0]).toBe('English only');
  });

  it('returns the key itself if translation is completely missing', () => {
    render(
      <I18nProvider translations={translations}>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('missing').children[0]).toBe('missing.key');
  });

  it('throws error when useTranslation is used outside I18nProvider', () => {
    // Suppress console.error for this test to keep output clean
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      'useTranslation must be used within an I18nProvider'
    );

    consoleSpy.mockRestore();
  });
});
