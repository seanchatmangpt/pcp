import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { MeshSyncProvider, useMeshSync } from '../hooks';
import { MeshSyncEngineImpl } from '../engine';
import { StubMeshAdapter } from '../adapter';
import { LWWRegister } from '../../crdt/register';

describe('useMeshSync', () => {
  let adapter: StubMeshAdapter;
  let engine: MeshSyncEngineImpl;

  beforeEach(() => {
    adapter = new StubMeshAdapter('peer-local');
    engine = new MeshSyncEngineImpl(adapter);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MeshSyncProvider engine={engine}>{children}</MeshSyncProvider>
  );

  it('should register CRDT and track peers', () => {
    const reg = new LWWRegister('peer-local', 'initial');
    const { result } = renderHook(() => useMeshSync('reg-1', reg), { wrapper });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.peers).toHaveLength(0);

    act(() => {
      adapter.simulatePeerFound({ id: 'peer-remote', lastSeen: Date.now() });
    });

    expect(result.current.peers).toHaveLength(1);
    expect(result.current.peers[0].id).toBe('peer-remote');
  });

  it('should update lastSyncTimestamp on incoming messages', () => {
    const reg = new LWWRegister('peer-local', 'initial');
    const { result } = renderHook(() => useMeshSync('reg-1', reg), { wrapper });

    const timestamp = Date.now();
    act(() => {
      adapter.simulateIncomingMessage({
        type: 'sync_state',
        senderId: 'peer-remote',
        payload: {
          id: 'reg-1',
          state: { value: 'remote', timestamp: timestamp + 100, peerId: 'peer-remote' },
        },
        timestamp: timestamp,
      });
    });

    expect(result.current.lastSyncTimestamp).toBe(timestamp);
  });

  it('should ignore messages for other CRDTs', () => {
    const reg = new LWWRegister('peer-local', 'initial');
    const { result } = renderHook(() => useMeshSync('reg-1', reg), { wrapper });

    act(() => {
      adapter.simulateIncomingMessage({
        type: 'sync_state',
        senderId: 'peer-remote',
        payload: { id: 'other-reg', state: {} },
        timestamp: Date.now(),
      });
    });

    expect(result.current.lastSyncTimestamp).toBeNull();
  });
});
