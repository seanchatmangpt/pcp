import { StubMeshAdapter } from '../adapter';

describe('StubMeshAdapter', () => {
  it('should have a local peer id', () => {
    const adapter = new StubMeshAdapter('test-peer');
    expect(adapter.getLocalPeerId()).toBe('test-peer');
  });

  it('should manage peers', () => {
    const adapter = new StubMeshAdapter();
    const peer = { id: 'peer-1', lastSeen: Date.now() };

    let foundPeer: any = null;
    adapter.onPeerFound((p) => {
      foundPeer = p;
    });

    adapter.simulatePeerFound(peer);
    expect(foundPeer).toEqual(peer);
    expect(adapter.getPeers()).toContainEqual(peer);

    let lostPeerId: string | null = null;
    adapter.onPeerLost((id) => {
      lostPeerId = id;
    });

    adapter.simulatePeerLost('peer-1');
    expect(lostPeerId).toBe('peer-1');
    expect(adapter.getPeers()).toHaveLength(0);
  });

  it('should handle messages', () => {
    const adapter = new StubMeshAdapter();
    const message = {
      type: 'heartbeat' as any,
      senderId: 'remote',
      payload: {},
      timestamp: Date.now(),
    };

    let received: any = null;
    adapter.onMessage((m) => {
      received = m;
    });

    adapter.simulateIncomingMessage(message);
    expect(received).toEqual(message);
  });

  it('should support unsubscribing', () => {
    const adapter = new StubMeshAdapter();
    let count = 0;
    const unsub = adapter.onMessage(() => {
      count++;
    });

    adapter.simulateIncomingMessage({} as any);
    expect(count).toBe(1);

    unsub();
    adapter.simulateIncomingMessage({} as any);
    expect(count).toBe(1);
  });
});
