/**
 * @fileoverview Supabase Client Configuration
 * Initializes and configures the Supabase client for the React Native application.
 * Handles authentication storage, session persistence, and URL polyfills.
 *
 * @author Your Name
 * @version 1.0.0
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from 'react-native';

/**
 * Supabase project URL from environment variables.
 * Falls back to a non-routable placeholder so build-time static rendering
 * (`expo export --platform web`) does not crash when no env is configured;
 * createClient refuses an empty URL. Runtime deployments must set
 * EXPO_PUBLIC_SUPABASE_URL.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";

/** Supabase anonymous key from environment variables (placeholder fallback, same rationale). */
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

const isServer = typeof window === 'undefined';

if (isServer && typeof global.WebSocket === 'undefined') {
  try {
    global.WebSocket = require('ws');
  } catch (e) {
    console.warn('Could not load ws polyfill');
  }
}

const customStorage = isServer ? {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
} : AsyncStorage;

// WebSockets are natively supported in React Native and Deno, no polyfill needed.

/**
 * Configured Supabase client instance
 * Set up with AsyncStorage for session persistence and proper auth configuration
 *
 * @constant {SupabaseClient} supabase - The configured Supabase client
 *
 * @example
 * // Use for authentication
 * const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 *
 * // Use for database operations
 * const { data, error } = await supabase.from('profiles').select('*');
 *
 * // Use for Edge Functions
 * const { data, error } = await supabase.functions.invoke('openai', { body: { message } });
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage as any,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});
