import { MeshNetworkAdapter, MeshMessage, Peer } from '../../sync/p2p/types';

/**
 * SybilMeshAdapter is a Chaos Engineering tool designed to stress-test the MeshSyncEngine.
 * It simulates a "Sybil Attack" by forging thousands of malicious, causal-window breaking
 * and structurally malformed CRDT messages from spoofed peer identities.
 */
export class SybilMeshAdapter implements MeshNetworkAdapter {
  private localPeerId: string;
  private messageListeners: ((message: MeshMessage) => void)[] = [];
  private isRunning = false;

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
  }

  async start(): Promise<void> {
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  async broadcast(message: MeshMessage): Promise<void> {
    // In a real adapter, this would broadcast over UDP/WebRTC.
    // As a fuzzer, we don't care about outbound.
  }

  async sendTo(peerId: string, message: MeshMessage): Promise<void> {
    // No-op for fuzzer
  }

  onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  onPeerFound(callback: (peer: Peer) => void): () => void {
    return () => {};
  }
  onPeerLost(callback: (peerId: string) => void): () => void {
    return () => {};
  }
  getPeers(): Peer[] {
    return [];
  }
  getLocalPeerId(): string {
    return this.localPeerId;
  }

  /**
   * ADV_IMPL: Floods the local engine with simulated attacks.
   */
  public triggerSybilFlood(targetCrdtId: string, attackVolume: number = 1000) {
    if (!this.isRunning) return;

    for (let i = 0; i < attackVolume; i++) {
      const spoofedPeerId = `malicious_peer_${i}`;

      // Attack 1: Out-of-window timestamps (Simulating Split-Brain partition rejoins)
      const maliciouslyOldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago

      // Attack 2: Maxed out counter values (Integer overflow attacks)
      const maliciousState = {
        value: Number.MAX_SAFE_INTEGER,
        timestamp: maliciouslyOldTimestamp,
        peerId: spoofedPeerId,
      };

      const message: MeshMessage = {
        type: 'sync_state',
        senderId: spoofedPeerId,
        payload: { id: targetCrdtId, state: maliciousState },
        timestamp: maliciouslyOldTimestamp,
      };

      this.messageListeners.forEach((cb) => cb(message));
    }
  }

  /**
   * ADV_IMPL: Sends malformed JSON structures to break parsing loops.
   */
  public triggerMalformedFlood(targetCrdtId: string) {
    const message: MeshMessage = {
      type: 'sync_state',
      senderId: 'hacker_node',
      payload: { id: targetCrdtId, state: null as any }, // Corrupted state object
      timestamp: Date.now(),
    };
    this.messageListeners.forEach((cb) => cb(message));
  }
}
