import { ExtremeSyncAdapter, SyncExtremeMode } from '../types';

/**
 * LoRaSyncAdapter provides ultra-long-range, low-power connectivity.
 * Ideal for remote wilderness or urban canyons with zero cellular/satellite.
 * Limited to very small payload bursts.
 */
export class LoRaSyncAdapter implements ExtremeSyncAdapter {
  public readonly mode = SyncExtremeMode.LORA;
  private listeners: ((workspaceId: string, payload: string) => void)[] = [];

  public async broadcast(workspaceId: string, payload: string): Promise<void> {
    // LoRa has extremely low bandwidth (bitrate)
    // We simulate a slow transmission of chunks
    const transmitTime = payload.length * 2; // 2ms per byte simulation

    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[LoRaSyncAdapter] Transmitted burst for ${workspaceId} over 868MHz/915MHz`);
        resolve();
      }, transmitTime);
    });
  }

  public onUpdate(callback: (workspaceId: string, payload: string) => void): void {
    this.listeners.push(callback);
  }

  public getStatus(): 'connected' | 'degraded' | 'disconnected' {
    // LoRa is often 'degraded' due to high interference or distance
    return 'degraded';
  }

  /**
   * Internal method to simulate receiving a LoRa packet.
   */
  public simulateIncomingUpdate(workspaceId: string, payload: string): void {
    this.listeners.forEach((cb) => cb(workspaceId, payload));
  }
}
