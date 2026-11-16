import React, { createContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
  I18nContextState,
  I18nProviderProps,
  Translations,
  TranslationOptions,
  TranslationValue,
} from './types';

export const I18nContext = createContext<I18nContextState | undefined>(undefined);
// Cache for Intl.PluralRules to avoid repeated instantiation overhead in the ultra-fast engine.
const pluralRulesCache = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules;
}

/**
 * I18nProvider provides the localization context to the application.
 * It manages locale state, handles nested translation lookups, supports string interpolation
 * using {{variable}} syntax, and provides robust pluralization support.
 *
 * @example
 * <I18nProvider defaultLocale="en" translations={translations}>
 *   <App />
 * </I18nProvider>
 */
export function I18nProvider({
  defaultLocale = 'en',
  translations: initialTranslations = {},
  children,
}: I18nProviderProps) {
  const [locale, setLocale] = useState(defaultLocale);
  // In a more advanced "Zero-Config" setup, this might be linked to a global registry
  const [translations] = useState<Translations>(initialTranslations);

  /**
   * Resolves a nested key in the translation object.
   * e.g., "common.buttons.save" -> translations[locale]["common"]["buttons"]["save"]
   */
  const resolveKey = useCallback(
    (key: string, currentLocale: string): TranslationValue | undefined => {
      const keys = key.split('.');
      let result: any = translations[currentLocale];

      if (!result) return undefined;

      for (const k of keys) {
        result = result[k];
        if (result === undefined) return undefined;
      }

      return result;
    },
    [translations]
  );

  /**
   * The core translation function.
   */
  const t = useCallback(
    (key: string, options?: TranslationOptions): string => {
      let value = resolveKey(key, locale);

      // Fallback to default locale if not found in current locale
      if (value === undefined && locale !== defaultLocale) {
        value = resolveKey(key, defaultLocale);
      }

      if (value === undefined) {
        return key; // Return key as fallback if no translation found
      }

      // Handle Pluralization
      if (typeof value === 'object' && options?.count !== undefined) {
        const count = options.count;
        const valObj = value as Record<string, string>;

        // 1. Check for exact numeric match (e.g., "0": "No items")
        let pluralValue = valObj[count.toString()];

        // 2. If not found, check for 'zero' key if count is 0
        if (pluralValue === undefined && count === 0 && valObj['zero'] !== undefined) {
          pluralValue = valObj['zero'];
        }

        // 3. Use Intl.PluralRules for standard linguistic rules (one, few, many, etc.)
        if (pluralValue === undefined) {
          const pluralRules = new Intl.PluralRules(locale);
          const rule = pluralRules.select(count);
          pluralValue = valObj[rule] || valObj['other'];
        }

        if (pluralValue !== undefined) {
          value = pluralValue;
        }
      }

      if (typeof value !== 'string') {
        // If we still have an object but no pluralization was applied or found
        return key;
      }

      // Handle Interpolation
      let result = value;
      if (options) {
        Object.keys(options).forEach((variable) => {
          const placeholder = `{{${variable}}}`;
          if (result.includes(placeholder)) {
            result = result.replace(new RegExp(placeholder, 'g'), String(options[variable]));
          }
        });
      }

      return result;
    },
    [locale, defaultLocale, translations, resolveKey]
  );

  const contextValue = useMemo(
    (): I18nContextState => ({
      locale,
      setLocale,
      t,
      translations,
    }),
    [locale, t, translations]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}
