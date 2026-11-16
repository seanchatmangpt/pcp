import { ExtremeSyncAdapter, SyncExtremeMode } from '../types';

/**
 * QuantumSyncAdapter simulates instantaneous state sharing using
 * non-local quantum entanglement patterns.
 * While purely simulated in current hardware, it provides the API
 * for the 2030 Pcp Quantum Layer.
 */
export class QuantumSyncAdapter implements ExtremeSyncAdapter {
  public readonly mode = SyncExtremeMode.QUANTUM;
  private listeners: ((workspaceId: string, payload: string) => void)[] = [];

  public async broadcast(workspaceId: string, payload: string): Promise<void> {
    // Quantum entanglement is "instantaneous" (modeled as < 1ms)
    console.log(`[QuantumSyncAdapter] State collapsed for ${workspaceId} across entangled pair`);

    // In simulation, we might have a global registry of peers to "instantly" notify
    return Promise.resolve();
  }

  public onUpdate(callback: (workspaceId: string, payload: string) => void): void {
    this.listeners.push(callback);
  }

  public getStatus(): 'connected' | 'degraded' | 'disconnected' {
    // Quantum state is either 'connected' or 'disconnected' (decoherence)
    return 'connected';
  }

  /**
   * Internal method to simulate a quantum state collapse (incoming update).
   */
  public simulateIncomingUpdate(workspaceId: string, payload: string): void {
    this.listeners.forEach((cb) => cb(workspaceId, payload));
  }
}
