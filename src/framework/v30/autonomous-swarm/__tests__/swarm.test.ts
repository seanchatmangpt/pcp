import { AppSwarmManager } from '../AppSwarmManager';

describe('AppSwarmManager', () => {
  let manager: AppSwarmManager;

  beforeEach(() => {
    manager = new AppSwarmManager(5);
    jest.useFakeTimers();
    jest.spyOn(global.Math, 'random');
  });

  afterEach(() => {
    manager.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should initialize with correct number of agents', () => {
    expect(manager.getAgents().length).toBe(5);
    expect(manager.getAgent('agent-0')).toBeDefined();
    expect(manager.getAgent('non-existent')).toBeUndefined();
  });

  it('should register and return state map', () => {
    const initialState = { compA: { val: 1 } };
    manager.registerStateMap(initialState);
    expect(manager.getStateMap()).toBe(initialState);
  });

  it('should start and stop correctly', () => {
    manager.start();
    manager.start(); // Should not do anything if already running

    // Simulate tick
    jest.advanceTimersByTime(100);

    manager.stop();
    manager.stop(); // Should not do anything if already stopped

    const agents = manager.getAgents();
    for (const agent of agents) {
      expect(agent.status).toBe('idle');
    }
  });
});
