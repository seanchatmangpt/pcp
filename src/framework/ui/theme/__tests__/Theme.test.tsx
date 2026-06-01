import React from 'react';
import { render, act, renderHook } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { ThemeProvider } from '../ThemeContext';
import { useTheme } from '../useTheme';
import { useUpdateTheme } from '../useUpdateTheme';
import { defaultLightTheme, defaultDarkTheme } from '../defaults';
import { createMMKV } from 'react-native-mmkv';

describe('Dynamic Theme Engine', () => {
  beforeEach(() => {
    const storage = createMMKV({ id: 'pcp-theme-storage' });
    storage.clearAll();
    jest.clearAllMocks();
  });
  it('provides the default light theme', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.colors.primary).toBe(defaultLightTheme.colors.primary);
    expect(result.current.fontScale).toBe(1);
  });

  it('updates the theme colors', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(
      () => ({
        theme: useTheme(),
        update: useUpdateTheme(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.update.updateTheme({
        colors: { ...result.current.theme.colors, primary: '#ff0000' },
      });
    });

    expect(result.current.theme.colors.primary).toBe('#ff0000');
  });

  it('updates the font scale', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(
      () => ({
        theme: useTheme(),
        update: useUpdateTheme(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.update.updateTheme({ fontScale: 1.5 });
    });

    expect(result.current.theme.fontScale).toBe(1.5);
  });

  it('resets the theme', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(
      () => ({
        theme: useTheme(),
        update: useUpdateTheme(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.update.updateTheme({ fontScale: 2 });
    });
    expect(result.current.theme.fontScale).toBe(2);

    act(() => {
      result.current.update.resetTheme();
    });
    expect(result.current.theme.fontScale).toBe(1);
  });

  it('throws error when used outside Provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within a ThemeProvider'
    );
    expect(() => renderHook(() => useUpdateTheme())).toThrow(
      'useUpdateTheme must be used within a ThemeProvider'
    );
    consoleError.mockRestore();
  });
});
