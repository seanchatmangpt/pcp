import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AdminShell, AdminNavigationItem } from '../../admin/components/AdminShell';
import { TelemetryGraph3D } from '../../admin/telemetry-3d/TelemetryGraph3D';
import { SystemHealthDashboard } from '../../compositions/mission-control/SystemHealthDashboard';
import { AutoFixer } from '../../ui/auto-fix/AutoFixer';
import { FusionAdminConsoleProps, FusionErrorLog } from './types';

const NAV_ITEMS: AdminNavigationItem[] = [
  { id: 'vitals', name: 'System Vitals' },
  { id: 'telemetry', name: '3D Telemetry' },
  { id: 'autofix', name: 'Auto-Fix Logs' },
];

/**
 * FusionAdminConsole fuses Mission Control, 3D Telemetry, and Auto-Fix
 * into a single cohesive developer dashboard.
 */
export const FusionAdminConsole: React.FC<FusionAdminConsoleProps> = ({
  topology,
  initialErrorLogs = [],
  onNodeClick,
  onBack,
  testID = 'fusion-admin-console',
}) => {
  const [activeTab, setActiveTab] = useState<string>('vitals');
  const [errorLogs, setErrorLogs] = useState<FusionErrorLog[]>(initialErrorLogs);

  const handleNavigate = (item: AdminNavigationItem) => {
    setActiveTab(item.id);
  };

  const handleResetError = (id: string) => {
    setErrorLogs((prev) =>
      prev.map((log) => (log.id === id ? { ...log, status: 'fixed' as const } : log))
    );
  };

  const pendingErrors = useMemo(
    () => errorLogs.filter((log) => log.status === 'pending'),
    [errorLogs]
  );

  return (
    <AdminShell
      title="Fusion Admin"
      subtitle="Unified Intelligent Control Plane"
      onBack={onBack}
      navigationItems={NAV_ITEMS}
      activeNavigationId={activeTab}
      onNavigate={handleNavigate}
      testID={testID}
      scrollable={activeTab !== 'telemetry'}>
      <View style={styles.container}>
        {activeTab === 'vitals' && (
          <View testID={`${testID}-vitals-tab`}>
            <SystemHealthDashboard testID={`${testID}-health`} />
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Fusion Status</Text>
              <Text style={styles.cardText}>
                Intelligent layers are currently synchronized. All systems operational.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'telemetry' && (
          <View style={styles.telemetryContainer} testID={`${testID}-telemetry-tab`}>
            <TelemetryGraph3D
              topology={topology}
              onNodeClick={onNodeClick}
              testID={`${testID}-graph`}
            />
          </View>
        )}

        {activeTab === 'autofix' && (
          <View testID={`${testID}-autofix-tab`}>
            <Text style={styles.sectionTitle}>Intelligent Repair Queue</Text>
            {pendingErrors.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No pending issues detected.</Text>
              </View>
            ) : (
              <ScrollView style={styles.errorList}>
                {pendingErrors.map((log) => (
                  <View key={log.id} style={styles.errorItem}>
                    <View style={styles.errorHeader}>
                      <Text style={styles.errorTimestamp}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                      <Text style={styles.errorId}>{log.id}</Text>
                    </View>
                    <AutoFixer error={log.error} onReset={() => handleResetError(log.id)} />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </AdminShell>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  telemetryContainer: {
    flex: 1,
    height: 500,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 16,
    marginTop: 8,
  },
  errorList: {
    flex: 1,
  },
  errorItem: {
    marginBottom: 24,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  errorTimestamp: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  errorId: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#334155',
  },
  emptyStateText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
