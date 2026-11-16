import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '../../framework/ui/theme/useTheme';

interface AdminMetricProps {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  iconColor?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  testID?: string;
}

export function AdminMetric({
  label,
  value,
  icon,
  iconColor = '#3B82F6',
  trend,
  trendDirection = 'neutral',
  testID,
}: AdminMetricProps) {
  const theme = useTheme();
  const trendColor =
    trendDirection === 'up' ? '#10B981' : trendDirection === 'down' ? '#FCA5A5' : '#94A3B8';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
      testID={testID}
      accessible={true}
      accessibilityLabel={`Metric: ${label}, Value: ${value}${trend ? `, trend: ${trend}` : ''}`}
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.colors.secondary }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.iconWrapper, { backgroundColor: iconColor + '20' }]}>
          <FontAwesome name={icon} size={16} color={iconColor} testID={`${testID}-icon`} />
        </View>
      </View>
      <Text style={[styles.value, { color: theme.colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      {trend ? (
        <Text style={[styles.trend, { color: trendColor }]} testID={`${testID}-trend`}>
          {trendDirection === 'up' && '▲ '}
          {trendDirection === 'down' && '▼ '}
          {trendDirection === 'neutral' && '— '}
          {trend}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B', // slate-800
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155', // slate-700
    padding: 16,
    flex: 1,
    minWidth: 140,
    margin: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: '#94A3B8', // slate-400
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 8,
  },
  iconWrapper: {
    padding: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC', // slate-50
  },
  trend: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
});
