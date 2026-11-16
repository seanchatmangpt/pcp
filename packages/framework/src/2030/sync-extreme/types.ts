import { SyncJobBase } from '../../sync/types';
import { FusionSyncEngineConfig } from '../../fusion/sync/FusionSyncEngine';

/**
 * Extreme sync modes for ubiquitous connectivity in 2030.
 */
export enum SyncExtremeMode {
  SATELLITE = 'satellite',
  LORA = 'lora',
  QUANTUM = 'quantum',
}

/**
 * Interface for an extreme environment sync adapter.
 */
export interface ExtremeSyncAdapter {
  readonly mode: SyncExtremeMode;

  /**
   * Broadcast state update through the extreme channel.
   */
  broadcast(workspaceId: string, payload: string): Promise<void>;

  /**
   * Register a listener for incoming updates.
   */
  onUpdate(callback: (workspaceId: string, payload: string) => void): void;

  /**
   * Get current connectivity status.
   */
  getStatus(): 'connected' | 'degraded' | 'disconnected';
}

/**
 * Configuration for Quantum-Entangled (simulated) state sharing.
 */
export interface QuantumSyncConfig {
  entanglementId: string;
  simulationResolution?: number;
}

/**
 * Extended configuration for Extreme Fusion Sync.
 */
export interface ExtremeFusionSyncEngineConfig<
  TJob extends SyncJobBase,
> extends FusionSyncEngineConfig<TJob> {
  satelliteAdapter?: ExtremeSyncAdapter;
  loraAdapter?: ExtremeSyncAdapter;
  quantumAdapter?: ExtremeSyncAdapter;
}
