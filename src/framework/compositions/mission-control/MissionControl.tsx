import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AdminShell } from '../../admin/components/AdminShell';
import { TelemetryGraph3D } from '../../admin/telemetry-3d/TelemetryGraph3D';
import { SystemHealthDashboard } from './SystemHealthDashboard';
import { MembraneTopology } from '../../admin/telemetry-3d/types';

export interface MissionControlProps {
  topology: MembraneTopology;
  onNodeClick?: (nodeId: string) => void;
  onBack?: () => void;
  testID?: string;
}

/**
 * MissionControl is a high-level composition that integrates telemetry visualization
 * with system health monitoring within an AdminShell context.
 */
export const MissionControl: React.FC<MissionControlProps> = ({
  topology,
  onNodeClick,
  onBack,
  testID = 'mission-control',
}) => {
  return (
    <AdminShell
      title="Mission Control"
      subtitle="Membrane Topology & System Vitals"
      onBack={onBack}
      scrollable={true}
      testID={testID}>
      <View style={styles.content}>
        <SystemHealthDashboard testID={`${testID}-health`} />

        <View style={styles.graphContainer}>
          <TelemetryGraph3D
            topology={topology}
            onNodeClick={onNodeClick}
            testID={`${testID}-graph`}
          />
        </View>
      </View>
    </AdminShell>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  graphContainer: {
    height: 400,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
});
