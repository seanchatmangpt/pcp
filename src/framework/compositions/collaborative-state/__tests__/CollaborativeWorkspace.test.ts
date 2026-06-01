import { CollaborativeWorkspace } from '../CollaborativeWorkspace';
import { MembraneContext } from '@/src/lib/membrane/context';
import { LWWMapState } from '../../../sync/crdt/types';

interface TestState {
  title: string;
  count: number;
}

describe('CollaborativeWorkspace', () => {
  let context: MembraneContext;
  const initialConfig = {
    mode: 'strict' as const,
    tenantId: 'test-tenant',
    authorityRole: 'admin' as const,
  };

  beforeEach(() => {
    context = new MembraneContext(initialConfig);
    // Ensure we start with a fresh state for each test if there are any globals
  });

  it('initializes with the provided state', () => {
    const initialState: TestState = { title: 'Hello', count: 0 };
    const workspace = new CollaborativeWorkspace<TestState>({
      id: 'ws1',
      peerId: 'peer1',
      initialState,
      context,
    });

    expect(workspace.state.title).toBe('Hello');
    expect(workspace.state.count).toBe(0);
    expect(workspace.store.getState().title).toBe('Hello');
    expect(workspace.store.getState().count).toBe(0);

    const crdtState = workspace.crdtState;
    expect(crdtState.title.value).toBe('Hello');
    expect(crdtState.count.value).toBe(0);
  });

  it('updates CRDT and triggers onSync when state is mutated locally', () => {
    const initialState: TestState = { title: 'Hello', count: 0 };
    const onSync = jest.fn();
    const workspace = new CollaborativeWorkspace<TestState>({
      id: 'ws1',
      peerId: 'peer1',
      initialState,
      context,
      onSync,
    });

    workspace.state.title = 'Updated';

    expect(workspace.state.title).toBe('Updated');
    expect(workspace.store.getState().title).toBe('Updated');
    expect(workspace.crdtState.title.value).toBe('Updated');
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onSync).toHaveBeenCalledWith(workspace.crdtState);
  });

  it('merges remote updates and updates the store without triggering onSync', () => {
    const initialState: TestState = { title: 'Hello', count: 0 };
    const onSync = jest.fn();
    const workspace = new CollaborativeWorkspace<TestState>({
      id: 'ws1',
      peerId: 'peer1',
      initialState,
      context,
      onSync,
    });

    const remoteState: LWWMapState<any> = {
      title: {
        value: 'Remote Update',
        timestamp: Date.now() + 1000,
        peerId: 'peer2',
      },
    };

    workspace.receiveUpdate(remoteState);

    expect(workspace.state.title).toBe('Remote Update');
    expect(workspace.store.getState().title).toBe('Remote Update');
    expect(onSync).not.toHaveBeenCalled();
  });

  it('handles conflict resolution using LWW logic', () => {
    const initialState: TestState = { title: 'Hello', count: 0 };
    const workspace = new CollaborativeWorkspace<TestState>({
      id: 'ws1',
      peerId: 'peer1',
      initialState,
      context,
    });

    const now = Date.now();

    // Remote update with older timestamp
    const olderRemoteState: LWWMapState<any> = {
      title: {
        value: 'Older Remote',
        timestamp: now - 1000,
        peerId: 'peer2',
      },
    };

    workspace.receiveUpdate(olderRemoteState);
    expect(workspace.state.title).toBe('Hello'); // Should keep local because it's newer (initialized at ~now)

    // Remote update with newer timestamp
    const newerRemoteState: LWWMapState<any> = {
      title: {
        value: 'Newer Remote',
        timestamp: now + 1000,
        peerId: 'peer2',
      },
    };

    workspace.receiveUpdate(newerRemoteState);
    expect(workspace.state.title).toBe('Newer Remote');
  });

  it('does not update the store if the merged value is the same', () => {
    const initialState: TestState = { title: 'Hello', count: 0 };
    const workspace = new CollaborativeWorkspace<TestState>({
      id: 'ws1',
      peerId: 'peer1',
      initialState,
      context,
    });

    // Initial value is 'Hello'
    const sameRemoteState: LWWMapState<any> = {
      title: {
        value: 'Hello',
        timestamp: Date.now() + 1000,
        peerId: 'peer2',
      },
    };

    const setStateSpy = jest.spyOn(workspace.store, 'setState');
    workspace.receiveUpdate(sameRemoteState);

    // CRDT will be updated with new timestamp/peerId internally by LWWMap.merge,
    // but the CollaborativeWorkspace should NOT call setState if the value hasn't changed.
    expect(setStateSpy).not.toHaveBeenCalled();
    setStateSpy.mockRestore();
  });

  it('supports adding new fields through remote updates', () => {
    const initialState: TestState = { title: 'Hello', count: 0 };
    const workspace = new CollaborativeWorkspace<any>({
      id: 'ws1',
      peerId: 'peer1',
      initialState,
      context,
    });

    const remoteState: LWWMapState<any> = {
      description: {
        value: 'New Field',
        timestamp: Date.now(),
        peerId: 'peer2',
      },
    };

    workspace.receiveUpdate(remoteState);

    expect(workspace.state.description).toBe('New Field');
    expect(workspace.store.getState().description).toBe('New Field');
  });

  it('prevents CRDT updates during remote update processing', () => {
    const initialState: TestState = { title: 'Hello', count: 0 };
    const onSync = jest.fn();
    const workspace = new CollaborativeWorkspace<TestState>({
      id: 'ws1',
      peerId: 'peer1',
      initialState,
      context,
      onSync,
    });

    // This is a bit tricky to test because isRemoteUpdate is private.
    // However, the side effect is that onSync is NOT called during receiveUpdate.
    // We already have a test for that, but let's make it explicit.

    const remoteState: LWWMapState<any> = {
      title: {
        value: 'Remote',
        timestamp: Date.now() + 1000,
        peerId: 'peer2',
      },
    };

    workspace.receiveUpdate(remoteState);
    expect(onSync).not.toHaveBeenCalled();
  });
});
