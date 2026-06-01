# Setting up P2P Mesh Sync for Extreme Environments

This guide demonstrates how to configure the Pcp Framework for resilient, peer-to-peer (P2P) synchronization in extreme environments where cloud connectivity is unavailable or restricted. You will learn how to implement a custom local network adapter and orchestrate synchronization using the `MeshSyncEngine`.

## Goal

Establish a zero-trust, local-only synchronization mesh between devices using UDP broadcasting or similar local discovery protocols.

## Prerequisites

- Pcp Framework SDK core modules.
- Basic familiarity with CRDTs (Conflict-free Replicated Data Types).
- Node.js or React Native environment with access to network primitives.

## Step 1: Implement a Custom Network Adapter

The `MeshSyncEngine` requires a `MeshNetworkAdapter` to handle transport. In extreme environments, you often need to use local protocols like UDP, Bluetooth, or mDNS.

```typescript
import { MeshNetworkAdapter, MeshMessage, Peer } from '@pcp/framework/sync/p2p/types';

/**
 * A resilient UDP Broadcast adapter for local-only mesh discovery.
 * Note: This implementation assumes a hypothetical 'udp-socket' library.
 */
export class UDPBroadcastAdapter implements MeshNetworkAdapter {
  private peerId: string = crypto.randomUUID();
  private listeners: Set<(msg: MeshMessage) => void> = new Set();

  async start() {
    // 1. Initialize UDP socket on port 5555
    // 2. Start heartbeating for discovery
    console.info(`[Mesh] Started UDP adapter: ${this.peerId}`);
  }

  async stop() {
    // Close sockets and cleanup
  }

  async broadcast(message: MeshMessage) {
    // Serialize and send via UDP broadcast (e.g., 255.255.255.255)
    const data = JSON.stringify(message);
    // await udp.send(data, 5555, '255.255.255.255');
  }

  async sendTo(peerId: string, message: MeshMessage) {
    // Unicast to a specific peer's IP if known
  }

  onMessage(callback: (message: MeshMessage) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Implementation of onPeerFound, onPeerLost, getPeers, etc...
  onPeerFound(callback: (peer: Peer) => void) {
    return () => {};
  }
  onPeerLost(callback: (peerId: string) => void) {
    return () => {};
  }
  getPeers(): Peer[] {
    return [];
  }
  getLocalPeerId(): string {
    return this.peerId;
  }
}
```

## Step 2: Initialize the Mesh Sync Engine

With your adapter ready, instantiate the `MeshSyncEngineImpl`. This engine acts as the conductor for all synchronized data types.

```typescript
import { MeshSyncEngineImpl } from '@pcp/framework/sync/p2p/engine';

// 1. Instantiate your custom adapter
const adapter = new UDPBroadcastAdapter();

// 2. Configure the engine for aggressive local sync
const engine = new MeshSyncEngineImpl(adapter, {
  syncInterval: 5000, // 5 second heartbeat
  syncStrategy: 'delta', // Prefer deltas to save bandwidth
});

// 3. Start the transport layer
await adapter.start();
```

## Step 3: Register CRDTs for Synchronization

The engine synchronizes any object implementing the `CRDT` interface. You must register these objects with a unique ID across the mesh.

```typescript
import { LWWRegister } from '@pcp/framework/sync/crdt/register';

// Create a state container (e.g., for environmental sensor data)
const sensorData = new LWWRegister<number>(0);

// Register it with the engine
engine.registerCrdt('station-01-temp', sensorData);

// Now, any change to sensorData will be broadcast to the mesh
// during the next sync cycle.
sensorData.set(24.5);
```

## Step 4: Manual Synchronization (Optional)

In extremely unstable environments, you may want to trigger manual syncs based on physical events (e.g., a hardware signal or user interaction).

```typescript
// Force an immediate synchronization of all registered CRDTs
await engine.sync();
```

## Best Practices for 2030 Mesh Networks

- **Delta-First Sync:** Always prefer `syncStrategy: 'delta'` to minimize radio usage and battery drain.
- **Peer Entropy:** Use high-entropy Peer IDs to prevent collisions in ad-hoc networks.
- **Frequency Scaling:** Adjust `syncInterval` dynamically based on battery level or signal quality.

## Next Steps

- [Securing Mesh Communication with WireGuard](./SECURE_MESH.md)
- [Handling Partition Healing in Large Meshes](./PARTITION_RECOVERY.md)
