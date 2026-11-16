export type ThemeColors = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  card: string;
  border: string;
  notification: string;
};

export type ThemeSettings = {
  colors: ThemeColors;
  fontScale: number;
};

export type ThemeContextType = {
  theme: ThemeSettings;
  updateTheme: (updates: Partial<ThemeSettings> | ((prev: ThemeSettings) => ThemeSettings)) => void;
  resetTheme: () => void;
};
