import { MeshSyncEngineImpl } from '../engine';
import { StubMeshAdapter } from '../adapter';
import { LWWRegister } from '../../crdt/register';

describe('MeshSyncEngine', () => {
  let adapter: StubMeshAdapter;
  let engine: MeshSyncEngineImpl;

  beforeEach(() => {
    adapter = new StubMeshAdapter('peer-local');
    engine = new MeshSyncEngineImpl(adapter);
  });

  afterEach(() => {
    engine.stop();
  });

  it('should register and sync a CRDT state', async () => {
    const reg = new LWWRegister('peer-local', 'initial');
    engine.registerCrdt('reg-1', reg);

    const broadcastSpy = jest.spyOn(adapter, 'broadcast');

    await engine.sync();

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sync_state',
        payload: { id: 'reg-1', state: expect.objectContaining({ value: 'initial' }) },
      })
    );
  });

  it('should handle incoming sync_state messages', () => {
    const reg = new LWWRegister('peer-local', 'initial');
    engine.registerCrdt('reg-1', reg);

    adapter.simulateIncomingMessage({
      type: 'sync_state',
      senderId: 'peer-remote',
      payload: {
        id: 'reg-1',
        state: { value: 'remote-value', timestamp: Date.now() + 1000, peerId: 'peer-remote' },
      },
      timestamp: Date.now(),
    });

    expect(reg.value).toBe('remote-value');
  });

  it('should handle delta sync strategy', async () => {
    // Note: LWWRegister currently doesn't implement DeltaCRDT interface explicitly in its class definition
    // but the engine checks for 'generateDelta' in crdt.
    // Let's mock a DeltaCRDT
    const mockDeltaCrdt = {
      state: 'state',
      merge: jest.fn(),
      toJSON: jest.fn().mockReturnValue('state'),
      generateDelta: jest.fn().mockReturnValue('delta'),
      resetDelta: jest.fn(),
    };

    const deltaEngine = new MeshSyncEngineImpl(adapter, { syncStrategy: 'delta' });
    deltaEngine.registerCrdt('delta-1', mockDeltaCrdt as any);

    const broadcastSpy = jest.spyOn(adapter, 'broadcast');
    await deltaEngine.sync();

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sync_delta',
        payload: { id: 'delta-1', delta: 'delta' },
      })
    );
    expect(mockDeltaCrdt.resetDelta).toHaveBeenCalled();
  });

  it('should not process its own messages', () => {
    const reg = new LWWRegister('peer-local', 'initial');
    engine.registerCrdt('reg-1', reg);
    const mergeSpy = jest.spyOn(reg, 'merge');

    adapter.simulateIncomingMessage({
      type: 'sync_state',
      senderId: 'peer-local', // Same as adapter
      payload: {
        id: 'reg-1',
        state: { value: 'ignored', timestamp: Date.now(), peerId: 'peer-local' },
      },
      timestamp: Date.now(),
    });

    expect(mergeSpy).not.toHaveBeenCalled();
  });

  it('should start a sync timer if interval is provided', () => {
    jest.useFakeTimers();
    const timerAdapter = new StubMeshAdapter('timer-peer');
    const syncSpy = jest.spyOn(MeshSyncEngineImpl.prototype, 'sync');
    const timerEngine = new MeshSyncEngineImpl(timerAdapter, { syncInterval: 1000 });

    jest.advanceTimersByTime(1000);
    expect(syncSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(syncSpy).toHaveBeenCalledTimes(2);

    timerEngine.stop();
    jest.useRealTimers();
  });

  it('should intercept outdated messages via onCausalWindowViolation and not merge them', () => {
    const violationMock = jest.fn();
    const strictEngine = new MeshSyncEngineImpl(adapter, {
      onCausalWindowViolation: violationMock,
    });
    const reg = new LWWRegister('peer-local', 'initial');
    strictEngine.registerCrdt('reg-1', reg);

    const outdatedTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago (violates 5 min window)

    adapter.simulateIncomingMessage({
      type: 'sync_state',
      senderId: 'peer-remote',
      payload: {
        id: 'reg-1',
        state: { value: 'remote-value', timestamp: outdatedTimestamp, peerId: 'peer-remote' },
      },
      timestamp: outdatedTimestamp,
    });

    // Should intercept via callback
    expect(violationMock).toHaveBeenCalled();

    // Should NOT merge the state automatically
    expect(reg.value).toBe('initial');

    strictEngine.stop();
  });
});
