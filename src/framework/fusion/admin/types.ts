import { MembraneTopology } from '../../admin/telemetry-3d/types';

export interface FusionErrorLog {
  id: string;
  timestamp: number;
  error: Error;
  status: 'pending' | 'fixed' | 'ignored';
}

export interface FusionAdminConsoleProps {
  /** Initial topology for the 3D visualization */
  topology: MembraneTopology;
  /** Initial error logs for the auto-fix console */
  initialErrorLogs?: FusionErrorLog[];
  /** Callback when a node in the 3D graph is clicked */
  onNodeClick?: (nodeId: string) => void;
  /** Callback when the back button is pressed */
  onBack?: () => void;
  /** Optional test identifier */
  testID?: string;
}
