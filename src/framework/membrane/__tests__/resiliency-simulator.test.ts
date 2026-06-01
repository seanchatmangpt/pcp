import { Membrane } from '../membrane';
import { ProxyFactory } from '../proxy';
import { SelfHealingMembrane } from '../self-healing';

describe('Pcp Membrane Resiliency Simulator', () => {
  describe('Scenario 1: Concurrent Mutation Race Conditions (Proxy Set)', () => {
    it('demonstrates state divergence due to concurrent optimistic set rollbacks', async () => {
      const target = { balance: 100 };
      const membrane = new Membrane({ mode: 'strict' });
      const proxy = ProxyFactory.wrap(target, membrane);

      // Register an interceptor that simulates varying latency:
      // - Value 200 is denied after a long delay (100ms)
      // - Value 300 is allowed after a short delay (10ms)
      membrane.interceptors.register(async (ctx) => {
        if (ctx.input && ctx.input.value === 200) {
          await new Promise((r) => setTimeout(r, 100));
          return false; // Deny
        }
        if (ctx.input && ctx.input.value === 300) {
          await new Promise((r) => setTimeout(r, 10));
          return true; // Allow
        }
        return true;
      });

      // Alice triggers Mutation 1 (balance = 200, denied)
      proxy.balance = 200;

      // Bob triggers Mutation 2 immediately after (balance = 300, allowed)
      proxy.balance = 300;

      // Synchronously, the optimistic writes have updated the target to the latest set (300)
      expect(target.balance).toBe(300);

      // Wait for both background validations to complete
      await new Promise((r) => setTimeout(r, 150));

      // Trace:
      // 1. Mutation 2 (value 300) resolves first at T+10ms. res.success is true, so no rollback.
      // 2. Mutation 1 (value 200) resolves second at T+100ms. res.success is false.
      // 3. Mutation 1 triggers its rollback: Reflect.set(obj, prop, originalVal) where originalVal is 100.
      // 4. State is rolled back to 100, overwriting the successful mutation to 300!
      // This demonstrates state divergence.
      expect(target.balance).toBe(100);
    });
  });

  describe('Scenario 2: Concurrent Execution Receipt Lineage Breaks (Hash Chain Conflict)', () => {
    it('demonstrates receipt chain corruption and false-positive self-healing triggers', async () => {
      const target = { count: 0 };
      const membrane = new SelfHealingMembrane({ mode: 'strict' }, target, {
        deadlockTimeoutMs: 5000,
        autoHeal: true,
      });

      // Trigger two concurrent membrane operations.
      // Since they run concurrently, both will query the last hash at the start of run()
      // and retrieve the same empty string (or root hash).
      const op1 = membrane.run('cap-1', 'cmd-a', {}, async () => {
        await new Promise((r) => setTimeout(r, 30));
        return { value: 1 };
      });

      const op2 = membrane.run('cap-2', 'cmd-b', {}, async () => {
        await new Promise((r) => setTimeout(r, 30));
        target.count = 2; // Mutate target in concurrent operation
        return { value: 2 };
      });

      await Promise.all([op1, op2]);

      // Verify receipt chain is broken
      const validation = membrane.receipts.validateChain();
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Broken lineage');

      // Target was mutated by op2
      expect(target.count).toBe(2);

      // Now, executing a new command under the membrane will trigger the setupInterceptor.
      // The interceptor checks validateChain(), detects the corruption, and triggers heal().
      // Because the first valid sub-chain only goes up to the first concurrent receipt,
      // it rolls back state to that point, discarding the second execution.
      // Target state rolls back to count: 0, and the receipt history is truncated.
      const op3Result = await membrane.run('cap-3', 'cmd-c', {}, async () => {
        return { value: 3 };
      });

      expect(op3Result.success).toBe(true); // Proceeded after healing
      expect(target.count).toBe(0); // State change from op2 has been lost/discarded!

      // History has been truncated to only op1 (length 1), then op3 is appended, resulting in length 2
      expect(membrane.receipts.getHistory()).toHaveLength(2);
      expect(membrane.receipts.getHistory()[0].commandId).toBe('cmd-a');
      expect(membrane.receipts.getHistory()[1].commandId).toBe('cmd-c');

      membrane.dispose();
    });
  });

  describe('Scenario 3: Nested Proxy Rollback Isolation Break (Partial Transactional Failure)', () => {
    it('demonstrates violation of atomic transaction bounds in nested proxy mutations', async () => {
      const target = {
        nested: {
          prop1: 'initial1',
          prop2: 'initial2',
        },
      };

      const membrane = new Membrane({ mode: 'strict' });
      const proxy = ProxyFactory.wrap(target, membrane);

      // Register an interceptor that allows mutations on prop1 but denies mutations on prop2
      membrane.interceptors.register(async (ctx) => {
        if (ctx.input && ctx.input.property === 'prop2') {
          return false; // Deny
        }
        return true; // Allow
      });

      // Attempt to mutate both nested properties
      proxy.nested.prop1 = 'changed1';
      proxy.nested.prop2 = 'changed2';

      // Wait for async membrane runs to settle
      await new Promise((r) => setTimeout(r, 50));

      // Trace:
      // 1. prop1 mutation is allowed. It remains 'changed1'.
      // 2. prop2 mutation is denied. It rolls back to 'initial2'.
      // This leaves the nested object in a partially mutated, inconsistent state.
      expect(target.nested.prop1).toBe('changed1');
      expect(target.nested.prop2).toBe('initial2');
    });
  });
});
