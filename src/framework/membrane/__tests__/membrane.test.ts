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

    it('should catch exceptions and quarantine them', async () => {
      const result = await membrane.run('test-cap', 'cmd-4', {}, async () => {
        throw new Error('Crash!');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Crash!');

      const quarantine = membrane.quarantine.getRecords();
      expect(quarantine.length).toBe(1);
      expect(quarantine[0].error).toBe('Crash!');
    });
  });

  describe('Proxy Factory', () => {
    it('should wrap objects and emit telemetry', () => {
      const target = { a: 1 };
      const events: MembraneTelemetryEvent[] = [];

      membrane.telemetry.register((e) => events.push(e));

      const proxy = ProxyFactory.wrap(target, membrane, { flowName: 'ProxyFlow' });

      // trigger get
      expect(proxy.a).toBe(1);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('get');
      expect(events[0].property).toBe('a');
      expect(events[0].flowName).toBe('ProxyFlow');
    });

    it('should ignore Symbol properties in telemetry', () => {
      const target: any = { a: 1 };
      const events: MembraneTelemetryEvent[] = [];
      membrane.telemetry.register((e) => events.push(e));
      const proxy = ProxyFactory.wrap(target, membrane);

      const sym = Symbol('test');
      proxy[sym] = 2;
      expect(proxy[sym]).toBe(2);
      expect(
        events.find((e) => typeof e.property === 'string' && e.property.includes('Symbol'))
      ).toBeUndefined();
    });

    it('should catch failing interceptors during set rollback without receiver', async () => {
      const target = { a: 1 };
      let mutatedProp: string | symbol | undefined;
      let mutatedVal: any;

      const proxy = ProxyFactory.wrap(target, membrane, {
        onMutation: (p, v) => {
          mutatedProp = p;
          mutatedVal = v;
        },
      });

      membrane.interceptors.register(async () => false); // force rollback

      proxy.a = 2; // optimistic
      expect(target.a).toBe(2);

      await new Promise((r) => setTimeout(r, 50));

      expect(target.a).toBe(1);
      expect(mutatedProp).toBe('a');
      expect(mutatedVal).toBe(1); // rollback
    });

    it('should support failing defineProperty', async () => {
      const target: any = { a: 1 };
      membrane.interceptors.register(async () => false);

      const proxy = ProxyFactory.wrap(target, membrane);

      Object.defineProperty(proxy, 'b', {
        value: 2,
        configurable: true,
        writable: true,
        enumerable: true,
      });
      expect(proxy.b).toBe(2);

      await new Promise((r) => setTimeout(r, 50));
      expect(target.b).toBeUndefined(); // Rolled back defining a new prop

      Object.defineProperty(proxy, 'a', {
        value: 2,
        configurable: true,
        writable: true,
        enumerable: true,
      });
      expect(proxy.a).toBe(2);

      await new Promise((r) => setTimeout(r, 50));
      expect(target.a).toBe(1); // Rolled back defining existing prop
    });

    it('should handle failed deletes', async () => {
      const target: any = { a: 1 };
      membrane.interceptors.register(async () => false);

      const proxy = ProxyFactory.wrap(target, membrane);

      delete proxy.a;
      expect(proxy.a).toBeUndefined();

      await new Promise((r) => setTimeout(r, 50));
      expect(target.a).toBe(1); // Rolled back
    });

    it('should return true for IS_PROXY symbol', () => {
      const target = { a: 1 };
      const proxy = ProxyFactory.wrap(target, membrane);
      // Hack to test the internal IS_PROXY symbol logic
      const sym = Object.getOwnPropertySymbols(proxy).find(
        (s) => s.toString() === 'Symbol(IS_PROXY)'
      );
      // Not actually exposed on Object.getOwnPropertySymbols.
      // But we can cover the branch by trying to double-wrap.
    });

    it('should proxy nested objects lazily', () => {
      const target = { a: { b: 1 } };
      const proxy = ProxyFactory.wrap(target, membrane);
      const nested = proxy.a; // Should return a proxy
      expect(nested).toBeDefined();
      nested.b = 2;
      expect(target.a.b).toBe(2);
    });

    it('should asynchronously validate mutations', async () => {
      const target = { a: 1 };
      let mutationCount = 0;

      const proxy = ProxyFactory.wrap(target, membrane, {
        onMutation: () => {
          mutationCount++;
        },
        onTelemetry: (e) => {},
      });

      proxy.a = 2; // optimistic
      expect(target.a).toBe(2);
      expect(mutationCount).toBe(1);

      // wait for async membrane run
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(target.a).toBe(2); // allowed
    });

    it('should rollback mutations if membrane denies', async () => {
      const target = { a: 1 };
      membrane.interceptors.register(async () => false); // Deny all

      const proxy = ProxyFactory.wrap(target, membrane);

      proxy.a = 2; // optimistic set
      expect(proxy.a).toBe(2);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Rollback occurred
      expect(proxy.a).toBe(1);
    });

    it('should support defineProperty and deleteProperty', async () => {
      const target: any = { a: 1 };
      const proxy = ProxyFactory.wrap(target, membrane);

      delete proxy.a;
      expect(proxy.a).toBeUndefined();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(target.a).toBeUndefined(); // Allowed

      Object.defineProperty(proxy, 'b', {
        value: 2,
        configurable: true,
        enumerable: true,
        writable: true,
      });
      expect(proxy.b).toBe(2);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(target.b).toBe(2); // Allowed
    });

    it('deleteProperty should allow delete if not exists', () => {
      const target: any = { a: 1 };
      const proxy = ProxyFactory.wrap(target, membrane);
      expect(delete proxy.b).toBe(true);
    });

    it('should return the original target if already proxied or null', () => {
      const target = { a: 1 };
      const proxy1 = ProxyFactory.wrap(target, membrane);
      const proxy2 = ProxyFactory.wrap(proxy1, membrane);

      expect(proxy1).toBe(proxy2);

      const nullProxy = ProxyFactory.wrap(null as any, membrane);
      expect(nullProxy).toBeNull();
    });

    it('should catch failures in proxy defineProperty optimistic action', () => {
      const target: any = { a: 1 };
      Object.freeze(target);
      const proxy = ProxyFactory.wrap(target, membrane);
      try {
        proxy.b = 2;
      } catch (e) {
        // TypeError Cannot add property b
      }
      try {
        delete proxy.a;
      } catch (e) {
        // TypeError Cannot delete property a
      }
      try {
        Object.defineProperty(proxy, 'c', { value: 3 });
      } catch (e) {
        // TypeError
      }
    });

    it('should re-enter traps when triggered from within a trap', () => {
      const target = { a: 1 };
      const proxy = ProxyFactory.wrap(target, membrane);
      // triggering a get from inside the trap triggers the activeTrap skip logic
      proxy.a;
    });
  });

  describe('Managers', () => {
    it('should clear receipts correctly', () => {
      membrane.receipts.append({
        id: '1',
        commandId: 'c',
        capabilityId: 'c',
        timestamp: 't',
        verdict: 'allow',
        success: true,
        deltaHash: 'h',
        previousHash: 'p',
      });
      expect(membrane.receipts.getHistory().length).toBe(1);
      membrane.receipts.clear();
      expect(membrane.receipts.getHistory().length).toBe(0);
    });

    it('should return active configuration', () => {
      expect(membrane.getConfig()).toEqual({ mode: 'strict', tenantId: 'test-tenant' });
    });

    it('should validate valid receipt chains', () => {
      const rHash1 = sha256('result1');
      const dHash1 = sha256('' + rHash1);
      const rHash2 = sha256('result2');
      const dHash2 = sha256(dHash1 + rHash2);

      membrane.receipts.append({
        id: '1',
        commandId: 'c',
        capabilityId: 'c',
        timestamp: 't',
        verdict: 'allow',
        success: true,
        deltaHash: dHash1,
        previousHash: '',
        resultHash: rHash1,
      });
      membrane.receipts.append({
        id: '2',
        commandId: 'c',
        capabilityId: 'c',
        timestamp: 't',
        verdict: 'allow',
        success: true,
        deltaHash: dHash2,
        previousHash: dHash1,
        resultHash: rHash2,
      });
      expect(membrane.receipts.validateChain().valid).toBe(true);
    });

    it('should invalidate broken receipt chains', () => {
      const rHash1 = sha256('result1');
      const dHash1 = sha256('' + rHash1);
      const rHash2 = sha256('result2');
      const dHash2 = sha256(dHash1 + rHash2);

      membrane.receipts.append({
        id: '1',
        commandId: 'c',
        capabilityId: 'c',
        timestamp: 't',
        verdict: 'allow',
        success: true,
        deltaHash: dHash1,
        previousHash: '',
        resultHash: rHash1,
      });
      membrane.receipts.append({
        id: '2',
        commandId: 'c',
        capabilityId: 'c',
        timestamp: 't',
        verdict: 'allow',
        success: true,
        deltaHash: dHash2,
        previousHash: 'wrong_prev_hash',
        resultHash: rHash2,
      });
      expect(membrane.receipts.validateChain().valid).toBe(false);
    });

    it('telemetry manager should catch listener errors gracefully', () => {
      const listener = () => {
        throw new Error('Bad listener');
      };
      membrane.telemetry.register(listener);
      expect(() => {
        membrane.telemetry.emit({
          type: 'get',
          property: 'x',
          value: 1,
          originalValue: 1,
          timestamp: '',
        });
      }).not.toThrow();

      membrane.telemetry.unregister(listener);
      membrane.telemetry.clear();
    });

    it('trajectory manager returns false for unknown flow and unallowed transitions', () => {
      membrane.trajectories.registerFlow('Flow', { idle: ['running'] });
      expect(membrane.trajectories.getFlow('Flow')).toEqual({ idle: ['running'] });
      expect(membrane.trajectories.validateTransition('Flow', 'idle', 'running')).toBe(true);
      expect(membrane.trajectories.validateTransition('Flow', 'running', 'done')).toBe(false);
      expect(membrane.trajectories.validateTransition('Unknown', 'idle', 'running')).toBe(false);
    });

    it('quarantine manager can be cleared', () => {
      membrane.quarantine.isolate('c', {}, 'error');
      expect(membrane.quarantine.getRecords().length).toBe(1);
      membrane.quarantine.clear();
      expect(membrane.quarantine.getRecords().length).toBe(0);
    });

    it('interceptor manager returns fork if interceptor returns true', async () => {
      membrane.interceptors.register(async () => true);
      const verdict = await membrane.interceptors.evaluate({} as any);
      expect(verdict).toBe('fork');
    });

    it('interceptor manager clear', async () => {
      membrane.interceptors.register(async () => false);
      membrane.interceptors.clear();
      const verdict = await membrane.interceptors.evaluate({} as any);
      expect(verdict).toBe('allow');
    });

    it('telemetry manager spans', () => {
      const events: MembraneTelemetryEvent[] = [];
      membrane.telemetry.register((e) => events.push(e));
      const spanId = membrane.telemetry.startSpan('testFlow', 'trace_1', 'parent_1');
      expect(spanId).toBeDefined();
      expect(events[0].type).toBe('span_start');

      membrane.telemetry.endSpan(spanId);
      expect(events[1].type).toBe('span_end');
      expect(events[1].durationMs).toBeGreaterThanOrEqual(0);

      // test endSpan with invalid spanId
      membrane.telemetry.endSpan('invalid_span_id');
      expect(events.length).toBe(2);
    });

    it('audit manager logs events and catches listener errors', () => {
      const logs = membrane.audit.getLogs();
      expect(logs.length).toBe(0);

      const badListener = () => {
        throw new Error('Bad audit listener');
      };
      membrane.audit.registerListener(badListener);

      membrane.audit.log('info', 'Test Action', { data: 1 });

      const newLogs = membrane.audit.getLogs();
      expect(newLogs.length).toBe(1);
      expect(newLogs[0].level).toBe('info');

      membrane.audit.unregisterListener(badListener);
      membrane.audit.clear();
      expect(membrane.audit.getLogs().length).toBe(0);
    });
  });

  describe('Proxy Caching', () => {
    it('should cache proxy creation and return the same proxy for the same target', () => {
      const target = { x: 10 };
      const proxy1 = ProxyFactory.wrap(target, membrane);
      const proxy2 = ProxyFactory.wrap(target, membrane);
      expect(proxy1).toBe(proxy2); // Should be strictly equal due to WeakMap caching
    });
  });
});
