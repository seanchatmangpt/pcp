import { Membrane } from '../membrane';
import { ProxyFactory } from '../proxy';
import { MembraneTelemetryEvent } from '../types';
import { sha256 } from '@/src/lib/crypto/receipts';

describe('Membrane Framework', () => {
  let membrane: Membrane;

  beforeEach(() => {
    membrane = new Membrane({ mode: 'strict', tenantId: 'test-tenant' });
  });

  describe('Core Execution', () => {
    it('should successfully execute an allowed payload', async () => {
      const result = await membrane.run('test-cap', 'cmd-1', { foo: 'bar' }, async () => {
        return { value: 42 };
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ value: 42 });
      expect(result.receipt).toBeDefined();
      expect(result.receipt.verdict).toBe('allow');
    });

    it('should deny execution if interceptor returns false', async () => {
      membrane.interceptors.register(async () => false);

      const result = await membrane.run('test-cap', 'cmd-2', {}, async () => {
        return { value: 42 };
      });

      expect(result.success).toBe(false);
      expect(result.result).toBeNull();
      expect(result.error).toBe('Denied by membrane');
      expect(membrane.receipts.getHistory()[0].verdict).toBe('deny');
    });

    it('should handle trajectory rejections', async () => {
      membrane.trajectories.registerFlow('TestFlow', {
        idle: ['running'],
        running: ['done'],
      });

      const result = await membrane.run(
        'test-cap',
        'cmd-3',
        {
          flowName: 'TestFlow',
          fromState: 'idle',
          toState: 'done', // Invalid transition
        },
        async () => {
          return true;
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Illegal trajectory transition');

      const quarantine = membrane.quarantine.getRecords();
      expect(quarantine.length).toBe(1);
      expect(quarantine[0].error).toContain('Illegal state transition in TestFlow: idle -> done');
    });
  });
});
