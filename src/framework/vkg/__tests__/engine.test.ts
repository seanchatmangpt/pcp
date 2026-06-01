import { VKGEngineFacade, VkgHookEngine } from '../engine';

const mockRegisterHook = jest.fn();
const mockRegisterSupervisor = jest.fn();
const mockProcessDelta = jest.fn();
const mockGetMetrics = jest.fn().mockReturnValue({ fanout: 5 });
const mockReset = jest.fn();

jest.mock('../../../lib/vkg/hooks/engine', () => {
  return {
    VkgHookEngine: jest.fn().mockImplementation(() => {
      return {
        registerHook: mockRegisterHook,
        registerSupervisor: mockRegisterSupervisor,
        processDelta: mockProcessDelta,
        getMetrics: mockGetMetrics,
        reset: mockReset,
      };
    }),
  };
});

describe('VKG Framework - Engine Facade', () => {
  let facade: VKGEngineFacade;
  let mockOutboxManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOutboxManager = {};
    facade = new VKGEngineFacade(mockOutboxManager);
  });

  it('delegates registerHook', () => {
    const hook = {
      id: 'test-hook',
      mode: 'observe',
      condition: { kind: 'pattern', pattern: 'http://test' },
      evaluate: jest.fn(),
    };
    facade.registerHook(hook as any);
    expect(mockRegisterHook).toHaveBeenCalledWith(hook);
  });

  it('delegates registerSupervisor', () => {
    const supervisor = { id: 'sup-1', name: 'sup', evaluateMetrics: jest.fn() };
    facade.registerSupervisor(supervisor as any);
    expect(mockRegisterSupervisor).toHaveBeenCalledWith(supervisor);
  });

  it('delegates processDelta', () => {
    const delta = { id: 'd1', subject: 's', predicate: 'p', object: 'o', timestamp: 123 };
    facade.processDelta(delta);
    expect(mockProcessDelta).toHaveBeenCalledWith(delta);
  });

  it('processMultiple processes an array of deltas', () => {
    const deltas = [
      { id: 'd1', subject: 's', predicate: 'p', object: 'o', timestamp: 123 },
      { id: 'd2', subject: 's', predicate: 'p', object: 'o2', timestamp: 124 },
    ];
    facade.processMultiple(deltas);
    expect(mockProcessDelta).toHaveBeenCalledTimes(2);
    expect(mockProcessDelta).toHaveBeenNthCalledWith(1, deltas[0]);
    expect(mockProcessDelta).toHaveBeenNthCalledWith(2, deltas[1]);
  });

  it('delegates getMetrics', () => {
    const metrics = facade.getMetrics();
    expect(mockGetMetrics).toHaveBeenCalled();
    expect(metrics.fanout).toBe(5);
  });

  it('delegates reset', () => {
    facade.reset();
    expect(mockReset).toHaveBeenCalled();
  });
});
