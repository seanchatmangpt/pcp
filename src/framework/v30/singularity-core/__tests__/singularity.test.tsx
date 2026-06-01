import { renderHook, act } from '@testing-library/react-native';
import { SingularityKernel } from '../SingularityKernel';
import { useSingularity, resetGlobalKernel } from '../useSingularity';

describe('SingularityKernel', () => {
  let kernel: SingularityKernel;

  beforeEach(() => {
    kernel = new SingularityKernel({ maxEntropy: 2.0 });
  });

  it('initializes with default state when no config is provided', () => {
    const defaultKernel = new SingularityKernel();
    const state = defaultKernel.getSnapshot();
    expect(state.chaos.entropy).toBe(0);
  });

  it('initializes with default state', () => {
    const state = kernel.getSnapshot();
    expect(state.temporal.epoch).toBe('v30.1.1');
    expect(state.quantum.superposition).toBe(false);
    expect(state.chaos.entropy).toBe(0);
  });

  it('handles BCI initialization', () => {
    const listener = jest.fn();
    kernel.subscribe(listener);
    kernel.initializeBCI(99.9);
    const state = kernel.getSnapshot();
    expect(state.bci.neuralLinkActive).toBe(true);
    expect(state.bci.syncRate).toBe(99.9);
    expect(listener).toHaveBeenCalled();
  });

  it('handles quantum entanglement', () => {
    kernel.entangle(128);
    const state = kernel.getSnapshot();
    expect(state.quantum.superposition).toBe(true);
    expect(state.quantum.entanglementId).toMatch(/^ent-\d+$/);
    expect(state.quantum.qubits).toBe(128);
  });

  it('handles temporal jumps', () => {
    kernel.jumpTimeline('sigma', 'dev');
    const state = kernel.getSnapshot();
    expect(state.temporal.timelineId).toBe('sigma');
    expect(state.temporal.branch).toBe('dev');
  });

  it('handles swarm consensus', () => {
    kernel.reachConsensus();
    const state = kernel.getSnapshot();
    expect(state.swarm.consensusReached).toBe(true);
  });

  it('handles chaos induction and limits max entropy', () => {
    kernel.induceChaos(1.5);
    expect(kernel.getSnapshot().chaos.entropy).toBe(1.5);
    kernel.induceChaos(1.0);
    expect(kernel.getSnapshot().chaos.entropy).toBe(2.0); // max is 2.0
  });

  it('allows unsubscribing', () => {
    const listener = jest.fn();
    const unsubscribe = kernel.subscribe(listener);
    unsubscribe();
    kernel.initializeBCI(50);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('useSingularity', () => {
  beforeEach(() => {
    resetGlobalKernel();
  });

  it('works without config', () => {
    const { result } = renderHook(() => useSingularity());
    expect(result.current.state.temporal.epoch).toBe('v30.1.1');
  });

  it('provides access to singularity state and kernel', () => {
    const { result } = renderHook(() => useSingularity({ maxEntropy: 5.0 }));

    expect(result.current.state.temporal.epoch).toBe('v30.1.1');

    act(() => {
      result.current.kernel.entangle(256);
    });

    expect(result.current.state.quantum.qubits).toBe(256);
    expect(result.current.state.quantum.superposition).toBe(true);
  });
});
