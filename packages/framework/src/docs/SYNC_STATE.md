# Sync and State Layers

The Pcp Framework SDK provides a robust, offline-first synchronization and state management system. It is designed to handle complex distributed state across multiple peers and servers with zero-latency conflict resolution and efficient data propagation.

## Architecture Overview

The Sync and State layers are composed of several specialized modules:

- **`sync/crdt`**: Conflict-free Replicated Data Types for zero-latency state merging.
- **`sync/p2p`**: Peer-to-Peer mesh networking for low-latency peer updates.
- **`sync/compression`**: Intelligent payload compression to minimize bandwidth usage.
- **`sync/replay`**: Diagnostic tools for recording and replaying sync events.
- **`state/storage`**: Isolated, persistent storage adapters for local-first caches.

---

## Conflict-Free Replicated Data Types (CRDTs)

Pcp leverages state-based CRDTs to ensure that all peers eventually converge on the same state without requiring a central coordinator for every change. This enables "zero-latency" conflict resolution: local updates are applied immediately and merged with remote updates deterministically.

### Supported CRDT Primitives

1.  **LWWRegister (Last-Write-Wins Register)**:
    - Stores a single value.
    - Each update is timestamped.
    - The value with the highest timestamp wins.
    - Peer ID acts as a tie-breaker for equal timestamps.

2.  **PNCounter (Positive-Negative Counter)**:
    - A counter that can be incremented and decremented.
    - Internally uses two Grow-only Counters (G-Counters) to track increments and decrements separately.
    - Value is calculated as `sum(increments) - sum(decrements)`.

3.  **LWWMap (Last-Write-Wins Map)**:
    - A key-value map where each value is managed by an `LWWRegister`.
    - Enables collaborative editing of complex objects by merging individual fields.

### `useCrdtState` Hook

The `useCrdtState` hook (and its specialized variants like `useLWWRegister`, `usePNCounter`, and `useLWWMap`) provides a seamless way to integrate CRDTs into React components.

**How-to Guide:** [Creating Zero-Latency Collaborative State with CRDTs](./diataxis/how-to/COLLABORATIVE_STATE.md)

```typescript
import { useLWWMap, usePNCounter } from '@/src/framework/sync/crdt/hooks';

const MyComponent = ({ peerId }) => {
  // Manage a collaborative counter
  const [count, ops, merge] = usePNCounter(peerId, 0);

  // Manage a collaborative map
  const [profile, profileOps, profileMerge] = useLWWMap<string>(peerId);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => ops.increment()}>+1</button>
      <button onClick={() => ops.decrement()}>-1</button>

      <p>Name: {profile.name?.value}</p>
      <button onClick={() => profileOps.set('name', 'Pcp Developer')}>
        Set Name
      </button>
    </div>
  );
};
```

---

## P2P Mesh Sync

The P2P Mesh Sync layer enables peers to synchronize state directly with each other over a transport-agnostic mesh network. This bypasses the server for real-time collaboration, reducing latency and server load.

### Key Concepts

- **MeshNetworkAdapter**: Abstracts the underlying transport (WebRTC, Bluetooth, etc.).
- **MeshSyncEngine**: Orchestrates the periodic or event-driven broadcasting of CRDT states or deltas across the mesh.
- **Low Latency**: Updates are broadcasted immediately to all connected peers in the mesh.

---

## Payload Compression

To optimize sync performance in low-bandwidth environments, Pcp automatically compresses sync payloads.

- **`sync/compression`**: Employs strategies like Gzip or Brotli (depending on the environment) to shrink JSON-serialized CRDT states.
- **`usePayloadCompression`**: A hook to handle compression/decompression of state updates before they are sent over the wire or stored.

---

## FusionSyncEngine

The `FusionSyncEngine` is the orchestrator that "fuses" all layers together. It manages:

1.  **Standard Outbox**: Reliable HTTP-based sync to the server.
2.  **P2P Mesh**: Low-latency peer-to-peer updates.
3.  **CRDT State**: Automatic merging of incoming updates from both sources.
4.  **Compression**: Transparent compression for all outgoing payloads.

### Code Example: Setting up FusionSyncEngine

```typescript
import { FusionSyncEngine } from '@/src/framework/fusion/sync';
import { FrameworkSyncEngine } from '@/src/framework/sync/engine';
import { MeshSyncEngineImpl } from '@/src/framework/sync/p2p/engine';
import { GzipCompressionStrategy } from '@/src/framework/sync/compression/strategies';

const fusionEngine = new FusionSyncEngine({
  standardEngine: myStandardOutboxEngine,
  meshEngine: new MeshSyncEngineImpl(meshAdapter),
  compression: new GzipCompressionStrategy(),
});

// Create a collaborative workspace
const workspace = await fusionEngine.createWorkspace({
  id: 'document-123',
  peerId: 'peer-abc',
  initialState: {},
});

// Any changes made here are automatically:
// 1. Merged locally
// 2. Compressed
// 3. Broadcasted to the P2P mesh
// 4. Queued for reliable server sync
workspace.setFieldValue('content', 'Hello, Pcp!');
```

---

## Sync Replay and Diagnostics

The `sync/replay` module provides a "time-travel" debugging experience for sync operations.

- **`SyncReplayManager`**: Records every sync event (success, failure, conflict) along with a snapshot of the sync queue.
- **`SyncReplayDebugger`**: A UI component that allows developers to scrub through the history of sync events to diagnose edge cases and race conditions.

---

## State Storage

The `state/storage` layer provides isolated MMKV instances for persistent state.

- **`createStorageAdapter(storeId)`**: Creates a Zustand-compatible storage adapter backed by MMKV.
- **Isolation**: Each `storeId` gets its own MMKV file, ensuring that local-first caches for different parts of the application do not interfere with each other.

```typescript
import { createStorageAdapter } from '@/src/framework/state/storage';

const { storage } = createStorageAdapter('user-profile-cache');

// Use with Zustand
const useStore = create(
  persist(
    (set) => ({ ... }),
    {
      name: 'profile-storage',
      storage: storage,
    }
  )
);
```
