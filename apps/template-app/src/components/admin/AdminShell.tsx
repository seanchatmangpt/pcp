import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { OfflineBanner } from '../OfflineBanner';

interface AdminShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scrollable?: boolean;
  testID?: string;
}

export function AdminShell({
  title,
  subtitle,
  children,
  scrollable = true,
  testID,
}: AdminShellProps) {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const ContentContainer = scrollable ? ScrollView : View;

  const navigationItems = [
    { name: 'Actor Lab', route: '/admin/actor-lab', title: 'Developer Actor Lab' },
    {
      name: 'ActorOps Console',
      route: '/admin/consequence-supervision',
      title: 'ActorOps Console',
    },
    { name: 'Process Intel', route: '/admin/intelligence', title: 'Process Intelligence' },
    { name: 'Outbox & Sync', route: '/admin/outbox', title: 'Outbox & Sync Manager' },
    { name: 'Receipt Audit', route: '/admin/receipts', title: 'Receipt Audit Logs' },
    { name: 'Realtime Channels', route: '/admin/realtime', title: 'Realtime Channels' },
    { name: 'Sermons Directory', route: '/admin/sermons', title: 'Sermons Directory' },
    { name: 'System Settings', route: '/admin/settings', title: 'System Settings' },
    { name: 'Church Profile', route: '/admin/church', title: 'Church Profile' },
    { name: 'Content Management', route: '/admin/content', title: 'Content Management' },
    { name: 'Calendar Events', route: '/admin/events', title: 'Church Calendar Events' },
    { name: 'Small Groups', route: '/admin/groups', title: 'Small Groups & Ministries' },
    { name: 'Pastoral Staff', route: '/admin/people', title: 'Pastoral Staff & Members' },
    { name: 'Prayer Requests', route: '/admin/prayer', title: 'Community Prayer Requests' },
    { name: 'Volunteers', route: '/admin/volunteers', title: 'Volunteer Assignments' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} className="bg-background" testID={testID}>
      <View style={styles.container}>
        <OfflineBanner />
        {/* Header */}
        <View style={styles.header} className="bg-background border-b border-border">
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            testID="admin-back-btn"
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <FontAwesome name="arrow-left" size={16} color="#3B82F6" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text
              style={styles.title}
              className="text-text"
              numberOfLines={1}
              accessibilityRole="header"
              testID="admin-shell-title"
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={styles.subtitle}
                className="text-secondary"
                numberOfLines={1}
                accessibilityRole="header"
                testID="admin-shell-subtitle"
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Quick Admin Navigation Bar */}
        <View style={styles.navRow} className="bg-background border-b border-border">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.navScroll}
          >
            {navigationItems.map((item) => {
              const isActive = title === item.title;
              return (
                <TouchableOpacity
                  key={item.name}
                  onPress={() => router.replace(item.route as any)}
                  style={[styles.navButton, isActive && styles.navButtonActive]}
                  className={isActive ? 'bg-primary/15 border-primary' : 'bg-card border-border'}
                  activeOpacity={0.7}
                  testID={`nav-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
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
