import { ExtremeSyncAdapter, SyncExtremeMode } from '../types';

/**
 * SatelliteSyncAdapter provides connectivity via Starlink-class
 * satellite constellations. It features high latency but ubiquitous coverage.
 */
export class SatelliteSyncAdapter implements ExtremeSyncAdapter {
  public readonly mode = SyncExtremeMode.SATELLITE;
  private listeners: ((workspaceId: string, payload: string) => void)[] = [];

  public async broadcast(workspaceId: string, payload: string): Promise<void> {
    // Simulated satellite uplink with variable latency (25ms - 500ms)
    const latency = Math.floor(Math.random() * 475) + 25;

    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(
          `[SatelliteSyncAdapter] Broadcasted ${payload.length} bytes for ${workspaceId} via Orbital Mesh`
        );
        resolve();
      }, latency);
    });
  }

  public onUpdate(callback: (workspaceId: string, payload: string) => void): void {
    this.listeners.push(callback);
  }

  public getStatus(): 'connected' | 'degraded' | 'disconnected' {
    // In 2030, satellite is almost always connected unless in deep cavern
    return 'connected';
  }

  /**
   * Internal method to simulate receiving a satellite downlink update.
   */
  public simulateIncomingUpdate(workspaceId: string, payload: string): void {
    this.listeners.forEach((cb) => cb(workspaceId, payload));
  }
}
