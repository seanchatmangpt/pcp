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
});
