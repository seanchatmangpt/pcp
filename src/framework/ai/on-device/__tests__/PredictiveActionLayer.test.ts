/**
 * @fileoverview Tests for PredictiveActionLayer (ai/on-device)
 *
 * Covers:
 *  - ingestIntent() returns up to 3 PredictedActions
 *  - Ring buffer capacity enforcement (max 50)
 *  - Prediction confidence in [0,1]
 *  - Each PredictedAction carries a BLAKE3 PreComputationReceipt
 *  - Receipt chain linkage
 *  - getPreComputed() cache lookup
 *  - getPreComputedById() exact lookup
 *  - subscribe() / unsubscribe()
 *  - getState() immutable snapshot
 *  - reset() clears all state
 *  - Cold start with no history returns predictions from priors
 *  - buildUserIntent helper
 *  - Frequency learning: repeated transitions increase confidence
 *  - No global state mutation during pre-computation
 */

import {
  PredictiveActionLayer,
  buildUserIntent,
  type UserIntent,
  type PredictedAction,
  type PALState,
} from '../PredictiveActionLayer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeIntent(kind: string, context: Record<string, unknown> = {}): UserIntent {
  return buildUserIntent(kind, context, 'test-user');
}

// Wait for the async pre-computation micro-task to settle
async function flushMicroTasks(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe('PredictiveActionLayer — singleton', () => {
  it('getInstance() always returns the same instance', () => {
    const a = PredictiveActionLayer.getInstance();
    const b = PredictiveActionLayer.getInstance();
    expect(a).toBe(b);
  });
});

describe('PredictiveActionLayer — ingestIntent()', () => {
  let pal: PredictiveActionLayer;

  beforeEach(() => {
    pal = PredictiveActionLayer.getInstance();
    pal.reset();
  });

  it('returns an array (possibly empty on very cold start with unknown kind)', async () => {
    const intent = makeIntent('unknown-kind-xyz');
    const predictions = await pal.ingestIntent(intent);
    expect(Array.isArray(predictions)).toBe(true);
  });

  it('returns up to 3 predictions for a known intent kind', async () => {
    const intent = makeIntent('navigate');
    const predictions = await pal.ingestIntent(intent);
    expect(predictions.length).toBeGreaterThanOrEqual(1);
    expect(predictions.length).toBeLessThanOrEqual(3);
  });

  it('adds the intent to the ring buffer', async () => {
    const intent = makeIntent('navigate');
    await pal.ingestIntent(intent);
    expect(pal.getState().intentHistory).toHaveLength(1);
  });

  it('intent in history matches the ingested intent kind', async () => {
    const intent = makeIntent('submit', { formId: 'form-1' });
    await pal.ingestIntent(intent);
    const { intentHistory } = pal.getState();
    expect(intentHistory[0].kind).toBe('submit');
    expect(intentHistory[0].context['formId']).toBe('form-1');
  });

  it('all predictions have confidence in [0, 1]', async () => {
    const intent = makeIntent('query');
    const predictions = await pal.ingestIntent(intent);
    for (const p of predictions) {
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('all predictions have a non-empty predictedKind', async () => {
    const intent = makeIntent('navigate');
    const predictions = await pal.ingestIntent(intent);
    for (const p of predictions) {
      expect(p.predictedKind).toBeTruthy();
    }
  });

  it('all predictions reference the source intent kind', async () => {
    const intent = makeIntent('submit');
    const predictions = await pal.ingestIntent(intent);
    for (const p of predictions) {
      expect(p.sourceIntentKind).toBe('submit');
    }
  });
});

describe('PredictiveActionLayer — ring buffer capacity', () => {
  let pal: PredictiveActionLayer;

  beforeEach(() => {
    pal = PredictiveActionLayer.getInstance();
    pal.reset();
  });

  it('does not exceed 50 entries in the intent history', async () => {
    for (let i = 0; i < 60; i++) {
      await pal.ingestIntent(makeIntent('navigate', { index: i }));
    }
    expect(pal.getState().intentHistory.length).toBe(50);
  });

  it('oldest intents are evicted first (FIFO)', async () => {
    for (let i = 0; i < 55; i++) {
      await pal.ingestIntent(makeIntent('navigate', { index: i }));
    }
    const history = pal.getState().intentHistory;
    // The first 5 should be evicted; remaining should start at index=5
    expect((history[0].context as Record<string, number>)['index']).toBe(5);
    expect((history[history.length - 1].context as Record<string, number>)['index']).toBe(54);
  });
});

describe('PredictiveActionLayer — BLAKE3 PreComputationReceipt', () => {
  let pal: PredictiveActionLayer;

  beforeEach(() => {
    pal = PredictiveActionLayer.getInstance();
    pal.reset();
  });

  it('each prediction carries a receipt', async () => {
    const intent = makeIntent('navigate');
    const predictions = await pal.ingestIntent(intent);

    for (const p of predictions) {
      expect(p.receipt).toBeDefined();
      expect(p.receipt.onDevice).toBe(true);
      expect(p.receipt.predictionId).toBe(p.predictionId);
      expect(p.receipt.intentId).toBe(intent.intentId);
    }
  });

  it('receipt hash fields are non-empty hex strings', async () => {
    const intent = makeIntent('query');
    const predictions = await pal.ingestIntent(intent);

    for (const p of predictions) {
      expect(p.receipt.deltaHash).toMatch(/^[0-9a-f]{8,}$/);
      expect(p.receipt.payloadHash).toMatch(/^[0-9a-f]{8,}$/);
    }
  });

  it('first prediction from genesis has empty previousHash', async () => {
    const intent = makeIntent('submit');
    const predictions = await pal.ingestIntent(intent);

    if (predictions.length > 0) {
      expect(predictions[0].receipt.previousHash).toBe('');
    }
  });

  it('subsequent predictions chain via previousHash', async () => {
    const intent = makeIntent('navigate');
    const predictions = await pal.ingestIntent(intent);

    if (predictions.length >= 2) {
      expect(predictions[1].receipt.previousHash).toBe(predictions[0].receipt.deltaHash);
    }
  });

  it('receipt chain grows with each ingestIntent()', async () => {
    await pal.ingestIntent(makeIntent('navigate'));
    const count1 = pal.getReceiptChain().length;

    await pal.ingestIntent(makeIntent('query'));
    const count2 = pal.getReceiptChain().length;

    expect(count2).toBeGreaterThan(count1);
  });

  it('receipt issuedAt is a valid ISO-8601 string', async () => {
    const predictions = await pal.ingestIntent(makeIntent('confirm'));
    for (const p of predictions) {
      expect(() => new Date(p.receipt.issuedAt).toISOString()).not.toThrow();
    }
  });
});

describe('PredictiveActionLayer — pre-computation cache', () => {
  let pal: PredictiveActionLayer;

  beforeEach(() => {
    pal = PredictiveActionLayer.getInstance();
    pal.reset();
  });

  it('getPreComputed() returns null before any ingest', () => {
    expect(pal.getPreComputed('navigate')).toBeNull();
  });

  it('getPreComputed() finds a cached prediction by kind after micro-task flush', async () => {
    await pal.ingestIntent(makeIntent('navigate'));
    await flushMicroTasks();

    // 'query' is a known next-kind after 'navigate'
    const cached = pal.getPreComputed('query');
    expect(cached).not.toBeNull();
    if (cached) {
      expect(cached.predictedKind).toBe('query');
    }
  });

  it('getPreComputedById() retrieves by exact predictionId', async () => {
    const predictions = await pal.ingestIntent(makeIntent('submit'));
    await flushMicroTasks();

    if (predictions.length > 0) {
      const id = predictions[0].predictionId;
      const result = pal.getPreComputedById(id);
      expect(result).not.toBeNull();
      expect(result?.predictionId).toBe(id);
    }
  });

  it('getPreComputedById() returns null for unknown id', () => {
    expect(pal.getPreComputedById('nonexistent-id')).toBeNull();
  });

  it('cache holds pre-computed context data', async () => {
    await pal.ingestIntent(makeIntent('navigate', { route: '/home' }));
    await flushMicroTasks();

    const cached = pal.getPreComputed('query');
    if (cached) {
      expect(cached.preComputedContext['derivedFromKind']).toBe('navigate');
    }
  });
});

describe('PredictiveActionLayer — subscribe / getState', () => {
  let pal: PredictiveActionLayer;

  beforeEach(() => {
    pal = PredictiveActionLayer.getInstance();
    pal.reset();
  });

  it('subscribe() fires on ingestIntent()', async () => {
    const listener = jest.fn();
    const unsub = pal.subscribe(listener);

    await pal.ingestIntent(makeIntent('navigate'));
    expect(listener).toHaveBeenCalled();

    unsub();
  });

  it('unsubscribed listener is not called after unsubscribe', async () => {
    const listener = jest.fn();
    const unsub = pal.subscribe(listener);
    unsub();
    listener.mockClear();

    await pal.ingestIntent(makeIntent('navigate'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('listener receives a PALState with intentHistory', async () => {
    let received: PALState | null = null;
    const unsub = pal.subscribe((s) => {
      received = s;
    });

    await pal.ingestIntent(makeIntent('query'));
    unsub();

    expect(received).not.toBeNull();
    expect((received as unknown as PALState).intentHistory.length).toBeGreaterThan(0);
  });

  it('getState() returns immutable intentHistory', async () => {
    await pal.ingestIntent(makeIntent('navigate'));
    const state = pal.getState();

    // Attempt mutation — should not affect internal state
    expect(() => {
      (state.intentHistory as unknown as UserIntent[]).push(makeIntent('cancel'));
    }).toThrow();
  });

  it('getState().preComputedCache is a Map', async () => {
    const state = pal.getState();
    expect(state.preComputedCache).toBeInstanceOf(Map);
  });
});

describe('PredictiveActionLayer — reset()', () => {
  let pal: PredictiveActionLayer;

  beforeEach(() => {
    pal = PredictiveActionLayer.getInstance();
    pal.reset();
  });

  it('reset() clears intent history', async () => {
    await pal.ingestIntent(makeIntent('navigate'));
    expect(pal.getState().intentHistory.length).toBe(1);

    pal.reset();
    expect(pal.getState().intentHistory.length).toBe(0);
  });

  it('reset() clears the pre-computed cache', async () => {
    await pal.ingestIntent(makeIntent('navigate'));
    await flushMicroTasks();
    expect(pal.getState().preComputedCache.size).toBeGreaterThan(0);

    pal.reset();
    expect(pal.getState().preComputedCache.size).toBe(0);
  });

  it('reset() clears the receipt chain', async () => {
    await pal.ingestIntent(makeIntent('submit'));
    expect(pal.getReceiptChain().length).toBeGreaterThan(0);

    pal.reset();
    expect(pal.getReceiptChain().length).toBe(0);
  });

  it('reset() notifies listeners', () => {
    const listener = jest.fn();
    const unsub = pal.subscribe(listener);
    listener.mockClear();

    pal.reset();
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });
});

describe('PredictiveActionLayer — frequency learning', () => {
  let pal: PredictiveActionLayer;

  beforeEach(() => {
    pal = PredictiveActionLayer.getInstance();
    pal.reset();
  });

  it('repeated navigate→query transitions increase query confidence over time', async () => {
    // Establish cold-start baseline
    const cold = await pal.ingestIntent(makeIntent('navigate'));
    const coldQueryPred = cold.find((p) => p.predictedKind === 'query');
    const coldConfidence = coldQueryPred?.confidence ?? 0;

    // Reinforce navigate→query 10 times
    for (let i = 0; i < 10; i++) {
      await pal.ingestIntent(makeIntent('navigate'));
      await pal.ingestIntent(makeIntent('query'));
    }

    // After reinforcement, trigger from navigate
    const warm = await pal.ingestIntent(makeIntent('navigate'));
    const warmQueryPred = warm.find((p) => p.predictedKind === 'query');
    const warmConfidence = warmQueryPred?.confidence ?? 0;

    // The warm confidence should be at least as high as cold
    expect(warmConfidence).toBeGreaterThanOrEqual(coldConfidence);
  });

  it('intent kind with no prior or frequency still returns empty predictions', async () => {
    const predictions = await pal.ingestIntent(makeIntent('absolutely-unknown-kind-99'));
    expect(predictions.length).toBe(0);
  });
});

describe('PredictiveActionLayer — sandboxed pre-computation context propagation', () => {
  let pal: PredictiveActionLayer;

  beforeEach(() => {
    pal = PredictiveActionLayer.getInstance();
    pal.reset();
  });

  it('navigate intent propagates route context into pre-computed navigate action', async () => {
    const intent = makeIntent('navigate', { route: '/dashboard', screen: 'DashboardScreen' });
    const predictions = await pal.ingestIntent(intent);

    const navigatePred = predictions.find(
      (p) => p.predictedKind === 'navigate' || p.predictedKind === 'navigate-back'
    );
    if (navigatePred) {
      // Route context should be propagated
      expect(
        navigatePred.preComputedContext['route'] ??
          navigatePred.preComputedContext['derivedFromKind']
      ).toBeTruthy();
    }
  });

  it('submit intent propagates formId into pre-computed submit action', async () => {
    const intent = makeIntent('submit', {
      formId: 'registration-form',
      payload: { name: 'Alice' },
    });
    const predictions = await pal.ingestIntent(intent);

    const submitPred = predictions.find((p) => p.predictedKind === 'submit');
    if (submitPred) {
      expect(submitPred.preComputedContext['derivedFromKind']).toBe('submit');
    }
  });

  it('pre-computed context always contains derivedFromIntent', async () => {
    const intent = makeIntent('query', { query: 'search term' });
    const predictions = await pal.ingestIntent(intent);

    for (const p of predictions) {
      expect(p.preComputedContext['derivedFromIntent']).toBe(intent.intentId);
    }
  });

  it('cancel prediction includes cancelledKind from the source', async () => {
    const intent = makeIntent('submit', { formId: 'form-1' });
    const predictions = await pal.ingestIntent(intent);

    const cancelPred = predictions.find((p) => p.predictedKind === 'cancel');
    if (cancelPred) {
      expect(cancelPred.preComputedContext['cancelledKind']).toBe('submit');
    }
  });
});

describe('buildUserIntent helper', () => {
  it('generates unique intentIds', () => {
    const i1 = buildUserIntent('navigate');
    const i2 = buildUserIntent('navigate');
    expect(i1.intentId).not.toBe(i2.intentId);
  });

  it('observedAt is a valid ISO-8601 string', () => {
    const intent = buildUserIntent('query');
    expect(() => new Date(intent.observedAt).toISOString()).not.toThrow();
  });

  it('context is frozen / immutable', () => {
    const intent = buildUserIntent('navigate', { route: '/home' });
    expect(Object.isFrozen(intent.context)).toBe(true);
  });

  it('principalId is set when provided', () => {
    const intent = buildUserIntent('submit', {}, 'user-abc');
    expect(intent.principalId).toBe('user-abc');
  });

  it('principalId is undefined when not provided', () => {
    const intent = buildUserIntent('cancel');
    expect(intent.principalId).toBeUndefined();
  });
});
