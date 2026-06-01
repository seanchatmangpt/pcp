import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

export function useUpdateTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useUpdateTheme must be used within a ThemeProvider');
  }
  return {
    updateTheme: context.updateTheme,
    resetTheme: context.resetTheme,
  };
}
