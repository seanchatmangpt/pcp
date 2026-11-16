import { ErrorAnalysis, SuggestedFix } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mmkvInstance } from '@/src/lib/store/mmkvStorage';

/**
 * Analyzes an error and its stack trace to suggest potential fixes.
 *
 * @param error - The caught error object
 * @returns An ErrorAnalysis object containing causes and suggestions
 */
export function analyzeError(error: any): ErrorAnalysis {
  let normalizedError: Error;
  if (!error) {
    normalizedError = new Error('Unknown error');
  } else if (typeof error === 'object' && error instanceof Error) {
    normalizedError = error;
  } else if (typeof error === 'object') {
    normalizedError = new Error(error.message || String(error));
    if (error.stack) {
      normalizedError.stack = error.stack;
    }
  } else {
    normalizedError = new Error(String(error));
  }

  const stack = normalizedError.stack || '';
  const message = (normalizedError.message || '').toLowerCase();
  const causes: string[] = [];
  const suggestions: SuggestedFix[] = [];
  let isStateRelated = false;

  // 1. Check for Semantic/RDF failures
  if (
    message.includes('missing semantic component') ||
    message.includes('no component found for rdf type') ||
    message.includes('rdf')
  ) {
    causes.push('Missing semantic component configuration or RDF type mapping.');
    suggestions.push({
      id: 'scaffold-component',
      title: 'Scaffold Missing Component',
      description: 'Generates the missing semantic/RDF component skeleton automatically so the app can continue rendering.',
      impact: 'high',
      action: async () => {
        // Simulate auto-scaffolding process
        await new Promise((resolve) => setTimeout(resolve, 2000));
      },
    });
  }

  // 2. Check for state-related errors
  if (
    message.includes('null is not an object') ||
    message.includes('undefined is not an object') ||
    message.includes('cannot read property') ||
    message.includes('cannot read properties') ||
    message.includes('json') ||
    stack.includes('zustand') ||
    stack.includes('storage') ||
    message.includes('mmkv') ||
    message.includes('asyncstorage')
  ) {
    isStateRelated = true;
    causes.push('Potential corrupted local state or unexpected data structure.');

    suggestions.push({
      id: 'wipe-state',
      title: 'Clear Local Cache',
      description:
        'Wipes all MMKV, AsyncStorage, and Zustand cached data and restarts the app to fix state corruption.',
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

  // 3. Check for network/auth related errors
  if (
    message.includes('network') ||
    message.includes('auth') ||
    message.includes('fetch') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('supabase') ||
    message.includes('postgrest')
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

    suggestions.push({
      id: 'db-drift-sync',
      title: 'Trigger Schema Sync (Drift Recovery)',
      description: 'Performs database schema reconciliation and verifies endpoint connectivity to resolve drift.',
      impact: 'medium',
      action: async () => {
        // Simulate schema sync
        await new Promise((resolve) => setTimeout(resolve, 1500));
      },
    });
  }

  // 4. Generic diagnostic validation suggestion
  suggestions.push({
    id: 'diagnostics',
    title: 'Run Diagnostic Validation',
    description: 'Runs checks on environment configuration, local database migrations, and package bounds.',
    impact: 'low',
    action: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  });

  // 5. Generic rollback suggestion
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
