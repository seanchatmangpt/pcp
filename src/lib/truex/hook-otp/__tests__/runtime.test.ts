import { HookRuntime } from '../runtime';
import { HookActorRef, HookBehavior, HookSupervisor, HookMessage, HookEffect } from '../types';

// Mock dependencies
jest.mock('../behavior', () => ({
  runInit: jest.fn().mockResolvedValue({ status: 'initialized' }),
  runDelta: jest.fn(),
}));

jest.mock('../actorRef', () => ({
  stringifyActorRef: jest.fn((ref) => `${ref.tenantId}:${ref.packId}:${ref.hookId}:${ref.instanceId}`),
  sha256: jest.fn((str) => `hash_${str.substring(0, 5)}`),
}));

jest.mock('../receipts', () => ({
  generateReceipt: jest.fn((input) => ({
    receiptHash: `receipt_${input.messageId}`,
    ...input,
  })),
}));

import { runInit, runDelta } from '../behavior';
import { generateReceipt } from '../receipts';

describe('HookRuntime', () => {
  let runtime: HookRuntime;
  let mockRef: HookActorRef;
  let mockBehavior: HookBehavior;
  let mockSupervisor: HookSupervisor;

  beforeEach(() => {
    jest.clearAllMocks();
    runtime = new HookRuntime();
    mockRef = { tenantId: 't1', packId: 'pack1', hookId: 'test', instanceId: '1' };
    mockBehavior = {
      init: jest.fn(),
      handleReceipt: jest.fn(),
    };
    mockSupervisor = {
      onFailure: jest.fn(),
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('getRegistry', () => {
    it('returns the underlying registry', () => {
      expect(runtime.getRegistry()).toBeDefined();
    });
  });

  describe('spawn', () => {
    it('spawns an actor with default initialState', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      expect(instance.ref).toEqual(mockRef);
      expect(instance.state).toEqual({ status: 'initialized' });
      expect(runInit).toHaveBeenCalledWith(mockBehavior);
    });

    it('spawns an actor with default supervisor', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior);
      expect(instance.supervisor).toBeDefined();
    });

    it('spawns an actor with provided initialState', async () => {
      const state = { custom: 'state' };
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor, state);
      expect(instance.state).toEqual(state);
      expect(runInit).not.toHaveBeenCalled();
    });

    it('returns existing actor if already spawned', async () => {
      const instance1 = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      const instance2 = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      expect(instance1).toBe(instance2);
    });
  });

  describe('send', () => {
    it('throws if actor is not registered', () => {
      expect(() => {
        runtime.send(mockRef, { id: 'm1', type: 'graph_delta', payload: {} });
      }).toThrow('Actor not registered: t1:pack1:test:1');
    });

    it('sends a message to mailbox if actor is registered', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      jest.spyOn(instance.mailbox, 'push');
      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };
      runtime.send(mockRef, msg);
      expect(instance.mailbox.push).toHaveBeenCalledWith(msg);
    });

    it('emits telemetry and ignores message if quarantined', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      instance.quarantined = true;
      const cb = jest.fn();
      runtime.registerTelemetry(cb);
      
      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };
      runtime.send(mockRef, msg);
      
      expect(cb).toHaveBeenCalledWith({
        type: 'message_refused_quarantined',
        actorRef: mockRef,
        messageId: 'm1',
      });
    });
  });

  describe('processMessage', () => {
    it('returns early if instance not in registry', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      runtime.getRegistry().clear();
      await (runtime as any).processMessage(mockRef, { id: 'm1', type: 'graph_delta', payload: {} });
      expect(instance.history).toHaveLength(0);
    });

    it('returns early and emits telemetry if instance quarantined during processing', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      instance.quarantined = true;
      const cb = jest.fn();
      runtime.registerTelemetry(cb);
      
      await (runtime as any).processMessage(mockRef, { id: 'm2', type: 'graph_delta', payload: {} });
      
      expect(cb).toHaveBeenCalledWith({
        type: 'message_refused_quarantined',
        actorRef: mockRef,
        messageId: 'm2',
      });
    });

    it('processes message without payload', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      (runDelta as jest.Mock).mockResolvedValue([]);
      
      // Provide a message with no payload to hit `msg.payload || {}`
      await (runtime as any).processMessage(mockRef, { id: 'm_no_payload', type: 'graph_delta' } as HookMessage);
      
      expect(instance.history).toHaveLength(1);
    });

    it('processes graph_delta message', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      (runDelta as jest.Mock).mockResolvedValue([{ type: 'some_effect' }]);
      
      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: { data: 'test' } };
      await (runtime as any).processMessage(mockRef, msg);
      
      expect(runDelta).toHaveBeenCalledWith(mockBehavior, msg, expect.any(Object));
      expect(instance.history).toHaveLength(1);
    });

    it('processes receipt_event message', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      const msg: HookMessage = { id: 'm1', type: 'receipt_event', payload: {} };
      
      await (runtime as any).processMessage(mockRef, msg);
      
      expect(mockBehavior.handleReceipt).toHaveBeenCalledWith(msg, expect.any(Object));
    });

    it('processes receipt_event message when handleReceipt is undefined', async () => {
      const behaviorWithoutReceipt = { init: jest.fn() };
      const instance = await runtime.spawn(mockRef, behaviorWithoutReceipt, mockSupervisor);
      const msg: HookMessage = { id: 'm1', type: 'receipt_event', payload: {} };
      
      await (runtime as any).processMessage(mockRef, msg);
      
      expect(instance.history).toHaveLength(1);
    });

    it('processes supervisor_signal repair message', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      const msg: HookMessage = { id: 'm1', type: 'supervisor_signal', payload: { action: 'repair', state: { new: 'state' } } };
      
      const cb = jest.fn();
      runtime.registerTelemetry(cb);
      
      await (runtime as any).processMessage(mockRef, msg);
      
      expect(instance.quarantined).toBe(false);
      expect(instance.state).toEqual({ new: 'state' });
      expect(cb).toHaveBeenCalledWith({
        type: 'actor_repaired',
        actorRef: mockRef,
        messageId: 'm1',
      });
    });

    it('processes supervisor_signal repair message without state', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      const initialState = instance.state;
      const msg: HookMessage = { id: 'm1', type: 'supervisor_signal', payload: { action: 'repair' } };
      
      await (runtime as any).processMessage(mockRef, msg);
      
      expect(instance.quarantined).toBe(false);
      expect(instance.state).toEqual(initialState);
    });

    it('processes supervisor_signal without repair action', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      const msg: HookMessage = { id: 'm1', type: 'supervisor_signal', payload: { action: 'other' } };
      
      await (runtime as any).processMessage(mockRef, msg);
      
      expect(instance.history).toHaveLength(1);
    });

    it('processes unknown message type', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      const msg = { id: 'm1', type: 'unknown_type', payload: {} } as unknown as HookMessage;
      
      await (runtime as any).processMessage(mockRef, msg);
      
      expect(instance.history).toHaveLength(1);
    });

    it('processes send_message effects', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      
      const targetRef: HookActorRef = { tenantId: 't1', packId: 'pack1', hookId: 'target', instanceId: '2' };
      const targetBehavior = { init: jest.fn(), handleReceipt: jest.fn() };
      await runtime.spawn(targetRef, targetBehavior, mockSupervisor);
      
      const effect: HookEffect = {
        type: 'send_message',
        payload: {
          to: targetRef,
          message: { id: 'msg2', type: 'graph_delta', payload: {} }
        }
      };
      
      (runDelta as jest.Mock).mockResolvedValueOnce([effect]);
      
      jest.spyOn(runtime, 'send');
      
      await (runtime as any).processMessage(mockRef, { id: 'msg1', type: 'graph_delta', payload: {} });
      
      expect(runtime.send).toHaveBeenCalledWith(targetRef, effect.payload.message);
    });
  });

  describe('Supervisor error handling', () => {
    it('quarantines on failure if supervisor returns quarantine', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      (runDelta as jest.Mock).mockRejectedValueOnce(new Error('Test error'));
      (mockSupervisor.onFailure as jest.Mock).mockResolvedValueOnce('quarantine');
      
      await (runtime as any).processMessage(mockRef, { id: 'm1', type: 'graph_delta', payload: {} });
      
      expect(instance.quarantined).toBe(true);
      expect(mockSupervisor.onFailure).toHaveBeenCalled();
    });

    it('defaults to quarantine on unknown action', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      (runDelta as jest.Mock).mockRejectedValueOnce(new Error('Test error'));
      (mockSupervisor.onFailure as jest.Mock).mockResolvedValueOnce('unknown_action');
      
      await (runtime as any).processMessage(mockRef, { id: 'm1', type: 'graph_delta', payload: {} });
      
      expect(instance.quarantined).toBe(true);
    });

    it('retries on restart action', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      
      (runDelta as jest.Mock)
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce([]);
        
      (mockSupervisor.onFailure as jest.Mock).mockResolvedValueOnce('restart');
      
      await (runtime as any).processMessage(mockRef, { id: 'm1', type: 'graph_delta', payload: {} });
      
      expect(instance.quarantined).toBe(false);
      expect(mockSupervisor.onFailure).toHaveBeenCalledTimes(1);
      expect(runDelta).toHaveBeenCalledTimes(2);
    });

    it('handles string error in supervisor fallback', async () => {
      const instance = await runtime.spawn(mockRef, mockBehavior, mockSupervisor);
      (runDelta as jest.Mock).mockRejectedValueOnce('String error');
      (mockSupervisor.onFailure as jest.Mock).mockResolvedValueOnce('quarantine');
      
      await (runtime as any).processMessage(mockRef, { id: 'm1', type: 'graph_delta', payload: {} });
      
      expect(instance.quarantined).toBe(true);
    });
  });

  describe('telemetry', () => {
    it('registers and unregisters callbacks', () => {
      const cb = jest.fn();
      runtime.registerTelemetry(cb);
      (runtime as any).emitTelemetry({ type: 'test' });
      expect(cb).toHaveBeenCalledWith({ type: 'test' });
      
      cb.mockClear();
      runtime.unregisterTelemetry(cb);
      (runtime as any).emitTelemetry({ type: 'test' });
      expect(cb).not.toHaveBeenCalled();
    });

    it('catches and logs errors in telemetry callbacks', () => {
      const cb = jest.fn().mockImplementation(() => { throw new Error('cb error'); });
      runtime.registerTelemetry(cb);
      (runtime as any).emitTelemetry({ type: 'test' });
      expect(console.error).toHaveBeenCalledWith('Error executing telemetry callback:', expect.any(Error));
    });
  });
});