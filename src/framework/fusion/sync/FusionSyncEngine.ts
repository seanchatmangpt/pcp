import { FrameworkSyncEngine } from '../../sync/engine';
import { SyncJobBase } from '../../sync/types';
import { MeshSyncEngine, MeshMessage } from '../../sync/p2p/types';
import { CompressionStrategy } from '../../sync/compression/types';
import {
  CollaborativeWorkspace,
  CollaborativeWorkspaceConfig,
} from '../../compositions/collaborative-state/CollaborativeWorkspace';
import { LWWMapState } from '../../sync/crdt/types';

export interface FusionSyncEngineConfig<TJob extends SyncJobBase> {
  /** The standard outbox sync engine for server communication */
  standardEngine: FrameworkSyncEngine<TJob>;
  /** The P2P mesh sync engine for peer communication */
  meshEngine: MeshSyncEngine;
  /** The compression strategy for payloads */
  compression: CompressionStrategy;
}

/**
 * FusionSyncEngine fuses CRDT-based collaborative state, P2P mesh networking,
 * and standard outbox-based synchronization with automatic payload compression.
 *
 * It wraps the standard engine to automatically leverage P2P meshes,
 * compression, and CRDT map resolution simultaneously.
 */
export class FusionSyncEngine<TJob extends SyncJobBase> {
  private workspaces = new Map<string, CollaborativeWorkspace<any>>();
  private standardEngine: FrameworkSyncEngine<TJob>;
  private meshEngine: MeshSyncEngine;
  private compression: CompressionStrategy;

  constructor(config: FusionSyncEngineConfig<TJob>) {
    this.standardEngine = config.standardEngine;
    this.meshEngine = config.meshEngine;
    this.compression = config.compression;

    this.setupMeshListener();
  }

  /**
   * Sets up listeners for the P2P mesh network to handle incoming state updates.
   */
  private setupMeshListener() {
    const adapter = this.meshEngine.getAdapter();
    adapter.onMessage(async (message: MeshMessage) => {
      // Only handle sync_state messages with compressed payloads
      if (message.type === 'sync_state' && typeof message.payload.state === 'string') {
        try {
          const decompressed = await this.compression.decompress(message.payload.state);
          const state = JSON.parse(decompressed) as LWWMapState<any>;
          const workspace = this.workspaces.get(message.payload.id);

          if (workspace) {
            workspace.receiveUpdate(state);
          }
        } catch (error) {
          console.error('[FusionSyncEngine] Failed to process mesh message:', error);
        }
      }
    });
  }

  /**
   * Creates a new CollaborativeWorkspace that is automatically wired to the fusion layers.
   * Changes in the workspace will be compressed and broadcasted to both P2P and standard sync outbox.
   *
   * @param config Configuration for the workspace (excluding onSync which is handled by FusionSyncEngine)
   * @returns A new CollaborativeWorkspace instance
   */
  public async createWorkspace<T extends object>(
    config: Omit<CollaborativeWorkspaceConfig<T>, 'onSync'>
  ): Promise<CollaborativeWorkspace<T>> {
    const workspace = new CollaborativeWorkspace<T>({
      ...config,
      onSync: async (state) => {
        try {
          const serialized = JSON.stringify(state);
          const compressed = await this.compression.compress(serialized);

          // 1. Broadcast to P2P mesh for low-latency peer updates
          this.meshEngine.getAdapter().broadcast({
            type: 'sync_state',
            senderId: this.meshEngine.getAdapter().getLocalPeerId(),
            payload: { id: config.id, state: compressed },
            timestamp: Date.now(),
          });

          // 2. Queue in standard outbox engine for reliable server persistence
          await this.standardEngine.queueJob({
            jobType: 'fusion_sync',
            payload: compressed,
            entityId: config.id,
          } as any);
        } catch (error) {
          console.error('[FusionSyncEngine] Failed to sync workspace change:', error);
        }
      },
    });

    this.workspaces.set(config.id, workspace);
    return workspace;
  }

  /**
   * Retrieves a registered workspace by ID.
   */
  public getWorkspace<T extends object>(id: string): CollaborativeWorkspace<T> | undefined {
    return this.workspaces.get(id) as CollaborativeWorkspace<T> | undefined;
  }

  /**
   * Manually trigger a full sync for all registered workspaces.
   * Broadcasts the current state of each workspace across the mesh and triggers standard engine push.
   */
  public async syncAll(): Promise<void> {
    const syncPromises: Promise<void>[] = [];

    for (const [id, workspace] of this.workspaces.entries()) {
      const state = workspace.crdtState;
      const serialized = JSON.stringify(state);

      const p = (async () => {
        const compressed = await this.compression.compress(serialized);

        this.meshEngine.getAdapter().broadcast({
          type: 'sync_state',
          senderId: this.meshEngine.getAdapter().getLocalPeerId(),
          payload: { id, state: compressed },
          timestamp: Date.now(),
        });
      })();

      syncPromises.push(p);
    }

    await Promise.all(syncPromises);

    // Also trigger standard engine push to flush the outbox
    await this.standardEngine.pushChanges();
  }

  /**
   * Processes an incoming update from the standard sync engine (e.g. from server).
   * This should be called by the application layer when a sync job from the server is received.
   *
   * @param workspaceId The ID of the workspace the update belongs to
   * @param compressedPayload The compressed state payload
   */
  public async receiveStandardUpdate(
    workspaceId: string,
    compressedPayload: string
  ): Promise<void> {
    try {
      const decompressed = await this.compression.decompress(compressedPayload);
      const state = JSON.parse(decompressed) as LWWMapState<any>;
      const workspace = this.workspaces.get(workspaceId);

      if (workspace) {
        workspace.receiveUpdate(state);
      }
    } catch (error) {
      console.error('[FusionSyncEngine] Failed to process standard update:', error);
      throw error;
    }
  }

  /**
   * Gets the standard engine instance.
   */
  public getStandardEngine(): FrameworkSyncEngine<TJob> {
    return this.standardEngine;
  }

  /**
   * Gets the mesh engine instance.
   */
  public getMeshEngine(): MeshSyncEngine {
    return this.meshEngine;
  }
}
