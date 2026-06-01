import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
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
    <SafeAreaView style={styles.safeArea} testID={testID}>
      <View style={styles.container}>
        {headerBanner}
        {/* Header */}
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              testID={testID ? `${testID}-back-btn` : 'admin-back-btn'}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <FontAwesome name="arrow-left" size={16} color="#3B82F6" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTitleContainer}>
            <Text
              style={styles.title}
              numberOfLines={1}
              accessibilityRole="header"
              testID={testID ? `${testID}-title` : 'admin-shell-title'}>
              {title}
            </Text>
            {subtitle && (
              <Text
                style={styles.subtitle}
                numberOfLines={1}
                accessibilityRole="header"
                testID={testID ? `${testID}-subtitle` : 'admin-shell-subtitle'}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Quick Admin Navigation Bar */}
        {navigationItems.length > 0 && (
          <View style={styles.navRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.navScroll}>
              {navigationItems.map((item) => {
                const isActive = activeNavigationId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => onNavigate && onNavigate(item)}
                    style={[styles.navButton, isActive && styles.navButtonActive]}
                    activeOpacity={0.7}
                    testID={testID ? `${testID}-nav-${item.id}` : `nav-${item.id}`}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} navigation button`}
                    accessibilityState={{ selected: isActive }}>
                    <Text style={[styles.navButtonText, isActive && styles.navButtonTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Workspace */}
        <ContentContainer
          style={styles.content}
          contentContainerStyle={scrollable ? styles.scrollContent : undefined}
          keyboardShouldPersistTaps="handled"
          testID={testID ? `${testID}-content` : 'admin-shell-content'}>
          {children}
        </ContentContainer>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A', // slate-900 base background
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
    borderBottomColor: '#1E293B', // slate-800
    backgroundColor: '#0F172A',
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
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  navRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
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
    backgroundColor: '#1E293B', // slate-800
    borderWidth: 1,
    borderColor: '#334155', // slate-700
  },
  navButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  navButtonTextActive: {
    color: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
});
