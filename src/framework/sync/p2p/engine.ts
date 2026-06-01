import { CRDT, DeltaCRDT } from '../crdt/types';
import { MeshMessage, MeshNetworkAdapter, MeshSyncEngine, MeshSyncEngineConfig } from './types';

/**
 * Implementation of the Mesh Sync Engine.
 * Orchestrates synchronization of multiple CRDTs across a P2P mesh.
 */
export class MeshSyncEngineImpl implements MeshSyncEngine {
  private crdts = new Map<string, CRDT<any, any>>();
  private syncTimer: any = null;

  constructor(
    private adapter: MeshNetworkAdapter,
    private config: MeshSyncEngineConfig = {}
  ) {
    this.setupListeners();
    if (this.config.syncInterval) {
      this.startSyncTimer();
    }
  }

  private setupListeners() {
    this.adapter.onMessage((message: MeshMessage) => {
      this.handleIncomingMessage(message);
    });
  }

  private startSyncTimer() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.config.syncInterval);
  }

  /**
   * Registers a CRDT for mesh synchronization.
   */
  public registerCrdt(id: string, crdt: CRDT<any, any>): void {
    this.crdts.set(id, crdt);
  }

  /**
   * Manually triggers a sync across the mesh.
   */
  public async sync(): Promise<void> {
    const strategy = this.config.syncStrategy || 'full';

    for (const [id, crdt] of this.crdts.entries()) {
      if (strategy === 'delta' && 'generateDelta' in crdt) {
        const delta = (crdt as DeltaCRDT<any, any>).generateDelta();
        if (delta) {
          await this.adapter.broadcast({
            type: 'sync_delta',
            senderId: this.adapter.getLocalPeerId(),
            payload: { id, delta },
            timestamp: Date.now(),
          });
          (crdt as DeltaCRDT<any, any>).resetDelta();
        }
      } else {
        await this.adapter.broadcast({
          type: 'sync_state',
          senderId: this.adapter.getLocalPeerId(),
          payload: { id, state: crdt.toJSON() },
          timestamp: Date.now(),
        });
      }
    }
  }

  private handleIncomingMessage(message: MeshMessage) {
    const { type, payload, senderId, timestamp } = message;

    // Don't process our own messages
    if (senderId === this.adapter.getLocalPeerId()) return;

    if (type === 'sync_state' || type === 'sync_delta') {
      // Iron Law Constraint: Split-Brain / Causal Window check
      const CAUSAL_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
      const isOutdated = Date.now() - timestamp > CAUSAL_WINDOW_MS;

      if (isOutdated && this.config.onCausalWindowViolation) {
        // Intercepted by governance or manual verification UI
        this.config.onCausalWindowViolation(message);
        return;
      }

      const { id, state, delta } = payload;
      if (!state && !delta) return; // Drop malformed payloads

      const crdt = this.crdts.get(id);
      if (crdt) {
        crdt.merge(type === 'sync_state' ? state : delta);
      }
    }
  }

  public getAdapter(): MeshNetworkAdapter {
    return this.adapter;
  }

  public stop() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }
}
