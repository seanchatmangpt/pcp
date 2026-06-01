import { renderHook, act } from '@testing-library/react-native';
import { TemporalRedTeamDaemon, useCryptoAgility, daemonInstance } from '../index';

jest.useFakeTimers();

describe('TemporalRedTeamDaemon', () => {
  let daemon: TemporalRedTeamDaemon;

  beforeEach(() => {
    daemon = new TemporalRedTeamDaemon();
  });

  afterEach(() => {
    daemon.stopSimulation();
  });

  it('initializes with SHA-256', () => {
    expect(daemon.getChain().algorithm).toBe('SHA-256');
    expect(daemon.getChain().receipts).toEqual([]);
  });

  it('adds a receipt with the current algorithm', () => {
    daemon.addReceipt('test-data');
    expect(daemon.getChain().receipts).toContain('test-data-hashed-with-SHA-256');
  });

  it('starts simulation and upgrades to Dilithium after delay', () => {
    daemon.addReceipt('data-1');
    daemon.startSimulation(1000);

    // Fast-forward time
    jest.advanceTimersByTime(1000);

    const chain = daemon.getChain();
    expect(chain.algorithm).toBe('Dilithium');
    expect(chain.receipts).toContain('data-1-hashed-with-SHA-256-upgraded-to-Dilithium');
  });

  it('ignores consecutive startSimulation calls', () => {
    daemon.startSimulation(1000);
    daemon.startSimulation(2000); // Should be ignored
    jest.advanceTimersByTime(1000);
    expect(daemon.getChain().algorithm).toBe('Dilithium');
  });

  it('starts simulation with default delay', () => {
    daemon.startSimulation();
    jest.advanceTimersByTime(1000);
    expect(daemon.getChain().algorithm).toBe('Dilithium');
  });

  it('forceQuantumBreak uses default algorithm Dilithium', () => {
    act(() => {
      daemon.forceQuantumBreak();
    });
    expect(daemon.getChain().algorithm).toBe('Dilithium');
  });

  it('stops simulation', () => {
    daemon.startSimulation(1000);
    daemon.stopSimulation();

    // Even if time passes, it should not upgrade
    jest.advanceTimersByTime(1000);
    expect(daemon.getChain().algorithm).toBe('SHA-256');
  });

  it('stopSimulation is a no-op if not started', () => {
    expect(() => daemon.stopSimulation()).not.toThrow();
  });

  it('forceQuantumBreak upgrades to provided algorithm', () => {
    daemon.addReceipt('data-2');
    daemon.forceQuantumBreak('Falcon');

    const chain = daemon.getChain();
    expect(chain.algorithm).toBe('Falcon');
    expect(chain.receipts).toContain('data-2-hashed-with-SHA-256-upgraded-to-Falcon');
  });

  it('subscribes and notifies listeners', () => {
    const listener = jest.fn();
    const unsubscribe = daemon.subscribe(listener);

    daemon.addReceipt('data-3');
    expect(listener).toHaveBeenCalledWith({
      algorithm: 'SHA-256',
      receipts: ['data-3-hashed-with-SHA-256'],
    });

    unsubscribe();
    daemon.addReceipt('data-4');
    // Listener should not be called again
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('useCryptoAgility', () => {
  afterEach(() => {
    // Reset global daemon
    daemonInstance.forceQuantumBreak('SHA-256');
    // Directly mutate for test reset
    const chain = daemonInstance.getChain();
    chain.receipts = [];
  });

  it('returns current chain state', () => {
    const { result } = renderHook(() => useCryptoAgility());
    expect(result.current.algorithm).toBe('SHA-256');
  });

  it('updates when daemon changes', () => {
    const { result } = renderHook(() => useCryptoAgility());

    act(() => {
      daemonInstance.addReceipt('hook-data');
    });

    expect(result.current.receipts).toContain('hook-data-hashed-with-SHA-256');

    act(() => {
      daemonInstance.forceQuantumBreak('Falcon');
    });

    expect(result.current.algorithm).toBe('Falcon');
    expect(result.current.receipts).toContain('hook-data-hashed-with-SHA-256-upgraded-to-Falcon');
  });
});
