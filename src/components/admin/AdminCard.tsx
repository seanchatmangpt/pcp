import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../framework/ui/theme/useTheme';

interface AdminCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  headerRight?: React.ReactNode;
  testID?: string;
}

export function AdminCard({
  title,
  subtitle,
  children,
  style,
  headerRight,
  testID,
}: AdminCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      testID={testID}
    >
      {(title || subtitle || headerRight) && (
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerText}>
            {title && (
              <Text
                style={[styles.title, { color: theme.colors.text }]}
                testID={`${testID}-title`}
                accessibilityRole="header"
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                style={[styles.subtitle, { color: theme.colors.secondary }]}
                testID={`${testID}-subtitle`}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {headerRight && <View testID={`${testID}-header-right`}>{headerRight}</View>}
        </View>
      )}
      <View style={styles.content} testID={`${testID}-content`}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B', // slate-800
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155', // slate-700
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155', // slate-700
    paddingBottom: 12,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC', // slate-50
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8', // slate-400
    marginTop: 4,
  },
  content: {
    width: '100%',
  },
});
