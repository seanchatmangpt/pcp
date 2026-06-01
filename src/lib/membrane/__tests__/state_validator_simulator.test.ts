import { MembraneContext } from '../context';
import { ProxyableBridge } from '../proxyableBridge';
import { Interceptors } from '../interceptors';
import { Receipts } from '../receipts';
import { Quarantine } from '../quarantine';

describe('State Proxy & Rollback Boundary Resiliency Simulator', () => {
  beforeEach(() => {
    Receipts.clear();
    Interceptors.clear();
    Quarantine.clear();
  });

  it('Scenario 1: Concurrent Mutation Race Condition and State Divergence', async () => {
    const context = new MembraneContext({
      mode: 'strict',
      tenantId: 'tenant-race',
      authorityRole: 'admin'
    });

    const target = { balance: 100 };
    const proxy = ProxyableBridge.wrap(target, context, { flowName: 'SermonFlow' });

    // Register interceptor with custom latency
    // - Setting balance to 200 is slow (100ms) and denied
    // - Setting balance to 300 is fast (10ms) and allowed
    Interceptors.register(async (ctx) => {
      if (ctx.input && ctx.input.value === 200) {
        await new Promise((r) => setTimeout(r, 100));
        return false; // Deny
      }
      if (ctx.input && ctx.input.value === 300) {
        await new Promise((r) => setTimeout(r, 10));
        return undefined; // Observe/Allow
      }
      return undefined;
    });

    // Alice triggers Mutation 1 (sets balance to 200 - will deny after 100ms)
    proxy.balance = 200;
    
    // Bob triggers Mutation 2 immediately after (sets balance to 300 - will allow after 10ms)
    proxy.balance = 300;

    // Wait for both async validation evaluations to resolve
    await new Promise((r) => setTimeout(r, 150));

    // DEMONSTRATION OF STATE DIVERGENCE:
    // Even though Bob's Mutation 2 (value 300) was successfully allowed,
    // Alice's Mutation 1 (value 200) completed late and its rollback
    // restored the balance back to its original value (100).
    expect(proxy.balance).toBe(100); 
  });

  it('Scenario 2: Object Identity Breakdown in Lazy Proxy Wrapping', () => {
    const context = new MembraneContext({
      mode: 'strict',
      tenantId: 'tenant-identity',
      authorityRole: 'admin'
    });

    const target = {
      nested: {
        value: 'initial'
      }
    };

    const proxy = ProxyableBridge.wrap(target, context);

    const firstAccess = proxy.nested;
    const secondAccess = proxy.nested;

    // DEMONSTRATION OF REFERENTIAL INTEGRITY LOSS:
    // Every access of a nested property wraps it in a new proxy on-the-fly,
    // breaking standard object reference equality.
    expect(firstAccess).not.toBe(secondAccess);
  });

  it('Scenario 3: Non-Atomic Rollbacks and Partial State Corruption', async () => {
    const context = new MembraneContext({
      mode: 'strict',
      tenantId: 'tenant-atomicity',
      authorityRole: 'admin'
    });

    const target = {
      nested: {
        state: 'idle',
        count: 0
      }
    };

    const proxy = ProxyableBridge.wrap(target, context, { flowName: 'SermonFlow' });

    // We modify nested state:
    // 1. Invalid trajectory transition (idle -> published is illegal in SermonFlow)
    // 2. Normal counter modification (no trajectory flow constraints)
    
    const nested = proxy.nested;
    
    // Trajectory validation will run for this mutation (which will fail and rollback)
    context.run('property-mutator', 'cmd-part-1', {
      flowName: 'SermonFlow',
      fromState: 'idle',
      toState: 'published'
    }, async () => {
      nested.state = 'published';
      return true;
    });

    // This mutation succeeds since there are no trajectory rules for it
    nested.count = 5;

    // Wait for the async validations and rollbacks to execute
    await new Promise((r) => setTimeout(r, 30));

    // DEMONSTRATION OF PARTIAL STATE CORRUPTION:
    // The nested object has had its counter modified (5), but the state field was rolled back (idle).
    // The transaction boundaries failed to protect the logical mutation atomically.
    expect(nested.state).toBe('idle');
    expect(nested.count).toBe(5);
  });
});
