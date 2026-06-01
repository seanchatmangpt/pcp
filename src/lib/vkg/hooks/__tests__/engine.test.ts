import { VkgHookEngine, GraphDelta } from '../engine';
import { OutboxManager } from '../../sync/outbox';
import { VkgHook } from '../types';
import { SupervisorHook } from '../../supervisors/index';

describe('VkgHookEngine', () => {
  let engine: VkgHookEngine;
  let mockOutbox: jest.Mocked<OutboxManager>;

  beforeEach(() => {
    mockOutbox = {
      enqueue: jest.fn(),
    } as unknown as jest.Mocked<OutboxManager>;
    engine = new VkgHookEngine(mockOutbox);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize correctly', () => {
    const metrics = engine.getMetrics();
    expect(metrics).toEqual({
      activationRate: 0,
      fanout: 0,
      cascadeDepth: 0,
      oscillationScore: 0,
    });
  });

  it('should register hooks', () => {
    const hook: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'async' } as any;
    engine.registerHook(hook);
    // test via processing a delta
    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).toHaveBeenCalled();
  });

  it('should register supervisors', () => {
    const supervisor: SupervisorHook = { evaluateMetrics: jest.fn(() => 'allow') } as any;
    engine.registerSupervisor(supervisor);
    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(supervisor.evaluateMetrics).toHaveBeenCalled();
  });

  // Coverage for trackMetrics logic
  it('should calculate windowActivationCount correctly over time', () => {
    engine.processDelta({ id: '1', subject: 's', predicate: 'none', object: 'o', timestamp: 123 });
    let metrics = engine.getMetrics();
    expect(metrics.activationRate).toBe(60);

    jest.advanceTimersByTime(1001);
    engine.processDelta({ id: '2', subject: 's', predicate: 'none', object: 'o', timestamp: 124 });
    metrics = engine.getMetrics();
    expect(metrics.activationRate).toBe(60); // Reset to 1 activation -> 60 rate
    expect(metrics.fanout).toBe(0); // Fanout should reset
  });

  // Coverage for Supervisor decisions
  it('should suppress on suppress decision', () => {
    const supervisor: SupervisorHook = { evaluateMetrics: jest.fn(() => 'suppress') } as any;
    engine.registerSupervisor(supervisor);
    
    const hook: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'async' } as any;
    engine.registerHook(hook);

    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('should suppress on quarantine decision', () => {
    const supervisor: SupervisorHook = { evaluateMetrics: jest.fn(() => 'quarantine') } as any;
    engine.registerSupervisor(supervisor);
    
    const hook: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'async' } as any;
    engine.registerHook(hook);

    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('should suppress on throttle decision', () => {
    const supervisor: SupervisorHook = { evaluateMetrics: jest.fn(() => 'throttle') } as any;
    engine.registerSupervisor(supervisor);
    
    const hook: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'async' } as any;
    engine.registerHook(hook);

    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('should batch on batch decision', () => {
    const supervisor: SupervisorHook = { evaluateMetrics: jest.fn(() => 'batch') } as any;
    engine.registerSupervisor(supervisor);
    
    const hook: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'async' } as any;
    engine.registerHook(hook);

    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).toHaveBeenCalledWith(expect.any(Object), hook, true);
  });

  // Coverage for Hooks
  it('should block if hook mode is block', () => {
    const hook: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'block' } as any;
    engine.registerHook(hook);
    
    const hook2: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'async' } as any;
    engine.registerHook(hook2);

    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('should skip hook if condition kind is not pattern or pattern does not match', () => {
    const hook1: VkgHook = { condition: { kind: 'other', pattern: 'test' }, mode: 'async' } as any;
    const hook2: VkgHook = { condition: { kind: 'pattern', pattern: 'different' }, mode: 'async' } as any;
    engine.registerHook(hook1);
    engine.registerHook(hook2);

    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('should enqueue and increase fanout correctly if batched is false', () => {
    const hook1: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'async' } as any;
    engine.registerHook(hook1);

    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).toHaveBeenCalledWith(expect.any(Object), hook1, false);
    
    const metrics = engine.getMetrics();
    expect(metrics.fanout).toBe(1);
  });

  // Coverage for reset
  it('should reset engine state', () => {
    const hook: VkgHook = { condition: { kind: 'pattern', pattern: 'test' }, mode: 'async' } as any;
    engine.registerHook(hook);
    
    const supervisor: SupervisorHook = { evaluateMetrics: jest.fn(() => 'allow') } as any;
    engine.registerSupervisor(supervisor);

    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(engine.getMetrics().fanout).toBe(1);

    engine.reset();

    const metrics = engine.getMetrics();
    expect(metrics.activationRate).toBe(0);
    expect(metrics.fanout).toBe(0);
    
    engine.processDelta({ id: '1', subject: 's', predicate: 'test', object: 'o', timestamp: 123 });
    expect(mockOutbox.enqueue).toHaveBeenCalledTimes(1); // Not called again after reset
    expect(supervisor.evaluateMetrics).toHaveBeenCalledTimes(1); // Not called again after reset
  });
});
