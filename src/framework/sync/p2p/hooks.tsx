import { useEffect, useState, useMemo, createContext, useContext, ReactNode } from 'react';
import { MeshSyncEngine, Peer, MeshSyncState } from './types';
import { MeshSyncEngineImpl } from './engine';
import { StubMeshAdapter } from './adapter';
import { CRDT } from '../crdt/types';

const MeshSyncContext = createContext<MeshSyncEngine | null>(null);

/**
 * Provider for the Mesh Sync Engine.
 * Typically placed at the root of the application or a specific feature branch.
 */
export const MeshSyncProvider = ({
  children,
  engine,
}: {
  children: ReactNode;
  engine?: MeshSyncEngine;
}) => {
  const defaultEngine = useMemo(() => {
    if (engine) return engine;
    const adapter = new StubMeshAdapter();
    return new MeshSyncEngineImpl(adapter, { syncInterval: 5000 });
  }, [engine]);

  return <MeshSyncContext.Provider value={defaultEngine}>{children}</MeshSyncContext.Provider>;
};

/**
 * Hook to participate in P2P Mesh Synchronization.
 *
 * @param id Unique identifier for the CRDT being synced.
 * @param crdt The CRDT instance to sync.
 * @returns Status of the mesh network.
 */
export function useMeshSync(id: string, crdt: CRDT<any, any>): MeshSyncState {
  const engine = useContext(MeshSyncContext);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(null);

  useEffect(() => {
    if (!engine) return;

    engine.registerCrdt(id, crdt);

    const adapter = engine.getAdapter();

    const updatePeers = () => {
      setPeers([...adapter.getPeers()]);
    };

    // Subscriptions
    const unsubFound = adapter.onPeerFound(() => {
      updatePeers();
    });
    const unsubLost = adapter.onPeerLost(() => {
      updatePeers();
    });

    // Initial state
    updatePeers();
    setIsOnline(true); // Stub is always online for now

    // Listen for incoming sync messages to update lastSyncTimestamp
    const unsubMessage = adapter.onMessage((msg) => {
      if (msg.type === 'sync_state' || msg.type === 'sync_delta') {
        if (msg.payload.id === id) {
          setLastSyncTimestamp(msg.timestamp);
        }
      }
    });

    return () => {
      unsubFound();
      unsubLost();
      unsubMessage();
    };
  }, [engine, id, crdt]);

  return {
    peers,
    isOnline,
    lastSyncTimestamp,
  };
}
