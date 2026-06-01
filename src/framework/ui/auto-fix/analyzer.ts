import { ErrorAnalysis, SuggestedFix } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mmkvInstance } from '../../../lib/store/mmkvStorage';

/**
 * Analyzes an error and its stack trace to suggest potential fixes.
 *
 * @param error - The caught error object
 * @returns An ErrorAnalysis object containing causes and suggestions
 */
export function analyzeError(error: Error): ErrorAnalysis {
  const stack = error.stack || '';
  const message = error.message.toLowerCase();
  const causes: string[] = [];
  const suggestions: SuggestedFix[] = [];
  let isStateRelated = false;

  // 1. Check for state-related errors
  if (
    message.includes('null is not an object') ||
    message.includes('undefined is not an object') ||
    message.includes('cannot read property') ||
    message.includes('json') ||
    stack.includes('zustand') ||
    stack.includes('storage')
  ) {
    isStateRelated = true;
    causes.push('Potential corrupted local state or unexpected data structure.');

    suggestions.push({
      id: 'wipe-state',
      title: 'Clear Local Cache',
      description:
        'Wipes all locally cached data and restarts the app. This often fixes issues caused by stale or corrupted data.',
      impact: 'high',
      action: async () => {
        await AsyncStorage.clear();
        mmkvInstance.clearAll();
        try {
          const { DevSettings } = require('react-native');
          DevSettings.reload();
        } catch (e) {
          console.warn('Reload not supported in this environment:', e);
        }
      },
    });
  }

  // 2. Check for network/auth related errors
  if (
    message.includes('network') ||
    message.includes('auth') ||
    message.includes('fetch') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    causes.push('Network or authentication failure.');
    suggestions.push({
      id: 're-auth',
      title: 'Reset Session',
      description: 'Clears your current session and takes you back to login.',
      impact: 'medium',
      action: async () => {
        await AsyncStorage.removeItem('supabase.auth.token');
        try {
          const { router } = require('expo-router');
          router.replace('/(auth)');
        } catch (e) {
          console.warn('Failed to redirect to auth screen:', e);
        }
      },
    });
  }

  // 3. Generic rollback suggestion
  suggestions.push({
    id: 'rollback',
    title: 'Safe Rollback',
    description: 'Attempts to return to the previous known stable screen.',
    impact: 'low',
    action: () => {
      try {
        const { router } = require('expo-router');
        if (router.canGoBack()) {
          router.back();
        }
      } catch (e) {
        console.warn('Failed to rollback navigation:', e);
      }
    },
  });

  return {
    causes,
    suggestions,
    isStateRelated,
  };
}
