/**
 * @fileoverview Authentication Avatar-Relative Projection
 * Provides user authentication functionality including sign in and sign up flows.
 * Features form validation, loading states, and seamless toggle between auth modes.
 *
 * @author Your Name
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Platform,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { supabase } from '../../../../../lib/supabase';
import { Stack } from '@/src/components/AvatarRelativeProjection';
import { useSession } from '@/context/SessionProvider';
import { KeyboardSafeForm } from '@/src/components/KeyboardSafeForm';
import { AdaptivePressable } from '@/src/framework/auto/ux/adaptive/AdaptivePressable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useHaptics } from '../../framework/ui/haptics/useHaptics';
import { HapticFeedbackPattern } from '../../framework/ui/haptics/IntelligentHaptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Authentication component with sign in and sign up functionality
 * Provides a professional card-based layout with form validation
 *
 * @component
 * @returns {JSX.Element} The authentication Avatar-Relative Projection
 *
 * @example
 * // Used in Expo Router for unauthenticated users
 * <Auth />
 */
export default function Auth() {
  const isDark = useColorScheme() === 'dark';
  /** User's email address */
  const [email, setEmail] = useState('');

  /** User's password */
  const [password, setPassword] = useState('');

  /** Loading state during authentication */
  const [loading, setLoading] = useState(false);

  /** Toggle between sign in and sign up modes */
  const [isSignUp, setIsSignUp] = useState(false);

  /** Password visibility toggle state */
  const [showPassword, setShowPassword] = useState(false);

  // Focus states
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Error/Success Notification Banner state
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Initialize haptics hook
  const haptics = useHaptics();

  // Animations using Reanimated shared values
  const scaleAnim = useSharedValue(1);
  const rotateAnim = useSharedValue(0);
  const bannerOpacity = useSharedValue(0);
  const bannerScale = useSharedValue(0.95);

  // Requirements checklist helpers
  const isValidEmail = /\S+@\S+\.\S+/.test(email);
  const isMinLength = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const hasSpecialOrUpper = /[^a-z0-9]/i.test(password) || /[A-Z]/.test(password);

  // Button micro-interaction styles
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateAnim.value * 360}deg` }],
  }));

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ scale: bannerScale.value }],
  }));

  // Button micro-interaction: scale down on press
  const handlePressIn = () => {
    scaleAnim.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    scaleAnim.value = withSpring(1);
  };

  // Button micro-interaction: rotate spinner when loading
  useEffect(() => {
    if (loading) {
      rotateAnim.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotateAnim.value = 0;
    }
  }, [loading]);

  // Banner animations: fade in/out and scale up/down
  useEffect(() => {
    if (banner) {
      bannerOpacity.value = withTiming(1, { duration: 250 });
      bannerScale.value = withSpring(1, { damping: 15, stiffness: 80 });
    } else {
      bannerOpacity.value = withTiming(0, { duration: 150 });
      bannerScale.value = withTiming(0.95, { duration: 150 });
    }
  }, [banner]);

  // Trigger haptics when banner notification state changes
  useEffect(() => {
    if (banner) {
      if (banner.type === 'success') {
        haptics.trigger(HapticFeedbackPattern.SUCCESS);
      } else if (banner.type === 'error') {
        haptics.trigger(HapticFeedbackPattern.ERROR);
      }
    }
  }, [banner, haptics]);

  /**
   * Handles user sign in with email and password
   * Validates input fields and manages loading state
   *
   * @async
   * @function signInWithEmail
   * @throws {Error} When authentication fails
   */
  async function signInWithEmail() {
    console.log('[Auth Debug] signInWithEmail called with:', { email, password });
    haptics.trigger(HapticFeedbackPattern.MEDIUM);
    if (!email || !password) {
      setBanner({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[Auth Debug] signInWithPassword result:', { data, error });

      if (error) {
        setBanner({ type: 'error', message: error.message });
      } else {
        haptics.trigger(HapticFeedbackPattern.SUCCESS);
      }
    } catch (e: any) {
      console.error('[Auth Debug] Unexpected error during sign in:', e);
      setBanner({ type: 'error', message: e?.message || 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handles user sign up with email and password
   * Validates input fields including password length requirements
   *
   * @async
   * @function signUpWithEmail
   * @throws {Error} When sign up fails or validation errors occur
   */
  async function signUpWithEmail() {
    haptics.trigger(HapticFeedbackPattern.MEDIUM);
    if (!email || !password) {
      setBanner({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    if (!isValidEmail) {
      setBanner({ type: 'error', message: 'Please enter a valid email address' });
      return;
    }

    if (password.length < 6) {
      setBanner({ type: 'error', message: 'Password must be at least 6 characters' });
      return;
    }

    if (!hasNumber) {
      setBanner({ type: 'error', message: 'Password must contain at least one number' });
      return;
    }

    if (!hasSpecialOrUpper) {
      setBanner({
        type: 'error',
        message: 'Password must contain an uppercase or special character',
      });
      return;
    }

    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setBanner({ type: 'error', message: error.message });
      } else {
        setBanner({
          type: 'success',
          message: 'Verification link sent! Check your email.',
        });
      }
    } catch (e: any) {
      console.error('[Auth Debug] Unexpected error during sign up:', e);
      setBanner({ type: 'error', message: e?.message || 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  }

  const { setSession } = useSession();

  async function signInWithProvider(provider: 'google' | 'apple') {
    haptics.trigger(HapticFeedbackPattern.LIGHT);
    if (__DEV__) {
      console.log(
        `[Auth Debug] DEV MODE: Bypassing ${provider} SSO and logging in with admin credentials.`
      );
      setLoading(true);
      setBanner(null);
      try {
        let { data, error } = await supabase.auth.signInWithPassword({
          email: 'admin@truex.com',
          password: 'password123',
        });

        if (error && error.message.includes('Invalid login credentials')) {
          console.log('[Auth Debug] Admin user not found, creating it automatically...');
          const signUpRes = await supabase.auth.signUp({
            email: 'admin@truex.com',
            password: 'password123',
          });

          if (signUpRes.error) {
            throw signUpRes.error;
          }

          // Re-attempt login if signup doesn't auto-login
          if (!signUpRes.data.session) {
            const loginRes = await supabase.auth.signInWithPassword({
              email: 'admin@truex.com',
              password: 'password123',
            });
            if (loginRes.error) throw loginRes.error;
          }
        } else if (error) {
          throw error;
        }
      } catch (e: any) {
        console.log(
          `[Auth Debug] Network/DB failed during dev admin sign in, injecting mock session. Reason:`,
          e.message
        );
        // Force a mock session so the simulator is functional without the backend
        setSession({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'mock-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'admin@truex.com',
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
        haptics.trigger(HapticFeedbackPattern.SUCCESS);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
      });

      if (error) {
        setBanner({ type: 'error', message: error.message });
      }
    } catch (e: any) {
      console.error(`[Auth Debug] Unexpected error during ${provider} sign in:`, e);
      setBanner({ type: 'error', message: e?.message || 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  }

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setBanner(null);
  };

  return (
    <KeyboardSafeForm
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      className="bg-background"
      testID="keyboard-avoiding-view"
    >
        <Stack.Screen options={{ title: 'Welcome' }} />

        {/* Outer view container to structure spacing professionally */}
        <View className="flex-1 justify-center px-6 py-12">
          {/* Professional Brand Header Section */}
          <View className="items-center mb-10 mt-4">
            <View className="relative w-24 h-24 items-center justify-center mb-5">
              <View className="absolute inset-0 border-[3px] border-indigo-100 rounded-full opacity-70" />
              <View className="absolute inset-2 border-2 border-dashed border-indigo-300 rounded-full opacity-60" />
              <View className="absolute inset-4 bg-indigo-600 rounded-full items-center justify-center shadow-lg shadow-indigo-200">
                <Feather name="shield" size={32} color="#ffffff" />
              </View>
            </View>
            <Text className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight text-center">
              TRUEX
            </Text>
            <Text className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mt-1.5 text-center">
              Secure Gateway
            </Text>
            <Text className="text-slate-600 dark:text-slate-400 text-sm mt-4 text-center max-w-[280px] leading-relaxed">
              {isSignUp
                ? 'Create a secure account to register this node on the network'
                : 'Enter your credentials to synchronize with the secure membrane'}
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-card rounded-[32px] shadow-xl shadow-slate-200/40 dark:shadow-slate-950/50 border border-border p-8 mb-8">
            <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">
              {isSignUp ? 'Create Node Account' : 'Sign In to Node'}
            </Text>

            {/* SSO Buttons */}
            <View className="mb-6">
              <TouchableOpacity
                className="flex-row items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 mb-3"
                onPress={() => signInWithProvider('google')}
                disabled={loading}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <FontAwesome name="google" size={20} color="#ea4335" />
                <Text className="ml-3 font-semibold text-slate-900 dark:text-slate-200 text-base">
                  Continue with Google
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-center bg-black dark:bg-slate-950 border border-black dark:border-slate-800 rounded-2xl py-3.5"
                onPress={() => signInWithProvider('apple')}
                disabled={loading}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
              >
                <FontAwesome name="apple" size={20} color="#ffffff" />
                <Text className="ml-3 font-semibold text-white text-base">Continue with Apple</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center mb-6">
              <View className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <Text className="mx-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                or email
              </Text>
              <View className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </View>

            {/* Notification Banner */}
            {banner && (
              <Animated.View
                style={[
                  bannerStyle,
                  {
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }
                ]}
                className={`mb-6 p-4 rounded-xl border ${
                  banner.type === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <Feather
                  name={banner.type === 'error' ? 'alert-circle' : 'check-circle'}
                  size={20}
                  color={banner.type === 'error' ? '#ef4444' : '#10b981'}
                />
                <View style={{ width: 8 }} />
                <View className="flex-1">
                  <Text
                    className={`font-semibold text-sm ${
                      banner.type === 'error' ? 'text-red-800' : 'text-emerald-800'
                    }`}
                  >
                    {banner.type === 'error' ? 'Authentication Alert' : 'Success'}
                  </Text>
                  <Text
                    className={`text-xs mt-0.5 ${
                      banner.type === 'error' ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {banner.message}
                  </Text>
                </View>
                <View style={{ width: 8 }} />
                <TouchableOpacity
                  testID="close-banner-button"
                  onPress={() => setBanner(null)}
                  className="p-0.5"
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Close alert banner"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Feather
                    name="x"
                    size={16}
                    color={banner.type === 'error' ? '#7f1d1d' : '#064e3b'}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Email Input */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email Address</Text>
              <View
                testID="email-input-container"
                className={`flex-row items-center border rounded-2xl px-5 py-4 ${
                  emailFocused
                    ? 'border-indigo-500 bg-white dark:bg-slate-900 ring-2 ring-indigo-100 dark:ring-indigo-900/30 shadow-sm shadow-indigo-100/50'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50'
                }`}
              >
                <Feather name="mail" size={20} color={emailFocused ? '#6366f1' : '#64748b'} />
                <View style={{ width: 12 }} />
                <TextInput
                  className="flex-1 text-base text-slate-900 dark:text-white"
                  onChangeText={setEmail}
                  value={email}
                  placeholder="your@email.com"
                  placeholderTextColor={isDark ? '#94a3b8' : '#475569'}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  accessibilityLabel="Email Address"
                  accessibilityHint="Enter your email address"
                />
                {email.length > 0 && (
                  <TouchableOpacity
                    testID="clear-email-button"
                    onPress={() => setEmail('')}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Clear email"
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <Feather name="x" size={18} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Password Input */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Password</Text>
              <View
                testID="password-input-container"
                className={`flex-row items-center border rounded-2xl px-5 py-4 ${
                  passwordFocused
                    ? 'border-indigo-500 bg-white dark:bg-slate-900 ring-2 ring-indigo-100 dark:ring-indigo-900/30 shadow-sm shadow-indigo-100/50'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50'
                }`}
              >
                <Feather name="lock" size={20} color={passwordFocused ? '#6366f1' : '#64748b'} />
                <View style={{ width: 12 }} />
                <TextInput
                  className="flex-1 text-base text-slate-900 dark:text-white"
                  onChangeText={setPassword}
                  value={password}
                  secureTextEntry={!showPassword}
                  placeholder={isSignUp ? 'Minimum 6 characters' : 'Enter your password'}
                  placeholderTextColor={isDark ? '#94a3b8' : '#475569'}
                  autoCapitalize="none"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  accessibilityLabel="Password"
                  accessibilityHint="Enter your password"
                />
                {password.length > 0 && (
                  <TouchableOpacity
                    testID="password-visibility-toggle"
                    onPress={() => setShowPassword(!showPassword)}
                    className="p-1"
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Password Requirements Checklist */}
              {isSignUp && (
                <View className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 mt-4">
                  <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3">
                    Security Requirements
                  </Text>
                  <View>
                    {/* Email check */}
                    <View className="flex-row items-center mb-2.5">
                      <Feather
                        name={isValidEmail ? 'check' : 'circle'}
                        size={14}
                        color={isValidEmail ? '#10b981' : '#cbd5e1'}
                      />
                      <View style={{ width: 10 }} />
                      <Text
                        className={`text-xs ${
                          isValidEmail ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Valid email format
                      </Text>
                    </View>

                    {/* Length check */}
                    <View className="flex-row items-center mb-2.5">
                      <Feather
                        name={isMinLength ? 'check' : 'circle'}
                        size={14}
                        color={isMinLength ? '#10b981' : '#cbd5e1'}
                      />
                      <View style={{ width: 10 }} />
                      <Text
                        className={`text-xs ${
                          isMinLength ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        At least 6 characters
                      </Text>
                    </View>

                    {/* Number check */}
                    <View className="flex-row items-center mb-2.5">
                      <Feather
                        name={hasNumber ? 'check' : 'circle'}
                        size={14}
                        color={hasNumber ? '#10b981' : '#cbd5e1'}
                      />
                      <View style={{ width: 10 }} />
                      <Text
                        className={`text-xs ${
                          hasNumber ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Contains at least 1 number
                      </Text>
                    </View>

                    {/* Capital check */}
                    <View className="flex-row items-center">
                      <Feather
                        name={hasSpecialOrUpper ? 'check' : 'circle'}
                        size={14}
                        color={hasSpecialOrUpper ? '#10b981' : '#cbd5e1'}
                      />
                      <View style={{ width: 10 }} />
                      <Text
                        className={`text-xs ${
                          hasSpecialOrUpper ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Contains an uppercase or special character
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={{ height: 12 }} />

            {/* Submit Button */}
            <AnimatedPressable
              onPress={isSignUp ? signUpWithEmail : signInWithEmail}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={loading || !email || !password}
              style={buttonStyle}
              className={`rounded-2xl py-4 px-6 mb-5 flex-row items-center justify-center ${
                loading || !email || !password
                  ? 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                  : 'bg-indigo-600 dark:bg-indigo-600 shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/20'
              }`}
              accessibilityRole="button"
              accessibilityLabel={
                loading
                  ? 'Authorizing Node'
                  : isSignUp
                    ? 'Initialize Registration'
                    : 'Establish Secure Session'
              }
              accessibilityState={{ disabled: loading || !email || !password }}
            >
              {loading ? (
                <Animated.View
                  style={[spinnerStyle, { marginRight: 12 }]}
                >
                  <Feather
                    name="loader"
                    size={20}
                    color={loading || !email || !password ? '#64748b' : '#ffffff'}
                  />
                </Animated.View>
              ) : (
                <Feather
                  name={isSignUp ? 'user-plus' : 'log-in'}
                  size={20}
                  color={loading || !email || !password ? '#64748b' : '#ffffff'}
                  style={{ marginRight: 10 }}
                />
              )}
              <Text
                className={`text-center font-bold text-[15px] tracking-wide ${
                  loading || !email || !password ? 'text-slate-600 dark:text-slate-400' : 'text-white'
                }`}
              >
                {loading
                  ? 'Authorizing Node...'
                  : isSignUp
                    ? 'Initialize Registration'
                    : 'Establish Secure Session'}
              </Text>
            </AnimatedPressable>

            {/* Toggle Auth Mode */}
            <TouchableOpacity
              className="py-3 h-11 justify-center"
              onPress={toggleAuthMode}
              disabled={loading}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={
                isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"
              }
            >
              <Text className="text-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Features Preview */}
          <View className="bg-indigo-50/60 dark:bg-indigo-950/20 rounded-3xl border border-indigo-100 dark:border-indigo-900 p-6 shadow-sm shadow-indigo-100/30 dark:shadow-indigo-950/20">
            <Text className="text-indigo-800 dark:text-indigo-300 font-bold mb-2.5 text-center text-sm uppercase tracking-wide">
              ✨ Gateway Features
            </Text>
            <Text className="text-indigo-900 dark:text-indigo-300 text-xs text-center leading-relaxed font-medium px-4">
              Multi-Agent Synchronization • Cryptographic Keys • Secure Local Session
            </Text>
          </View>
        </View>
    </KeyboardSafeForm>
  );
}

export { ErrorBoundary } from '@/src/components/ErrorBoundary';
