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

  it('should perform actions on tick', () => {
    const initialState = { compA: { val: 1 }, compB: { val: 2 } };
    manager.registerStateMap(initialState);

    const mathRandomSpy = jest.spyOn(Math, 'random');

    // For agent 0: analyze -> random action 0.1, random memory 0.5
    mathRandomSpy.mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

    // For agent 1: refactor -> random action 0.4, random comp index 0.0 (compA)
    mathRandomSpy.mockReturnValueOnce(0.4).mockReturnValueOnce(0.0);

    // For agent 2: idle -> random action 0.8
    mathRandomSpy.mockReturnValueOnce(0.8);

    // For agent 3: analyze -> random action 0.2, random memory 0.2
    mathRandomSpy.mockReturnValueOnce(0.2).mockReturnValueOnce(0.2);

    // For agent 4: refactor -> random action 0.5, random comp index 0.99 (compB)
    mathRandomSpy.mockReturnValueOnce(0.5).mockReturnValueOnce(0.99);

    manager.start();
    jest.advanceTimersByTime(100); // 1 tick

    const agents = manager.getAgents();

    expect(agents[0].status).toBe('analyzing');
    expect(agents[0].memoryAnalyzed).toBe(512); // 0.5 * 1024

    expect(agents[1].status).toBe('refactoring');
    expect(agents[1].componentsRefactored).toBe(1);

    expect(agents[2].status).toBe('idle');

    expect(agents[3].status).toBe('analyzing');
    expect(agents[3].memoryAnalyzed).toBe(204); // Math.floor(0.2 * 1024)

    expect(agents[4].status).toBe('refactoring');
    expect(agents[4].componentsRefactored).toBe(1);

    const stateMap = manager.getStateMap();
    expect(stateMap.compA._refactoredBy).toBe('agent-1');
    expect(stateMap.compA._refactorCount).toBe(1);

    expect(stateMap.compB._refactoredBy).toBe('agent-4');
    expect(stateMap.compB._refactorCount).toBe(1);
  });

  it('should refactor safely when state map is empty', () => {
    manager.registerStateMap({});
    const mathRandomSpy = jest.spyOn(Math, 'random');

    // agent 0 to 4: all refactor (0.5), but no component selection happens since state is empty
    mathRandomSpy
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5);

    manager.start();
    jest.advanceTimersByTime(100);

    const agents = manager.getAgents();
    expect(agents[0].status).toBe('refactoring');
    expect(agents[0].componentsRefactored).toBe(0);
  });

  it('should do nothing on tick if not running', () => {
    manager.tick();
    const agents = manager.getAgents();
    expect(agents[0].status).toBe('idle');
  });

  it('should initialize with default agent count', () => {
    const defaultManager = new AppSwarmManager();
    expect(defaultManager.getAgents().length).toBe(3);
  });

  it('should handle stop when intervalId is null but isRunning is true', () => {
    manager.start();
    (manager as any).intervalId = null;
    manager.stop();
    expect((manager as any).isRunning).toBe(false);
  });

  it('should increment _refactorCount if already exists', () => {
    const initialState = { compA: { val: 1, _refactorCount: 5 } };
    manager.registerStateMap(initialState);
    const mathRandomSpy = jest.spyOn(Math, 'random');
    mathRandomSpy
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.0) // Agent 0 refactors compA
      .mockReturnValueOnce(0.8) // Agent 1 idle
      .mockReturnValueOnce(0.8) // Agent 2 idle
      .mockReturnValueOnce(0.8) // Agent 3 idle
      .mockReturnValueOnce(0.8); // Agent 4 idle
    manager.start();
    manager.tick();
    expect(manager.getStateMap().compA._refactorCount).toBe(6);
  });
});
