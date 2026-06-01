/**
 * @fileoverview Tests for LocalInferenceEngine
 *
 * Covers:
 *  - Typestate flow (InferenceRequest → InferenceResponse)
 *  - BLAKE3 receipt generation and structural integrity
 *  - verifyInferenceReceipt (structural + full cryptographic)
 *  - Receipt chain linkage and verifyChain()
 *  - LLMAdapter pluggability
 *  - Error handling (InferenceExecutionError)
 *  - Legacy ILocalInferenceEngine compatibility (infer / streamInfer)
 *  - Process-conformance alignment invocation
 *  - buildInferenceRequest helper
 *  - defaultLocalInferenceEngine singleton
 */

import {
  LocalInferenceEngine,
  DefaultRulesAdapter,
  InferenceExecutionError,
  buildInferenceRequest,
  defaultLocalInferenceEngine,
  type InferenceRequest,
  type InferenceResponse,
  type InferenceReceipt,
  type LLMAdapter,
  type InferenceUsage,
  type VerificationResult,
} from '../LocalInferenceEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<InferenceRequest> = {}): InferenceRequest {
  return {
    requestId: `test_req_${Math.random().toString(36).slice(2)}`,
    modelId: 'test-model',
    prompt: 'Hello world',
    issuedAt: new Date().toISOString(),
    ...overrides,
  };
}

// A failing adapter — throws during run()
class FailingAdapter implements LLMAdapter {
  readonly modelId = 'fail-model';
  async run(_req: InferenceRequest): Promise<{ text: string; usage: InferenceUsage }> {
    throw new Error('Simulated adapter failure');
  }
  async stream(
    _req: InferenceRequest,
    _onToken: (t: string) => void
  ): Promise<{ text: string; usage: InferenceUsage }> {
    throw new Error('Simulated stream failure');
  }
}

// A controlled deterministic adapter
class StubAdapter implements LLMAdapter {
  readonly modelId = 'stub-model';
  constructor(private readonly fixedText = 'stub response text') {}

  async run(_req: InferenceRequest): Promise<{ text: string; usage: InferenceUsage }> {
    return {
      text: this.fixedText,
      usage: { promptTokens: 3, completionTokens: 3, totalTokens: 6 },
    };
  }

  async stream(
    _req: InferenceRequest,
    onToken: (t: string) => void
  ): Promise<{ text: string; usage: InferenceUsage }> {
    const tokens = this.fixedText.split(' ');
    for (const t of tokens) {
      onToken(t + ' ');
    }
    return {
      text: this.fixedText,
      usage: { promptTokens: 3, completionTokens: tokens.length, totalTokens: 3 + tokens.length },
    };
  }
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe('LocalInferenceEngine — inferTyped()', () => {
  let engine: LocalInferenceEngine;

  beforeEach(() => {
    engine = new LocalInferenceEngine(new StubAdapter('The answer is 42.'));
  });

  it('returns an InferenceResponse with correct text', async () => {
    const req = makeRequest({ prompt: 'What is the answer?' });
    const res: InferenceResponse = await engine.inferTyped(req);

    expect(res.text).toBe('The answer is 42.');
    expect(res.requestId).toBe(req.requestId);
  });

  it('response has usage statistics', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);

    expect(res.usage).toBeDefined();
    expect(res.usage.promptTokens).toBeGreaterThanOrEqual(0);
    expect(res.usage.completionTokens).toBeGreaterThanOrEqual(0);
    expect(res.usage.totalTokens).toBe(res.usage.promptTokens + res.usage.completionTokens);
  });

  it('response has a latencyMs value ≥ 0', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('response.completedAt is a valid ISO-8601 string', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);
    expect(() => new Date(res.completedAt).toISOString()).not.toThrow();
  });
});

describe('LocalInferenceEngine — BLAKE3 InferenceReceipt', () => {
  let engine: LocalInferenceEngine;

  beforeEach(() => {
    engine = new LocalInferenceEngine(new StubAdapter());
  });

  it('every InferenceResponse carries a receipt', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);

    expect(res.receipt).toBeDefined();
    expect(res.receipt.id).toBeTruthy();
    expect(res.receipt.requestId).toBe(req.requestId);
    expect(res.receipt.modelId).toBe(req.modelId);
    expect(res.receipt.onDevice).toBe(true);
  });

  it('receipt has non-empty BLAKE3 hash fields', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);

    expect(res.receipt.deltaHash).toMatch(/^[0-9a-f]{32,}$/);
    expect(res.receipt.payloadHash).toMatch(/^[0-9a-f]{32,}$/);
  });

  it('receipt hashTier is blake3 for the default adapter', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);
    expect(res.receipt.hashTier).toBe('blake3');
  });

  it('genesis receipt has empty previousHash', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);
    expect(res.receipt.previousHash).toBe('');
  });

  it('subsequent receipts are chained via previousHash', async () => {
    const r1 = await engine.inferTyped(makeRequest({ prompt: 'First' }));
    const r2 = await engine.inferTyped(makeRequest({ prompt: 'Second' }));

    expect(r2.receipt.previousHash).toBe(r1.receipt.deltaHash);
  });

  it('different prompts produce different deltaHashes', async () => {
    const r1 = await engine.inferTyped(makeRequest({ prompt: 'Alpha prompt' }));
    // Reset engine to clear chain so previousHash is the same for both
    const eng2 = new LocalInferenceEngine(new StubAdapter());
    const r2 = await eng2.inferTyped(makeRequest({ prompt: 'Beta prompt' }));

    expect(r1.receipt.deltaHash).not.toBe(r2.receipt.deltaHash);
  });
});

describe('LocalInferenceEngine — verifyInferenceReceipt()', () => {
  let engine: LocalInferenceEngine;

  beforeEach(() => {
    engine = new LocalInferenceEngine(new StubAdapter('test text'));
  });

  it('verifies a freshly generated receipt as valid', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);
    const result = engine.verifyInferenceReceipt(res.receipt);

    expect(result.valid).toBe(true);
  });

  it('rejects a receipt with tampered deltaHash', async () => {
    const req = makeRequest();
    const res = await engine.inferTyped(req);

    const tampered: InferenceReceipt = {
      ...res.receipt,
      deltaHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    };

    const result = engine.verifyInferenceReceipt(tampered);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('Hash chain broken');
  });

  it('rejects a receipt missing required identity fields', () => {
    const malformed = {
      id: '',
      requestId: '',
      modelId: '',
      deltaHash: 'abc',
      previousHash: '',
      payloadHash: 'def',
      hashTier: 'blake3' as const,
      issuedAt: new Date().toISOString(),
      onDevice: true as const,
    };

    const result = engine.verifyInferenceReceipt(malformed);
    expect(result.valid).toBe(false);
  });

  it('rejects a receipt with onDevice !== true', () => {
    const req = makeRequest();
    // We build a fake receipt with onDevice: false
    const fakeReceipt = {
      id: 'fake_id',
      requestId: req.requestId,
      modelId: req.modelId,
      deltaHash: 'aabbcc',
      previousHash: '',
      payloadHash: 'ddeeff',
      hashTier: 'blake3' as const,
      issuedAt: new Date().toISOString(),
      onDevice: false as unknown as true,
    };

    const result = engine.verifyInferenceReceipt(fakeReceipt);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('onDevice');
  });

  it('full verification passes with correct prompt and response', async () => {
    const prompt = 'Verify me please';
    const req = makeRequest({ prompt });
    const res = await engine.inferTyped(req);

    const result = engine.verifyInferenceReceiptFull(res.receipt, prompt, res.text);
    expect(result.valid).toBe(true);
  });

  it('full verification fails when responseText is tampered', async () => {
    const req = makeRequest({ prompt: 'Real prompt' });
    const res = await engine.inferTyped(req);

    const result = engine.verifyInferenceReceiptFull(res.receipt, req.prompt, 'TAMPERED response');
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('Payload hash mismatch');
  });

  it('full verification fails when prompt is tampered', async () => {
    const req = makeRequest({ prompt: 'Real prompt' });
    const res = await engine.inferTyped(req);

    const result = engine.verifyInferenceReceiptFull(res.receipt, 'TAMPERED prompt', res.text);
    expect(result.valid).toBe(false);
  });
});

describe('LocalInferenceEngine — verifyChain()', () => {
  it('empty chain is valid', () => {
    const engine = new LocalInferenceEngine(new StubAdapter());
    expect(engine.verifyChain().valid).toBe(true);
  });

  it('chain of three sequential inferences is valid', async () => {
    const engine = new LocalInferenceEngine(new StubAdapter());
    await engine.inferTyped(makeRequest({ prompt: 'First' }));
    await engine.inferTyped(makeRequest({ prompt: 'Second' }));
    await engine.inferTyped(makeRequest({ prompt: 'Third' }));

    const result = engine.verifyChain();
    expect(result.valid).toBe(true);
  });

  it('getReceiptChain() returns all receipts in order', async () => {
    const engine = new LocalInferenceEngine(new StubAdapter());
    const r1 = await engine.inferTyped(makeRequest({ prompt: 'A' }));
    const r2 = await engine.inferTyped(makeRequest({ prompt: 'B' }));

    const chain = engine.getReceiptChain();
    expect(chain).toHaveLength(2);
    expect(chain[0].requestId).toBe(r1.receipt.requestId);
    expect(chain[1].requestId).toBe(r2.receipt.requestId);
  });
});

describe('LocalInferenceEngine — LLMAdapter pluggability', () => {
  it('uses a custom adapter', async () => {
    const adapter = new StubAdapter('custom adapter output');
    const engine = new LocalInferenceEngine(adapter);

    const req = makeRequest();
    const res = await engine.inferTyped(req);

    expect(res.text).toBe('custom adapter output');
    expect(res.receipt.modelId).toBe('test-model');
  });

  it('setAdapter() hot-swaps the model at runtime', async () => {
    const engine = new LocalInferenceEngine(new StubAdapter('old model'));
    const res1 = await engine.inferTyped(makeRequest({ modelId: 'old' }));
    expect(res1.text).toBe('old model');

    engine.setAdapter(new StubAdapter('new model'));
    const res2 = await engine.inferTyped(makeRequest({ modelId: 'new' }));
    expect(res2.text).toBe('new model');
  });

  it('currentModelId reflects the active adapter', () => {
    const engine = new LocalInferenceEngine(new StubAdapter());
    expect(engine.currentModelId).toBe('stub-model');
  });
});

describe('LocalInferenceEngine — InferenceExecutionError', () => {
  it('throws InferenceExecutionError when adapter.run() fails', async () => {
    const engine = new LocalInferenceEngine(new FailingAdapter());
    const req = makeRequest();

    await expect(engine.inferTyped(req)).rejects.toThrow(InferenceExecutionError);
  });

  it('InferenceExecutionError carries the original request', async () => {
    const engine = new LocalInferenceEngine(new FailingAdapter());
    const req = makeRequest({ prompt: 'test error prompt' });

    try {
      await engine.inferTyped(req);
      fail('Expected InferenceExecutionError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InferenceExecutionError);
      expect((err as InferenceExecutionError).request.prompt).toBe('test error prompt');
    }
  });

  it('throws InferenceExecutionError when adapter.stream() fails', async () => {
    const engine = new LocalInferenceEngine(new FailingAdapter());
    const req = makeRequest({ stream: true });

    await expect(engine.streamInferTyped(req, () => {})).rejects.toThrow(InferenceExecutionError);
  });
});

describe('LocalInferenceEngine — streamInferTyped()', () => {
  it('calls onToken for each token', async () => {
    const engine = new LocalInferenceEngine(new StubAdapter('hello world stream'));
    const tokens: string[] = [];
    const req = makeRequest({ stream: true });

    await engine.streamInferTyped(req, (t) => tokens.push(t));

    expect(tokens.length).toBeGreaterThan(0);
  });

  it('returned text is non-empty', async () => {
    const engine = new LocalInferenceEngine(new StubAdapter('hello world stream'));
    const req = makeRequest({ stream: true });
    const res = await engine.streamInferTyped(req, () => {});

    expect(res.text).toBeTruthy();
  });

  it('streamed response also has a BLAKE3 receipt', async () => {
    const engine = new LocalInferenceEngine(new StubAdapter('streaming receipt test'));
    const req = makeRequest({ stream: true });
    const res = await engine.streamInferTyped(req, () => {});

    expect(res.receipt.onDevice).toBe(true);
    expect(res.receipt.hashTier).toBe('blake3');
  });
});

describe('LocalInferenceEngine — legacy ILocalInferenceEngine compatibility', () => {
  let engine: LocalInferenceEngine;

  beforeEach(() => {
    engine = new LocalInferenceEngine();
  });

  it('infer() resolves to LocalInferenceResult for a hello prompt', async () => {
    const result = await engine.infer({ prompt: 'Hello world' });

    expect(result.text).toContain('Hello');
    expect(result.usage).toBeDefined();
    expect(result.usage?.promptTokens).toBeGreaterThan(0);
    expect(result.usage?.completionTokens).toBeGreaterThan(0);
  });

  it('infer() uses specified modelId', async () => {
    const result = await engine.infer({ prompt: 'Hello', modelId: 'test-model-legacy' });
    expect(result.text).toContain('test-model-legacy');
  });

  it('streamInfer() calls onToken and returns assembled text', async () => {
    const tokens: string[] = [];
    const onToken = jest.fn((token: string) => tokens.push(token));

    const result = await engine.streamInfer({ prompt: 'Streaming test' }, onToken);

    expect(onToken).toHaveBeenCalled();
    expect(result.text).toBeTruthy();
  });

  it('conformance alignment executes for fitness prompt', async () => {
    const result = await engine.infer({ prompt: 'calculate conformance fitness' });

    expect(result.text).toContain('optimal A* state-space alignment search');
    expect(result.text).toContain('Alignment Fitness: 1.0000');
    expect(result.text).toContain('Conforming: true');
  });

  it('conformance alignment detects deviation for error prompt', async () => {
    const result = await engine.infer({ prompt: 'show conformance deviation error' });

    expect(result.text).toContain('optimal A* state-space alignment search');
    expect(result.text).toContain('Conforming: false');
    expect(result.text).toContain('Alignment Cost: 1');
  });

  it('infer() still appends to receipt chain', async () => {
    const freshEngine = new LocalInferenceEngine();
    await freshEngine.infer({ prompt: 'First call' });
    await freshEngine.infer({ prompt: 'Second call' });

    const chain = freshEngine.getReceiptChain();
    expect(chain).toHaveLength(2);
    expect(chain[1].previousHash).toBe(chain[0].deltaHash);
  });
});

describe('buildInferenceRequest helper', () => {
  it('generates a unique requestId each time', () => {
    const r1 = buildInferenceRequest('prompt a');
    const r2 = buildInferenceRequest('prompt b');
    expect(r1.requestId).not.toBe(r2.requestId);
  });

  it('uses default modelId when not specified', () => {
    const req = buildInferenceRequest('test');
    expect(req.modelId).toBe('phi-2-orange');
  });

  it('accepts optional overrides', () => {
    const req = buildInferenceRequest('test', { modelId: 'custom-model', maxTokens: 256 });
    expect(req.modelId).toBe('custom-model');
    expect(req.maxTokens).toBe(256);
  });

  it('issuedAt is a valid ISO-8601 string', () => {
    const req = buildInferenceRequest('test');
    expect(() => new Date(req.issuedAt).toISOString()).not.toThrow();
  });
});

describe('DefaultRulesAdapter', () => {
  let adapter: DefaultRulesAdapter;

  beforeEach(() => {
    adapter = new DefaultRulesAdapter('test-rules-model');
  });

  it('responds with greeting for hello prompt', async () => {
    const req = makeRequest({ prompt: 'Hello there', modelId: 'test-rules-model' });
    const result = await adapter.run(req);
    expect(result.text).toContain('Hello');
  });

  it('responds with conformance analysis for fitness prompt', async () => {
    const req = makeRequest({ prompt: 'conformance fitness check', modelId: 'test-rules-model' });
    const result = await adapter.run(req);
    expect(result.text).toContain('optimal A* state-space alignment search');
  });

  it('responds with profile analysis for account prompt', async () => {
    const req = makeRequest({ prompt: 'view account profile', modelId: 'test-rules-model' });
    const result = await adapter.run(req);
    expect(result.text).toContain('Local profile analysis');
  });

  it('responds with general query text for unknown prompts', async () => {
    // NOTE: prompt must not contain 'hi', 'hello', 'fitness', 'conformance',
    // 'alignment', 'profile', or 'account' as substrings.
    // 'something' contains 'hi' via substring — use a safe neutral prompt.
    const req = makeRequest({ prompt: 'evaluate general query now', modelId: 'test-rules-model' });
    const result = await adapter.run(req);
    expect(result.text).toContain('general query');
  });

  it('stream() calls onToken for each token chunk', async () => {
    const req = makeRequest({ prompt: 'Hello streaming test', modelId: 'test-rules-model' });
    const tokens: string[] = [];
    const result = await adapter.stream(req, (t) => tokens.push(t));
    expect(tokens.length).toBeGreaterThan(0);
    expect(result.text).toBeTruthy();
  });

  it('modelId defaults to phi-2-orange when none specified', () => {
    const defaultAdapter = new DefaultRulesAdapter();
    expect(defaultAdapter.modelId).toBe('phi-2-orange');
  });
});

describe('defaultLocalInferenceEngine singleton', () => {
  it('is an instance of LocalInferenceEngine', () => {
    expect(defaultLocalInferenceEngine).toBeInstanceOf(LocalInferenceEngine);
  });

  it('can infer without configuration', async () => {
    const result = await defaultLocalInferenceEngine.infer({ prompt: 'Hello from singleton' });
    expect(result.text).toBeTruthy();
  });
});
