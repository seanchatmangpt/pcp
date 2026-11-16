/**
 * Represents a translation value which can be a string or a nested object of translations.
 * Supports deep nesting for organized translation structures.
 */
export type TranslationValue = string | { [key: string]: TranslationValue };

/**
 * The structure for storing translations across different locales.
 * Top-level keys are locale codes (e.g., 'en', 'es').
 *
 * @example
 * {
 *   en: { welcome: "Hello" },
 *   es: { welcome: "Hola" }
 * }
 */
export interface Translations {
  [locale: string]: {
    [key: string]: TranslationValue;
  };
}

/**
 * Options for translation, including interpolation variables and pluralization count.
 */
export interface TranslationOptions {
  /**
   * Variables for string interpolation.
   * e.g., "Hello {{name}}" with { name: 'Pcp' } -> "Hello Pcp"
   */
  [key: string]: any;
  /**
   * The count used for pluralization logic.
   * If provided, the engine will look for plural forms (zero, one, other, etc.)
   * or exact numeric matches ("0", "1", etc.).
   */
  count?: number;
}

/**
 * The core i18n context state and methods.
 */
export interface I18nContextState {
  /**
   * The current active locale (e.g., 'en', 'fr').
   * This is a reactive state; changing it updates all translated strings.
   */
  locale: string;
  /**
   * Function to dynamically switch the current locale.
   *
   * @param locale - The new locale code to switch to.
   */
  setLocale: (locale: string) => void;
  /**
   * The translation function.
   * Resolves keys, performs interpolation, and handles pluralization.
   *
   * @param key - The translation key (supports dot notation for nesting).
   * @param options - Interpolation variables and pluralization count.
   * @returns The translated and processed string.
   */
  t: (key: string, options?: TranslationOptions) => string;
  /**
   * All loaded translations.
   */
  translations: Translations;
}

/**
 * Configuration for the I18nProvider.
 */
export interface I18nProviderProps {
  /**
   * The default locale to use if none is specified or found.
   * @default 'en'
   */
  defaultLocale?: string;
  /**
   * Initial translations to load into the provider.
   * @default {}
   */
  translations?: Translations;
  /**
   * Application components that will have access to the i18n context.
   */
  children: React.ReactNode;
}
