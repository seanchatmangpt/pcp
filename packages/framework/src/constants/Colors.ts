import { defaultLightTheme, defaultDarkTheme } from '../framework/ui/theme/defaults';

export const Colors = {
  link: '#3b82f6',
  light: {
    text: defaultLightTheme.colors.text,
    background: defaultLightTheme.colors.background,
    tint: defaultLightTheme.colors.primary,
    tabIconDefault: defaultLightTheme.colors.secondary,
    tabIconSelected: defaultLightTheme.colors.primary,
    card: defaultLightTheme.colors.card,
    border: defaultLightTheme.colors.border,
  },
  dark: {
    text: defaultDarkTheme.colors.text,
    background: defaultDarkTheme.colors.background,
    tint: defaultDarkTheme.colors.primary,
    tabIconDefault: defaultDarkTheme.colors.secondary,
    tabIconSelected: defaultDarkTheme.colors.primary,
    card: defaultDarkTheme.colors.card,
    border: defaultDarkTheme.colors.border,
  },
};

export default Colors;
