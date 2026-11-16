import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from './useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AutoFixer } from '../framework/ui/auto-fix/AutoFixer';

export interface ErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useColorScheme();
  const router = useRouter();
  const isDark = theme === 'dark';

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  const handleClearCache = async () => {
    try {
      await AsyncStorage.clear();
      if (Platform.OS === 'web') {
        window.location.reload();
      } else {
        retry();
      }
    } catch (e) {
      retry();
    }
  };

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
        </View>
        <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
          Unexpected Application Error
        </Text>
        <Text style={[styles.subtitle, isDark ? styles.subtextDark : styles.subtextLight]}>
          The application encountered an unexpected error. Your data has been preserved, but you
          may need to restart the app.
        </Text>

        <View style={[styles.errorBox, isDark ? styles.errorBoxDark : styles.errorBoxLight]}>
          <ScrollView style={styles.errorScroll} nestedScrollEnabled>
            <Text style={[styles.errorText, isDark ? styles.errorTextDark : styles.errorTextLight]}>
              {error?.name || 'Error'}: {error?.message || 'Unknown Error'}
            </Text>
            {error?.stack && (
              <Text
                style={[styles.stackText, isDark ? styles.stackTextDark : styles.stackTextLight]}
              >
                {error.stack}
              </Text>
            )}
          </ScrollView>
        </View>

        {__DEV__ && (
          <View style={styles.autoFixerSection}>
            <AutoFixer error={error} onReset={retry} />
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            testID="error-boundary-retry-button"
            onPress={retry}
            style={[styles.button, styles.retryButton]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Try Again"
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="error-boundary-clear-cache-button"
            onPress={handleClearCache}
            style={[
              styles.button,
              styles.clearButton,
              isDark ? styles.clearButtonDark : styles.clearButtonLight,
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Clear Cache & Reload"
          >
            <Ionicons
              name="trash-outline"
              size={16}
              color={isDark ? '#FCA5A5' : '#B91C1C'}
              style={styles.buttonIcon}
            />
            <Text
              style={[
                styles.clearButtonText,
                isDark ? styles.clearButtonTextDark : styles.clearButtonTextLight,
              ]}
            >
              Clear Cache & Reload
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="error-boundary-home-button"
            onPress={handleGoHome}
            style={[
              styles.button,
              styles.homeButton,
              isDark ? styles.homeButtonDark : styles.homeButtonLight,
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go to Home"
          >
            <Ionicons
              name="home"
              size={16}
              color={isDark ? '#E2E8F0' : '#475569'}
              style={styles.buttonIcon}
            />
            <Text
              style={[
                styles.homeButtonText,
                isDark ? styles.homeButtonTextDark : styles.homeButtonTextLight,
              ]}
            >
              Go to Home
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  containerLight: {
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
  },
  iconContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  subtextLight: {
    color: '#64748B',
  },
  subtextDark: {
    color: '#94A3B8',
  },
  errorBox: {
    width: '100%',
    maxHeight: 180,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  errorBoxLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  errorBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  errorScroll: {
    flexGrow: 0,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorTextLight: {
    color: '#B91C1C',
  },
  errorTextDark: {
    color: '#FCA5A5',
  },
  stackText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  stackTextLight: {
    color: '#475569',
  },
  stackTextDark: {
    color: '#94A3B8',
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  retryButton: {
    backgroundColor: '#3B82F6',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  clearButton: {
    borderWidth: 1,
  },
  clearButtonLight: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  clearButtonDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#7F1D1D',
  },
  clearButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  clearButtonTextLight: {
    color: '#B91C1C',
  },
  clearButtonTextDark: {
    color: '#FCA5A5',
  },
  homeButton: {
    borderWidth: 1,
  },
  homeButtonLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  homeButtonDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  homeButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  homeButtonTextLight: {
    color: '#475569',
  },
  homeButtonTextDark: {
    color: '#E2E8F0',
  },
  buttonIcon: {
    marginRight: 6,
  },
  autoFixerSection: {
    width: '100%',
    marginBottom: 16,
  },
});
