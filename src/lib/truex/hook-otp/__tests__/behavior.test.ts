import { runInit, runDelta, runReceipt, runReplay, runTerminate } from '../behavior';
import { HookBehavior, HookMessage, HookExecutionContext, HookEffect, ReplayResult } from '../types';

describe('Hook Behavior runner', () => {
  const dummyCtx: HookExecutionContext = {
    actorRef: { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' },
    state: { key: 'value' },
    timestamp: '2025-01-01T00:00:00Z',
  };

  const dummyMsg: HookMessage = {
    id: 'msg1',
    type: 'graph_delta',
    payload: { foo: 'bar' },
    actorRef: dummyCtx.actorRef,
    timestamp: '2025-01-01T00:00:00Z',
  };

  describe('runInit', () => {
    it('should call behavior.init if provided', async () => {
      const mockInit = jest.fn().mockResolvedValue({ a: 1 });
      const behavior: HookBehavior = { init: mockInit };
      const result = await runInit(behavior);
      expect(mockInit).toHaveBeenCalled();
      expect(result).toEqual({ a: 1 });
    });

    it('should return empty object if behavior.init is not provided', async () => {
      const behavior: HookBehavior = {};
      const result = await runInit(behavior);
      expect(result).toEqual({});
    });
  });

  describe('runDelta', () => {
    it('should call behavior.handleDelta if provided', async () => {
      const mockEffects: HookEffect[] = [{ type: 'eff1', payload: 'p1' }];
      const mockHandleDelta = jest.fn().mockResolvedValue(mockEffects);
      const behavior: HookBehavior = { handleDelta: mockHandleDelta };
      
      const result = await runDelta(behavior, dummyMsg, dummyCtx);
      expect(mockHandleDelta).toHaveBeenCalledWith(dummyMsg, dummyCtx);
      expect(result).toEqual(mockEffects);
    });

    it('should return empty array if behavior.handleDelta is not provided', async () => {
      const behavior: HookBehavior = {};
      const result = await runDelta(behavior, dummyMsg, dummyCtx);
      expect(result).toEqual([]);
    });
  });

  describe('runReceipt', () => {
    it('should call behavior.handleReceipt if provided', async () => {
      const mockHandleReceipt = jest.fn().mockResolvedValue(undefined);
      const behavior: HookBehavior = { handleReceipt: mockHandleReceipt };
      
      await runReceipt(behavior, dummyMsg, dummyCtx);
      expect(mockHandleReceipt).toHaveBeenCalledWith(dummyMsg, dummyCtx);
    });

    it('should do nothing if behavior.handleReceipt is not provided', async () => {
      const behavior: HookBehavior = {};
      await expect(runReceipt(behavior, dummyMsg, dummyCtx)).resolves.toBeUndefined();
    });
  });

  describe('runReplay', () => {
    it('should call behavior.handleReplay if provided', async () => {
      const mockResult: ReplayResult = {
        success: true,
        outputHash: 'myHash',
        state: dummyCtx.state,
        effects: []
      };
      const mockHandleReplay = jest.fn().mockResolvedValue(mockResult);
      const behavior: HookBehavior = { handleReplay: mockHandleReplay };
      
      const result = await runReplay(behavior, dummyMsg, dummyCtx);
      expect(mockHandleReplay).toHaveBeenCalledWith(dummyMsg, dummyCtx);
      expect(result).toEqual(mockResult);
    });

    it('should fallback to runDelta if behavior.handleReplay is not provided and succeed', async () => {
      const mockEffects: HookEffect[] = [{ type: 'eff2', payload: 'p2' }];
      const mockHandleDelta = jest.fn().mockResolvedValue(mockEffects);
      const behavior: HookBehavior = { handleDelta: mockHandleDelta };
      
      const result = await runReplay(behavior, dummyMsg, dummyCtx);
      expect(mockHandleDelta).toHaveBeenCalledWith(dummyMsg, dummyCtx);
      expect(result.success).toBe(true);
      expect(result.effects).toEqual(mockEffects);
      expect(result.state).toEqual(dummyCtx.state);
      expect(result.outputHash).toContain(JSON.stringify(mockEffects));
      expect(result.outputHash).toContain(JSON.stringify(dummyCtx.state));
    });

    it('should fallback to runDelta and handle errors returning failure', async () => {
      const mockHandleDelta = jest.fn().mockRejectedValue(new Error('Delta Error'));
      const behavior: HookBehavior = { handleDelta: mockHandleDelta };
      
      const result = await runReplay(behavior, dummyMsg, dummyCtx);
      expect(mockHandleDelta).toHaveBeenCalledWith(dummyMsg, dummyCtx);
      expect(result.success).toBe(false);
      expect(result.outputHash).toBe('error_hash');
      expect(result.effects).toEqual([]);
      expect(result.state).toEqual(dummyCtx.state);
      expect(result.error).toBe('Delta Error');
    });

    it('should fallback to runDelta and handle non-Error throwables', async () => {
      const mockHandleDelta = jest.fn().mockRejectedValue('String Error');
      const behavior: HookBehavior = { handleDelta: mockHandleDelta };
      
      const result = await runReplay(behavior, dummyMsg, dummyCtx);
      expect(mockHandleDelta).toHaveBeenCalledWith(dummyMsg, dummyCtx);
      expect(result.success).toBe(false);
      expect(result.outputHash).toBe('error_hash');
      expect(result.effects).toEqual([]);
      expect(result.state).toEqual(dummyCtx.state);
      expect(result.error).toBe('String Error');
    });
  });

  describe('runTerminate', () => {
    it('should call behavior.terminate if provided', async () => {
      const mockTerminate = jest.fn().mockResolvedValue(undefined);
      const behavior: HookBehavior = { terminate: mockTerminate };
      
      await runTerminate(behavior, 'reason', dummyCtx);
      expect(mockTerminate).toHaveBeenCalledWith('reason', dummyCtx);
    });

    it('should do nothing if behavior.terminate is not provided', async () => {
      const behavior: HookBehavior = {};
      await expect(runTerminate(behavior, 'reason', dummyCtx)).resolves.toBeUndefined();
    });
  });
});
