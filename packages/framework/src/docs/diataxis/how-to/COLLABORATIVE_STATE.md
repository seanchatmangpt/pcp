# Creating Zero-Latency Collaborative State with CRDTs

This guide demonstrates how to implement real-time, multi-peer state synchronization using Pcp's Conflict-free Replicated Data Types (CRDTs).

## The Goal

Enable multiple users to edit shared state (e.g., a collaborative task board, shared settings, or cursor positions) that remains responsive offline and converges automatically without a central authority resolving conflicts.

## Prerequisites

- A unique `peerId` for each participant (retrieved from `useSession`).
- A transport layer to broadcast and receive state updates (e.g., WebSockets, WebRTC, or Pcp's `SyncEngine`).

## Step 1: Initialize a Collaborative Map

The `useLWWMap` (Last-Write-Wins Map) is the primary tool for managing shared key-value pairs.

```typescript
import React from 'react';
import { View, Button, Text } from 'react-native';
import { useLWWMap } from '@/src/framework/sync/crdt/hooks';
import { useSession } from '@/context/SessionProvider';

export function CollaborativeTaskBoard() {
  const { session } = useSession();
  const peerId = session?.user?.id || 'anonymous';

  // 1. Initialize the CRDT hook.
  // 'tasks' is the current state Record<string, LWWRegisterState<V>>
  // 'ops' contains atomic update methods (set, delete, get)
  // 'merge' integrates remote states into the local CRDT
  const [tasks, ops, merge] = useLWWMap<string>(peerId);

  const handleAddTask = (name: string) => {
    const taskId = Math.random().toString(36).substring(7);

    // 2. Local updates are instantaneous (zero latency)
    ops.set(taskId, name);

    // 3. Broadcast the local CRDT state to other peers
    // In a real app, you would send this over a WebSocket or Peer connection
    myTransport.broadcast(tasks);
  };

  return (
    <View className="p-4">
      {Object.entries(tasks).map(([id, register]) => (
        <Text key={id} className="text-lg">
          {register.value} (Last edited by: {register.peerId})
        </Text>
      ))}
      <Button title="Add Task" onPress={() => handleAddTask('New Task')} />
    </View>
  );
}
```

## Step 2: Handle Conflict Resolution

CRDTs resolve conflicts deterministically using mathematical invariants. `useLWWMap` uses a **Last-Write-Wins** (LWW) strategy.

### How it works:

1. **User A** sets `task_1` to "Design" at timestamp `100`.
2. **User B** sets `task_1` to "Implement" at timestamp `101`.
3. When User A merges User B's state, the CRDT compares timestamps.
4. Since `101 > 100`, "Implement" wins.
5. If timestamps are identical, the `peerId` (alphabetical sort) acts as a deterministic tie-breaker.

## Step 3: Synchronize with Remote Peers

To keep all participants in sync, you must merge incoming CRDT states received from the network.

```typescript
import { useEffect } from 'react';

// Inside your component:
useEffect(() => {
  const unsubscribe = myTransport.onMessage((remoteState) => {
    // Merging is idempotent and commutative.
    // Order of arrival does not affect the final result.
    merge(remoteState);
  });

  return () => unsubscribe();
}, [merge]);
```

## Step 4: Use Specialized Counters

For values that are updated concurrently by many users (like "Likes" or "Score"), use `usePNCounter`. Unlike a Map, a Counter ensures that every increment and decrement is accounted for, even if they happen simultaneously.

```typescript
import { usePNCounter } from '@/src/framework/sync/crdt/hooks';

function SharedCounter({ peerId }) {
  const [count, ops, merge] = usePNCounter(peerId);

  return (
    <Button
      title={`Likes: ${count}`}
      onPress={() => ops.increment()}
    />
  );
}
```

## Advanced: Custom State with `useCrdtState`

If the built-in hooks don't fit your needs, use the generic `useCrdtState` to wrap any class implementing the `CRDT` interface.

```typescript
import { useCrdtState } from '@/src/framework/sync/crdt/hooks';
import { MyCustomCRDT } from './MyCustomCRDT';

const [value, crdt, merge] = useCrdtState((pid) => new MyCustomCRDT(pid), peerId);
```

## 2030 Best Practices

- **Pre-Admission Tension:** Use CRDTs to capture user intent immediately (the "Tension" phase). This state is eventually settled against the authoritative **Truex Kernel**.
- **Deterministic Convergence:** Always prefer `useLWWMap` or `usePNCounter` over standard `useState` for any data that crosses the network boundary.
- **Tombstone Awareness:** In `LWWMap`, deleting a key creates a "tombstone" (a record of deletion) to ensure the delete propagates to peers. Be mindful of state size in high-churn environments.
- **Offline Resilience:** CRDTs are perfectly suited for offline-first apps. Users can continue making changes while disconnected; those changes will automatically merge when connectivity is restored.
