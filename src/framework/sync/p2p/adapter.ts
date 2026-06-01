import { MeshMessage, MeshNetworkAdapter, Peer } from './types';

/**
 * A stub implementation of the MeshNetworkAdapter.
 * In a real scenario, this would use WebRTC, UDP discovery, or Bluetooth.
 */
export class StubMeshAdapter implements MeshNetworkAdapter {
  private peers: Map<string, Peer> = new Map();
  private messageCallbacks: ((message: MeshMessage) => void)[] = [];
  private peerFoundCallbacks: ((peer: Peer) => void)[] = [];
  private peerLostCallbacks: ((peerId: string) => void)[] = [];
  private peerId: string;

  constructor(peerId: string = Math.random().toString(36).substring(7)) {
    this.peerId = peerId;
  }

  public async start(): Promise<void> {
    console.log(`[Mesh] Adapter started for peer: ${this.peerId}`);
  }

  public async stop(): Promise<void> {
    console.log(`[Mesh] Adapter stopped for peer: ${this.peerId}`);
  }

  public async broadcast(message: MeshMessage): Promise<void> {
    // In a real stub, we might want to simulate delivery to other instances in the same process
    // For now, we just log it.
    console.debug(`[Mesh] Broadcasting message from ${this.peerId}`, message);
  }

  public async sendTo(peerId: string, message: MeshMessage): Promise<void> {
    console.debug(`[Mesh] Sending message from ${this.peerId} to ${peerId}`, message);
  }

  public onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }

  public onPeerFound(callback: (peer: Peer) => void): () => void {
    this.peerFoundCallbacks.push(callback);
    return () => {
      this.peerFoundCallbacks = this.peerFoundCallbacks.filter((cb) => cb !== callback);
    };
  }

  public onPeerLost(callback: (peerId: string) => void): () => void {
    this.peerLostCallbacks.push(callback);
    return () => {
      this.peerLostCallbacks = this.peerLostCallbacks.filter((cb) => cb !== callback);
    };
  }

  public getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  public getLocalPeerId(): string {
    return this.peerId;
  }

  // Helper for testing/simulation
  public simulatePeerFound(peer: Peer) {
    this.peers.set(peer.id, peer);
    this.peerFoundCallbacks.forEach((cb) => cb(peer));
  }

  public simulatePeerLost(peerId: string) {
    this.peers.delete(peerId);
    this.peerLostCallbacks.forEach((cb) => cb(peerId));
  }

  public simulateIncomingMessage(message: MeshMessage) {
    this.messageCallbacks.forEach((cb) => cb(message));
  }
}
