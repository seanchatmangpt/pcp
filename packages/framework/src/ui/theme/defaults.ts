import { ThemeSettings } from './types';

export const defaultLightTheme: ThemeSettings = {
  colors: {
    primary: '#6366f1', // Indigo-500
    secondary: '#94a3b8', // Slate-400
    background: '#f8fafc', // Slate-50
    text: '#0f172a', // Slate-900
    card: '#ffffff',
    border: '#e2e8f0',
    notification: '#ef4444',
  },
  fontScale: 1,
};

export const defaultDarkTheme: ThemeSettings = {
  colors: {
    primary: '#818cf8', // Indigo-400
    secondary: '#71717a', // Zinc-500
    background: '#09090b', // Zinc-950
    text: '#f8fafc', // Slate-50
    card: '#18181b',
    border: '#27272a',
    notification: '#ef4444',
  },
  fontScale: 1,
};
