import { CRDT } from '../crdt/types';

/**
 * Represents a peer in the mesh network.
 */
export interface Peer {
  id: string;
  name?: string;
  metadata?: Record<string, any>;
  lastSeen: number;
}

/**
 * Types of messages that can be exchanged in the mesh.
 */
export type MeshMessageType = 'sync_state' | 'sync_delta' | 'peer_discovery' | 'heartbeat';

/**
 * Envelope for mesh messages.
 */
export interface MeshMessage<TPayload = any> {
  type: MeshMessageType;
  senderId: string;
  payload: TPayload;
  timestamp: number;
}

/**
 * Interface for the transport layer of the mesh sync.
 * Can be implemented via WebRTC, Local Network (mDNS/UDP), or even Bluetooth.
 */
export interface MeshNetworkAdapter {
  /**
   * Start the network adapter.
   */
  start(): Promise<void>;

  /**
   * Stop the network adapter.
   */
  stop(): Promise<void>;

  /**
   * Broadcast a message to all connected peers.
   */
  broadcast(message: MeshMessage): Promise<void>;

  /**
   * Send a message to a specific peer.
   */
  sendTo(peerId: string, message: MeshMessage): Promise<void>;

  /**
   * Subscribe to incoming messages.
   */
  onMessage(callback: (message: MeshMessage) => void): () => void;

  /**
   * Subscribe to peer discovery events.
   */
  onPeerFound(callback: (peer: Peer) => void): () => void;

  /**
   * Subscribe to peer disconnection events.
   */
  onPeerLost(callback: (peerId: string) => void): () => void;

  /**
   * Get the list of currently connected peers.
   */
  getPeers(): Peer[];

  /**
   * Get the local peer ID.
   */
  getLocalPeerId(): string;
}

/**
 * Configuration for the Mesh Sync Engine.
 */
export interface MeshSyncEngineConfig {
  /**
   * How often to broadcast state/deltas (in ms).
   * If omitted, sync is only triggered by local changes.
   */
  syncInterval?: number;
  /**
   * Whether to sync the full state or just deltas.
   */
  syncStrategy?: 'full' | 'delta';
  /**
   * Causal window constraint enforcement. If a delta is older than 5 minutes (or specific window),
   * this callback is triggered instead of auto-merging the state, handing control to Governance.
   */
  onCausalWindowViolation?: (message: MeshMessage) => void;
}

/**
 * Interface for the Mesh Sync Engine.
 */
export interface MeshSyncEngine {
  /**
   * Registers a CRDT for mesh synchronization.
   */
  registerCrdt(id: string, crdt: CRDT<any, any>): void;

  /**
   * Manually triggers a sync across the mesh.
   */
  sync(): Promise<void>;

  /**
   * Gets the network adapter used by the engine.
   */
  getAdapter(): MeshNetworkAdapter;
}

/**
 * State returned by the useMeshSync hook.
 */
export interface MeshSyncState {
  peers: Peer[];
  isOnline: boolean;
  lastSyncTimestamp: number | null;
}
