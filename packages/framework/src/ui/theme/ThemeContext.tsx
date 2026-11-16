import React, { createContext, useCallback, useEffect, useState } from 'react';
import { useColorScheme as useDeviceColorScheme, View } from 'react-native';
import { vars } from 'nativewind';
import { ThemeSettings, ThemeContextType } from './types';
import { defaultLightTheme, defaultDarkTheme } from './defaults';
import { createIsolatedMMKVStorage } from '@/src/lib/store/mmkvStorage';

const { instance: storage } = createIsolatedMMKVStorage('pcp-theme');

const THEME_STORAGE_KEY = 'pcp-theme-settings';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceColorScheme = useDeviceColorScheme();

  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const stored = storage.getString(THEME_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored theme', e);
      }
    }
    return deviceColorScheme === 'dark' ? defaultDarkTheme : defaultLightTheme;
  });

  const updateTheme = useCallback(
    (updates: Partial<ThemeSettings> | ((prev: ThemeSettings) => ThemeSettings)) => {
      setTheme((prev) => {
        let next: ThemeSettings;
        if (typeof updates === 'function') {
          next = updates(prev);
        } else {
          next = { ...prev, ...updates };
          if (updates.colors) {
            next.colors = { ...prev.colors, ...updates.colors };
          }
        }
        storage.set(THEME_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const resetTheme = useCallback(() => {
    const next = deviceColorScheme === 'dark' ? defaultDarkTheme : defaultLightTheme;
    setTheme(next);
    storage.remove(THEME_STORAGE_KEY);
  }, [deviceColorScheme]);

  useEffect(() => {
    const stored = storage.getString(THEME_STORAGE_KEY);
    if (!stored) {
      setTheme(deviceColorScheme === 'dark' ? defaultDarkTheme : defaultLightTheme);
    }
  }, [deviceColorScheme]);

  const themeVars = vars({
    '--color-primary': theme.colors.primary,
    '--color-secondary': theme.colors.secondary,
    '--color-background': theme.colors.background,
    '--color-text': theme.colors.text,
    '--color-card': theme.colors.card,
    '--color-border': theme.colors.border,
    '--font-scale': theme.fontScale.toString(),
  });

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      <View style={themeVars} className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
};
