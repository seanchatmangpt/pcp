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
});
