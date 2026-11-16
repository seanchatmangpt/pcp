import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ThemeProvider } from '../ThemeContext';
import { useTheme } from '../useTheme';
import { useUpdateTheme } from '../useUpdateTheme';
import { defaultLightTheme, defaultDarkTheme } from '../defaults';
import { createIsolatedMMKVStorage } from '@/src/lib/store/mmkvStorage';
import * as reactNative from 'react-native';

describe('Theme System Scheme Listener Verification', () => {
  const { instance: storage } = createIsolatedMMKVStorage('pcp-theme');
  let useColorSchemeSpy: jest.SpyInstance;

  beforeEach(() => {
    storage.clearAll();
    useColorSchemeSpy = jest.spyOn(reactNative, 'useColorScheme');
    useColorSchemeSpy.mockReturnValue('light');
  });

  afterEach(() => {
    useColorSchemeSpy.mockRestore();
  });

  it('updates theme defaults when system scheme changes without stored theme settings', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result, rerender } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.colors.background).toBe(defaultLightTheme.colors.background);

    // Simulate system scheme change to dark
    useColorSchemeSpy.mockReturnValue('dark');
    rerender({});

    expect(result.current.colors.background).toBe(defaultDarkTheme.colors.background);
  });

  it('verifies if theme settings refresh/update when system scheme changes WITH stored theme settings', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result, rerender } = renderHook(() => ({
      theme: useTheme(),
      updater: useUpdateTheme(),
    }), { wrapper });

    // Store custom theme settings
    act(() => {
      result.current.updater.updateTheme({
        colors: {
          ...result.current.theme.colors,
          primary: '#ff0000', // Custom primary
        },
      });
    });

    expect(result.current.theme.colors.primary).toBe('#ff0000');
    expect(result.current.theme.colors.background).toBe(defaultLightTheme.colors.background);

    // Simulate system scheme change to dark
    useColorSchemeSpy.mockReturnValue('dark');
    rerender({});

    console.log('--- THEME VERIFICATION LOGS ---');
    console.log('Background after switching to dark with stored settings:', result.current.theme.colors.background);
    console.log('Primary color after switching to dark with stored settings:', result.current.theme.colors.primary);
    console.log('-------------------------------');
  });
});
