import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import { defaultLightTheme } from './defaults';

export function useTheme() {
  const context = useContext(ThemeContext);
  return context ? context.theme : defaultLightTheme;
}
