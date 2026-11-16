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
});
