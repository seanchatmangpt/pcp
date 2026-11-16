/**
 * @fileoverview Account Management Screen
 * Provides user profile management functionality including username, website, and avatar URL editing.
 * Integrates with Supabase for secure profile data persistence and includes developer tools.
 *
 * @author Your Name
 * @version 1.1.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { AlertManager as Alert } from '@/src/framework/ui/dialog/AlertManager';
import { Tabs } from '@/src/components/AvatarRelativeProjection';
import { useSession } from '@/context/SessionProvider';
import { mmkvInstance } from '@/src/lib/store/mmkvStorage';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardSafeForm } from '@/src/components/KeyboardSafeForm';
import { AdaptivePressable } from '@/src/framework/auto/ux/adaptive/AdaptivePressable';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { useHaptics } from '@/src/framework/ui/haptics/useHaptics';
import { HapticFeedbackPattern } from '@/src/framework/ui/haptics/IntelligentHaptics';

const AVATAR_PRESETS = [
  {
    id: '1',
    name: 'Ava',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
  },
  {
    id: '2',
    name: 'Leo',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  },
  {
    id: '3',
    name: 'Zoe',
    url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  },
  {
    id: '4',
    name: 'Sam',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  },
  {
    id: '5',
    name: 'Mia',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
  },
  {
    id: '6',
    name: 'Ben',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=face',
  },
];

// Validation functions declared outside the component to avoid recreation on each render
const validateUsername = (val: string): string | null => {
  const trimmed = val.trim();
  if (!trimmed) {
    return 'Username is required';
  }
  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (trimmed.length > 20) {
    return 'Username must be at most 20 characters';
  }
  const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return 'Username can only contain alphanumeric characters, underscores, hyphens, and periods';
  }
  return null;
};

const validateWebsite = (val: string): string | null => {
  const trimmed = val.trim();
  if (!trimmed) {
    return null;
  }
  const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i;
  if (!urlRegex.test(trimmed)) {
    return 'Please enter a valid website URL';
  }
  return null;
};

const validateAvatarUrl = (val: string): string | null => {
  const trimmed = val.trim();
  if (!trimmed) {
    return null;
  }
  const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i;
  if (!urlRegex.test(trimmed)) {
    return 'Please enter a valid image URL';
  }
  return null;
};

export default function Account() {
  const { session } = useSession();
  const haptics = useHaptics();

  // Profile fields state
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [username, setUsername] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Focus states
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isWebsiteFocused, setIsWebsiteFocused] = useState(false);
  const [isAvatarFocused, setIsAvatarFocused] = useState(false);

  // Error states
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleUsernameChange = useCallback((val: string) => {
    setUsername(val);
    setUsernameError(validateUsername(val));
  }, []);

  const handleWebsiteChange = useCallback((val: string) => {
    setWebsite(val);
    setWebsiteError(validateWebsite(val));
  }, []);

  const handleAvatarUrlChange = useCallback((val: string) => {
    setAvatarUrl(val);
    setImageError(false);
    setAvatarError(validateAvatarUrl(val));
  }, []);

  const handleUsernameBlur = useCallback(() => {
    setIsUsernameFocused(false);
    setUsernameError(validateUsername(username));
  }, [username]);

  const handleWebsiteBlur = useCallback(() => {
    setIsWebsiteFocused(false);
    setWebsiteError(validateWebsite(website));
  }, [website]);

  const handleAvatarBlur = useCallback(() => {
    setIsAvatarFocused(false);
    setAvatarError(validateAvatarUrl(avatarUrl));
  }, [avatarUrl]);

  // Picker modal and state
  const [showPicker, setShowPicker] = useState(false);
  const [imageError, setImageError] = useState(false);

  // App Toggles state (Simulated preferences backed by MMKV / Zustand)
  const [darkMode, setDarkMode] = useState(false);
  const [saveLogs, setSaveLogs] = useState(false);
  const [mmkvKeysCount, setMmkvKeysCount] = useState(0);

  // Global actor ops Zustand store state
  const networkOnline = useActorOpsStore((state) => state.networkOnline);
  const remoteRejectActive = useActorOpsStore((state) => state.remoteRejectActive);
  const setNetworkOnline = useActorOpsStore((state) => state.setNetworkOnline);
  const setRemoteRejectActive = useActorOpsStore((state) => state.setRemoteRejectActive);

  // Load user profile and configuration settings on mount / session change
  useEffect(() => {
    async function getProfile() {
      try {
        setLoading(true);
        if (!session?.user) return;

        const { data, error, status } = await supabase
          .from('profiles')
          .select(`username, website, avatar_url`)
          .eq('id', session.user.id)
          .single();

        if (error && status !== 406) {
          throw error;
        }

        if (data) {
          setUsername(data.username || '');
          setWebsite(data.website || '');
          setAvatarUrl(data.avatar_url || '');
          setImageError(false);
          setUsernameError(null);
          setWebsiteError(null);
          setAvatarError(null);
        }
      } catch (error) {
        if (error instanceof Error) {
          Alert.alert('Error loading profile', error.message);
        }
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      getProfile();
    }

    // Load MMKV-backed simulation preferences
    try {
      setDarkMode(mmkvInstance.getBoolean('sim_dark_mode') || false);
      setSaveLogs(mmkvInstance.getBoolean('sim_save_logs') || false);
      setMmkvKeysCount(mmkvInstance.getAllKeys().length);
    } catch (e) {
      console.warn('Failed to read MMKV keys:', e);
    }
  }, [session?.user?.id]);

  const refreshMMKVKeyCount = useCallback(() => {
    try {
      setMmkvKeysCount(mmkvInstance.getAllKeys().length);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // Update profile database record
  const handleUpdateProfile = useCallback(async () => {
    try {
      if (!session?.user) throw new Error('No user on the session!');

      const uError = validateUsername(username);
      const wError = validateWebsite(website);
      const aError = validateAvatarUrl(avatarUrl);

      setUsernameError(uError);
      setWebsiteError(wError);
      setAvatarError(aError);

      if (uError || wError || aError) {
        haptics.trigger(HapticFeedbackPattern.ERROR);
        Alert.alert('Validation Error', 'Please correct the highlighted errors before saving.');
        return;
      }

      setUpdating(true);

      const updates = {
        id: session.user.id,
        username,
        website,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        haptics.trigger(HapticFeedbackPattern.ERROR);
        throw error;
      }
      haptics.trigger(HapticFeedbackPattern.SUCCESS);
      Alert.alert('Success', 'Profile updated successfully!');
      refreshMMKVKeyCount();
    } catch (error) {
      haptics.trigger(HapticFeedbackPattern.ERROR);
      if (error instanceof Error) {
        Alert.alert('Error updating profile', error.message);
      }
    } finally {
      setUpdating(false);
    }
  }, [session?.user?.id, username, website, avatarUrl, refreshMMKVKeyCount, haptics]);

  // Get user initials for avatar fallback placeholder
  const initials = useMemo(() => {
    if (username && username.trim()) {
      return username.trim().slice(0, 2).toUpperCase();
    }
    if (session?.user?.email) {
      return session?.user?.email.slice(0, 2).toUpperCase();
    }
    return '??';
  }, [username, session?.user?.email]);

  // Toggle handlers that persist to local MMKV instance
  const handleToggleDarkMode = useCallback(
    (value: boolean) => {
      haptics.trigger(HapticFeedbackPattern.LIGHT);
      setDarkMode(value);
      mmkvInstance.set('sim_dark_mode', value);
      refreshMMKVKeyCount();
    },
    [refreshMMKVKeyCount, haptics]
  );

  const handleToggleSaveLogs = useCallback(
    (value: boolean) => {
      haptics.trigger(HapticFeedbackPattern.LIGHT);
      setSaveLogs(value);
      mmkvInstance.set('sim_save_logs', value);
      refreshMMKVKeyCount();
    },
    [refreshMMKVKeyCount, haptics]
  );

  // Developer debugging reset procedures
  const handleClearMMKV = useCallback(() => {
    Alert.alert(
      'Clear MMKV Cache ⚠️',
      'This will clear all fast key-value caches stored in the Zustand/Zoe persistence storage. This does not affect remote Supabase database. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            try {
              haptics.trigger(HapticFeedbackPattern.HEAVY);
              mmkvInstance.clearAll();
              Alert.alert('Success', 'MMKV Storage successfully wiped.');
              setMmkvKeysCount(0);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to clear MMKV');
            }
          },
        },
      ]
    );
  }, [haptics]);

  const handleResetZustand = useCallback(() => {
    Alert.alert(
      'Reset Zustand Store 🔄',
      'This will restore all local sync outboxes, quarantine queue counters, and simulation toggles back to default values.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Store State',
          onPress: () => {
            try {
              haptics.trigger(HapticFeedbackPattern.HEAVY);
              setNetworkOnline(true);
              setRemoteRejectActive(false);
              useActorOpsStore.getState().setLatestReceipt(null);
              useActorOpsStore.getState().setLatestEvent(null);
              useActorOpsStore.getState().setCounts(0, 0);
              Alert.alert('Success', 'Zustand operations store reset.');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Reset failed');
            }
          },
        },
      ]
    );
  }, [setNetworkOnline, setRemoteRejectActive, haptics]);

  const handleClearAsyncStorage = useCallback(() => {
    Alert.alert(
      'Clear AsyncStorage 💾',
      'This clears traditional async-storage items, such as authentication sessions, token indices, and caches.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              haptics.trigger(HapticFeedbackPattern.HEAVY);
              await AsyncStorage.clear();
              Alert.alert('Success', 'AsyncStorage flushed.');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Flush failed');
            }
          },
        },
      ]
    );
  }, [haptics]);

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 text-base mt-4">Loading profile context...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <KeyboardSafeForm
        style={{ flex: 1 }}
        className="bg-background"
        contentContainerStyle={{ paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      >
        <Tabs.Screen options={{ title: 'Account Settings' }} />

        {/* Header and Avatar Projection Card */}
        <View className="bg-card border-b border-border pb-6 pt-4">
          <View className="items-center px-6">
            <View className="relative">
              {avatarUrl && !imageError ? (
                <Image
                  testID="avatar-image"
                  source={{ uri: avatarUrl }}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-md"
                  onError={() => setImageError(true)}
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 items-center justify-center border-4 border-white shadow-md bg-blue-600">
                  <Text className="text-white text-3xl font-bold tracking-wider">{initials}</Text>
                </View>
              )}
              <Pressable
                testID="camera-toggle"
                onPress={() => setShowPicker(!showPicker)}
                className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full border-2 border-white shadow active:bg-blue-700"
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Toggle avatar selection tray"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="camera-outline" size={16} color="white" />
              </Pressable>
            </View>
            <Text className="text-xl font-bold text-text mt-4">
              {username || 'Anonymous User'}
            </Text>
            <Text className="text-sm text-gray-500 mt-1">{session?.user?.email}</Text>
            <View className="mt-2 bg-green-50 border border-green-200 rounded-full px-3 py-1 flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              <Text className="text-xs text-green-700 font-medium">Verified Active Principal</Text>
            </View>
          </View>

          {/* Dynamic Avatar Picker Tray */}
          {showPicker && (
            <View className="mt-6 px-6 py-4 bg-background border-t border-b border-border">
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                Select Preset Avatar
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {AVATAR_PRESETS.map((preset) => (
                  <Pressable
                    key={preset.id}
                    testID={`preset-avatar-${preset.id}`}
                    onPress={() => {
                      setAvatarUrl(preset.url);
                      setImageError(false);
                    }}
                    className={`mr-4 p-1 rounded-full border-2 ${
                      avatarUrl === preset.url ? 'border-blue-600 bg-blue-50' : 'border-transparent'
                    }`}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Select avatar preset ${preset.id}`}
                    accessibilityState={{ selected: avatarUrl === preset.url }}
                  >
                    <Image source={{ uri: preset.url }} className="w-14 h-14 rounded-full" />
                  </Pressable>
                ))}
              </ScrollView>

              <View className="mt-4">
                <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Custom Avatar Image URL
                </Text>
                <TextInput
                  testID="custom-avatar-input"
                  className={`border rounded-lg p-2 text-sm text-text bg-card ${
                    isAvatarFocused
                      ? 'border-blue-500'
                      : avatarError
                        ? 'border-red-400'
                        : 'border-border'
                  }`}
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChangeText={handleAvatarUrlChange}
                  onFocus={() => setIsAvatarFocused(true)}
                  onBlur={() => {
                    setIsAvatarFocused(false);
                    setAvatarError(validateAvatarUrl(avatarUrl));
                  }}
                  autoCapitalize="none"
                  accessibilityLabel="Custom Avatar Image URL"
                  accessibilityHint="Enter the URL for your avatar image"
                />
                {avatarError && (
                  <Text
                    testID="avatar-error"
                    className="text-red-500 text-xs mt-1 font-medium px-1"
                  >
                    {avatarError}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Settings row groups */}
        <View className="px-4 mt-6">
          {/* GROUP 1: Profile Details */}
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
            Profile Details
          </Text>
          <View className="bg-card rounded-xl shadow-sm border border-border overflow-hidden mb-6">
            <View className="p-4 border-b border-border">
              <Text className="text-xs font-medium text-gray-400 uppercase">Username</Text>
              <TextInput
                testID="username-input"
                className={`text-base text-text font-medium py-2 px-3 mt-1 bg-background/50 rounded-lg border ${
                  isUsernameFocused
                    ? 'border-blue-500 bg-card'
                    : usernameError
                      ? 'border-red-400 bg-red-50/5'
                      : 'border-border'
                }`}
                value={username}
                onChangeText={handleUsernameChange}
                onFocus={() => setIsUsernameFocused(true)}
                onBlur={() => {
                  setIsUsernameFocused(false);
                  setUsernameError(validateUsername(username));
                }}
                placeholder="Enter username"
                placeholderTextColor="#475569"
                accessibilityLabel="Username"
                accessibilityHint="Enter your username"
              />
              {usernameError && (
                <Text
                  testID="username-error"
                  className="text-red-500 text-xs mt-1 font-medium px-1"
                >
                  {usernameError}
                </Text>
              )}
            </View>
            <View className="p-4">
              <Text className="text-xs font-medium text-gray-400 uppercase">Website</Text>
              <TextInput
                testID="website-input"
                className={`text-base text-text font-medium py-2 px-3 mt-1 bg-background/50 rounded-lg border ${
                  isWebsiteFocused
                    ? 'border-blue-500 bg-card'
                    : websiteError
                      ? 'border-red-400 bg-red-50/5'
                      : 'border-border'
                }`}
                value={website}
                onChangeText={handleWebsiteChange}
                onFocus={() => setIsWebsiteFocused(true)}
                onBlur={handleWebsiteBlur}
                placeholder="https://yourwebsite.com"
                placeholderTextColor="#475569"
                keyboardType="url"
                autoCapitalize="none"
                accessibilityLabel="Website"
                accessibilityHint="Enter your website URL"
              />
              {websiteError && (
                <Text testID="website-error" className="text-red-500 text-xs mt-1 font-medium px-1">
                  {websiteError}
                </Text>
              )}
            </View>
          </View>

          {/* Update Trigger Button */}
          <TouchableOpacity
            testID="save-profile-button"
            onPress={handleUpdateProfile}
            disabled={updating || !networkOnline}
            className={`rounded-xl py-3.5 px-6 flex-row justify-center items-center shadow-sm mb-6 ${
              updating || !networkOnline ? 'bg-gray-300' : 'bg-blue-600 active:bg-blue-700'
            }`}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
            accessibilityState={{ disabled: updating || !networkOnline }}
          >
            <Ionicons name="save-outline" size={18} color="white" style={{ marginRight: 8 }} />
            <Text className="text-white font-bold text-center text-base">
              {updating ? 'Updating database...' : 'Save Profile Changes'}
            </Text>
          </TouchableOpacity>

          {!networkOnline && (
            <Text
              testID="account-offline-help"
              className="text-center text-xs text-amber-600 font-semibold mb-4"
            >
              Profile updates require network connection.
            </Text>
          )}

          {/* GROUP 2: App & Node Configurations */}
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
            Simulation Settings
          </Text>
          <View className="bg-card rounded-xl shadow-sm border border-border overflow-hidden mb-6">
            {/* Custom Switch: Mock Offline Mode */}
            <View className="p-4 border-b border-border flex-row justify-between items-center">
              <View className="flex-1 pr-4">
                <Text className="text-sm font-semibold text-text">Simulate Offline Mode</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Disconnect from synchronization drivers
                </Text>
              </View>
              <Pressable
                testID="toggle-offline"
                onPress={() => {
                  haptics.trigger(HapticFeedbackPattern.LIGHT);
                  setNetworkOnline(!networkOnline);
                }}
                className={`w-12 h-7 rounded-full p-1 ${!networkOnline ? 'bg-yellow-500' : 'bg-gray-200'}`}
                accessible={true}
                accessibilityRole="switch"
                accessibilityLabel="Simulate Offline Mode"
                accessibilityState={{ checked: !networkOnline }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                    !networkOnline ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </Pressable>
            </View>

            {/* Custom Switch: Mock Remote Rejection */}
            <View className="p-4 border-b border-border flex-row justify-between items-center">
              <View className="flex-1 pr-4">
                <Text className="text-sm font-semibold text-text">Mock Remote Rejections</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Force sync engine to reject local events
                </Text>
              </View>
              <Pressable
                testID="toggle-rejections"
                onPress={() => {
                  haptics.trigger(HapticFeedbackPattern.LIGHT);
                  setRemoteRejectActive(!remoteRejectActive);
                }}
                className={`w-12 h-7 rounded-full p-1 ${remoteRejectActive ? 'bg-red-500' : 'bg-gray-200'}`}
                accessible={true}
                accessibilityRole="switch"
                accessibilityLabel="Mock Remote Rejections"
                accessibilityState={{ checked: remoteRejectActive }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                    remoteRejectActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </Pressable>
            </View>

            {/* Custom Switch: Dark Mode Simulation */}
            <View className="p-4 border-b border-border flex-row justify-between items-center">
              <View className="flex-1 pr-4">
                <Text className="text-sm font-semibold text-text">Dark Mode Interface</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Simulate client dark mode container layouts
                </Text>
              </View>
              <Pressable
                testID="toggle-dark-mode"
                onPress={() => handleToggleDarkMode(!darkMode)}
                className={`w-12 h-7 rounded-full p-1 ${darkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                accessible={true}
                accessibilityRole="switch"
                accessibilityLabel="Dark Mode Interface"
                accessibilityState={{ checked: darkMode }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                    darkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </Pressable>
            </View>

            {/* Custom Switch: Log Capture Settings */}
            <View className="p-4 flex-row justify-between items-center">
              <View className="flex-1 pr-4">
                <Text className="text-sm font-semibold text-text">
                  Save Local Transaction Logs
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Persist event logs to disk caches
                </Text>
              </View>
              <Pressable
                testID="toggle-save-logs"
                onPress={() => handleToggleSaveLogs(!saveLogs)}
                className={`w-12 h-7 rounded-full p-1 ${saveLogs ? 'bg-blue-600' : 'bg-gray-200'}`}
                accessible={true}
                accessibilityRole="switch"
                accessibilityLabel="Save Local Transaction Logs"
                accessibilityState={{ checked: saveLogs }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                    saveLogs ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </Pressable>
            </View>
          </View>

          {/* GROUP 3: Developer Tools & Diagnostics */}
          <View className="mb-2 ml-1 flex-row items-center">
            <Ionicons name="warning-outline" size={14} color="#EF4444" />
            <Text className="text-xs font-bold text-red-600 uppercase tracking-wider ml-1">
              Developer Diagnostics & Resets (Danger Zone)
            </Text>
          </View>
          <View className="bg-red-50/10 rounded-xl shadow-sm border-2 border-red-100 overflow-hidden mb-6">
            <View className="p-4 border-b border-red-50 flex-row justify-between items-center bg-red-50/30">
              <Text className="text-sm font-semibold text-gray-700">MMKV State Keys</Text>
              <View className="bg-gray-200 rounded-full px-2.5 py-0.5">
                <Text className="text-xs font-bold text-gray-800">{mmkvKeysCount}</Text>
              </View>
            </View>

            <Pressable
              testID="clear-mmkv-button"
              onPress={handleClearMMKV}
              className="p-4 border-b border-red-50 flex-row items-center active:bg-red-50/50"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Clear MMKV Storage"
            >
              <Ionicons
                name="trash-bin-outline"
                size={18}
                color="#EF4444"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-red-600">Clear MMKV Storage</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Clear all fast key-value Zustand stores
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
            </Pressable>

            <Pressable
              testID="reset-zustand-button"
              onPress={handleResetZustand}
              className="p-4 border-b border-red-50 flex-row items-center active:bg-red-50/50"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Reset Zustand Store States"
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color="#2563EB"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-blue-600">
                  Reset Zustand Store States
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Re-initialize outboxes & synchronizers
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#BFDBFE" />
            </Pressable>

            <Pressable
              testID="clear-async-storage-button"
              onPress={handleClearAsyncStorage}
              className="p-4 flex-row items-center active:bg-red-50/50"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Clear AsyncStorage Cache"
            >
              <Ionicons
                name="cloud-offline-outline"
                size={18}
                color="#D97706"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-amber-600">
                  Clear AsyncStorage Cache
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Flush authentication details & tokens
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FDE68A" />
            </Pressable>
          </View>

          {/* GROUP 4: Danger Zone */}
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
            Session Authority
          </Text>
          <View className="bg-card rounded-xl shadow-sm border border-border overflow-hidden mb-6">
            <Pressable
              onPress={() => {
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: () => {
                      haptics.trigger(HapticFeedbackPattern.MEDIUM);
                      supabase.auth.signOut();
                    },
                  },
                ]);
              }}
              className="p-4 flex-row items-center justify-between bg-red-50/50 active:bg-red-100/50"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Sign Out"
            >
              <View className="flex-row items-center">
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color="#DC2626"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-sm font-semibold text-red-700">Sign Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
            </Pressable>
          </View>
        </View>

        {/* Footer Details */}
        <View className="mt-4 px-6">
          <Text className="text-center text-xs text-gray-400 leading-5">
            Truex Membrane Client Client v1.1.0{'\n'}
            Database Sync State secured with Supabase Auth
          </Text>
        </View>
      </KeyboardSafeForm>
    </View>
  );
}

export { ErrorBoundary } from '@/src/components/ErrorBoundary';
