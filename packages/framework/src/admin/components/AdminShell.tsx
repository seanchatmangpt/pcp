import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export interface AdminNavigationItem {
  name: string;
  id: string; // unique identifier
}

export interface AdminShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scrollable?: boolean;
  navigationItems?: AdminNavigationItem[];
  activeNavigationId?: string;
  onNavigate?: (item: AdminNavigationItem) => void;
  onBack?: () => void;
  headerBanner?: React.ReactNode;
  testID?: string;
}

export function AdminShell({
  title,
  subtitle,
  children,
  scrollable = true,
  navigationItems = [],
  activeNavigationId,
  onNavigate,
  onBack,
  headerBanner,
  testID,
}: AdminShellProps) {
  const ContentContainer = scrollable ? ScrollView : View;

  return (
    <SafeAreaView style={styles.safeArea} className="bg-background" testID={testID}>
      <View style={styles.container}>
        {headerBanner}
        {/* Header */}
        <View style={styles.header} className="bg-background border-b border-border">
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              testID={testID ? `${testID}-back-btn` : 'admin-back-btn'}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <FontAwesome name="arrow-left" size={16} color="#3B82F6" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTitleContainer}>
            <Text
              style={styles.title}
              className="text-text"
              numberOfLines={1}
              accessibilityRole="header"
              testID={testID ? `${testID}-title` : 'admin-shell-title'}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={styles.subtitle}
                className="text-secondary"
                numberOfLines={1}
                accessibilityRole="header"
                testID={testID ? `${testID}-subtitle` : 'admin-shell-subtitle'}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Quick Admin Navigation Bar */}
        {navigationItems.length > 0 && (
          <View style={styles.navRow} className="bg-background border-b border-border">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.navScroll}
            >
              {navigationItems.map((item) => {
                const isActive = activeNavigationId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => onNavigate && onNavigate(item)}
                    style={[styles.navButton, isActive && styles.navButtonActive]}
                    className={isActive ? 'bg-primary/15 border-primary' : 'bg-card border-border'}
                    activeOpacity={0.7}
                    testID={testID ? `${testID}-nav-${item.id}` : `nav-${item.id}`}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} navigation button`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[styles.navButtonText, isActive && styles.navButtonTextActive]}
                      className={isActive ? 'text-text' : 'text-secondary'}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Workspace */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ContentContainer
            style={styles.content}
            className="bg-background"
            contentContainerStyle={scrollable ? styles.scrollContent : undefined}
            keyboardShouldPersistTaps="handled"
            testID={testID ? `${testID}-content` : 'admin-shell-content'}
          >
            {children}
          </ContentContainer>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginRight: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  navRow: {
    borderBottomWidth: 1,
  },
  navScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  navButtonActive: {
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  navButtonTextActive: {
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
});
