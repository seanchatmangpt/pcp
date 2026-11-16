import { VKGEngineFacade, VkgHookEngine } from '../engine';

const mockRegisterHook = jest.fn();
const mockRegisterSupervisor = jest.fn();
const mockProcessDelta = jest.fn();
const mockGetMetrics = jest.fn().mockReturnValue({ fanout: 5 });
const mockReset = jest.fn();

jest.mock('@/src/lib/vkg/hooks/engine', () => {
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
});
