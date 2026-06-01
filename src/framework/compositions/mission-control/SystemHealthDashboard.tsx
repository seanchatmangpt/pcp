import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppVitals } from '../../admin/metrics/useAppVitals';

export interface SystemHealthDashboardProps {
  testID?: string;
}

/**
 * SystemHealthDashboard component provides a high-level overview of application vitals.
 * It monitors JS and UI thread performance along with memory consumption.
 */
export const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({
  testID = 'system-health-dashboard',
}) => {
  const vitals = useAppVitals({ updateInterval: 1000, enabled: true });

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>System Health</Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          label="JS THREAD"
          value={vitals.jsFps}
          unit="FPS"
          status={vitals.jsFps > 45 ? 'healthy' : vitals.jsFps > 20 ? 'warning' : 'critical'}
          testID={`${testID}-js-fps`}
        />
        <MetricCard
          label="UI THREAD"
          value={vitals.uiFps}
          unit="FPS"
          status={vitals.uiFps > 55 ? 'healthy' : vitals.uiFps > 30 ? 'warning' : 'critical'}
          testID={`${testID}-ui-fps`}
        />
        <MetricCard
          label="MEMORY"
          value={vitals.memory.toFixed(1)}
          unit="MB"
          status={vitals.memory < 200 ? 'healthy' : vitals.memory < 500 ? 'warning' : 'critical'}
          testID={`${testID}-memory`}
        />
      </View>
    </View>
  );
};

interface MetricCardProps {
  label: string;
  value: number | string;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  testID?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, status, testID }) => {
  const statusColor =
    status === 'healthy' ? '#10B981' : status === 'warning' ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: statusColor }]}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <View style={[styles.indicator, { backgroundColor: statusColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B', // slate-800
    borderRadius: 16,
    padding: 20,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  unit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 4,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
