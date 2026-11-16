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
    jest.spyOn(require('@/src/lib/membrane/trajectories').Trajectories, 'validateTransition').mockReturnValue(true);
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

  it('updates CRDT and triggers onSync when state is mutated locally', async () => {
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
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(workspace.state.title).toBe('Updated');
    expect(workspace.store.getState().title).toBe('Updated');
    expect(workspace.crdtState.title.value).toBe('Updated');
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onSync).toHaveBeenCalledWith(workspace.crdtState);
  });

  it('merges remote updates and updates the store without triggering onSync', async () => {
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
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(workspace.state.title).toBe('Remote Update');
    expect(workspace.store.getState().title).toBe('Remote Update');
    expect(onSync).not.toHaveBeenCalled();
  });
});
