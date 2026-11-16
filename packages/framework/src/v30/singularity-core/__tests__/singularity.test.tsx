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
});
