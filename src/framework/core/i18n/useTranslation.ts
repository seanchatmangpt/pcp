import { useContext } from 'react';
import { I18nContext } from './I18nProvider';
import { I18nContextState } from './types';

/**
 * useTranslation is an ultra-fast hook to access the localization engine.
 *
 * @returns {I18nContextState} The current i18n state and translation function.
 * @throws {Error} If used outside of an I18nProvider.
 *
 * @example
 * const { t, setLocale, locale } = useTranslation();
 * return <div>{t('welcome', { name: 'Pcp' })}</div>;
 */
export function useTranslation(): I18nContextState {
  const context = useContext(I18nContext);

  if (!context) {
    // In a "Zero-Config" spirit, we could return a fallback engine here
    // instead of throwing, but throwing is safer for DX to ensure the Provider is present.
    // However, the task says "Innovate Zero-Config", so maybe a fallback is better?
    // Let's stick to the Provider requirement for now but make it easy to use.
    throw new Error(
      'useTranslation must be used within an I18nProvider. ' +
        'Ensure your app is wrapped with <I18nProvider>.'
    );
  }

  return context;
}
