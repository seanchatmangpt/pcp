import { SelfHealingMembrane } from '../index';
import { ProxyFactory } from '../../proxy';

describe('Self-Healing Membrane', () => {
  let membrane: SelfHealingMembrane;
  let target: any;

  beforeEach(() => {
    jest.useFakeTimers();
    target = { count: 0, nested: { value: 'test' } };
    membrane = new SelfHealingMembrane({ mode: 'strict', tenantId: 'test-tenant' }, target, {
      deadlockTimeoutMs: 1000,
      autoHeal: true,
      maxSnapshots: 50,
    });
  });

  afterEach(() => {
    if (membrane) membrane.dispose();
    jest.useRealTimers();
  });

  it('should capture snapshots after successful runs', async () => {
    const proxy = ProxyFactory.wrap(target, membrane);

    await membrane.run('test-cap', 'cmd-1', {}, async () => {
      proxy.count = 1;
      return { success: true };
    });

    // Verify snapshot was captured by triggering a heal
    target.count = 999;
    await membrane.selfHealing.heal();

    expect(target.count).toBe(1);
  });

  it('should detect state corruption and auto-heal before next run', async () => {
    const proxy = ProxyFactory.wrap(target, membrane);

    await membrane.run('test-cap', 'cmd-1', {}, async () => {
      proxy.count = 10;
      return true;
    });

    const history = membrane.receipts.getHistory();
    membrane.receipts.clear();
    membrane.receipts.append(history[0]);
    membrane.receipts.append({
      id: 'corrupted-rec',
      commandId: 'bad-cmd',
      capabilityId: 'bad-cap',
      timestamp: new Date().toISOString(),
      verdict: 'allow',
      success: true,
      deltaHash: 'wrong-hash',
      previousHash: 'invalid-prev-hash',
    });

    expect(membrane.receipts.validateChain().valid).toBe(false);

    target.count = 999;

    const result = await membrane.run('test-cap', 'cmd-2', {}, async () => {
      return proxy.count;
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe(10);
    expect(target.count).toBe(10);
  });

  it('should detect deadlocks and trigger healing', async () => {
    const proxy = ProxyFactory.wrap(target, membrane);
    await membrane.run('test-cap', 'cmd-1', {}, async () => {
      proxy.count = 42;
      return true;
    });

    target.count = 0;

    membrane.telemetry.emit({
      timestamp: new Date().toISOString(),
      type: 'span_start',
      traceId: 'deadlocked-trace-2',
      flowName: 'long-op-2',
    });

    jest.advanceTimersByTime(2500);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(target.count).toBe(42);
  });
});
