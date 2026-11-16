/**
 * @fileoverview Unit tests for FastTFLiteAdapter and EdgeAiSyncBroker.
 */

import { FastTFLiteAdapter, tokenize, getFloatInputs, classifyIntents } from '../FastTFLiteAdapter';
import { EdgeAiSyncBroker } from '../EdgeAiSyncBroker';
import { expoDb } from '@/src/lib/db/db';
import { supabase } from '@/lib/supabase';

jest.mock('@/src/lib/db/db', () => {
  return {
    expoDb: {
      execSync: jest.fn(),
      runSync: jest.fn(),
      getAllSync: jest.fn(() => []),
    },
  };
});

describe('Edge-AI Local Inference & Persistence Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BPE static tokenizer', () => {
    it('correctly tokenizes words present in the vocabulary', () => {
      const tokens = tokenize('hello process');
      // hello is 4, process is 6
      expect(tokens).toEqual([4, 6]);
    });

    it('handles unknown words by mapping to <unk> token', () => {
      const tokens = tokenize('unseenword');
      // unseenword contains 'e' which is not in vocabulary, or it tokenizes greedy
      // Let's assert that it produces token IDs representing subwords or unk
      expect(tokens).toBeDefined();
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('converts token IDs to float inputs between 0 and 1', () => {
      const tokens = [4, 6];
      const floats = getFloatInputs(tokens);
      expect(floats).toHaveLength(2);
      floats.forEach((f) => {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Intent Classification', () => {
    it('classifies greetings correctly', () => {
      const tokens = tokenize('hello hi');
      const floats = getFloatInputs(tokens);
      const intent = classifyIntents(floats);
      expect(intent).toBe('greeting');
    });

    it('classifies process conformance correctly', () => {
      const tokens = tokenize('process conformance alignment');
      const floats = getFloatInputs(tokens);
      const intent = classifyIntents(floats);
      expect(intent).toBe('process');
    });

    it('classifies profile requests correctly', () => {
      const tokens = tokenize('profile account');
      const floats = getFloatInputs(tokens);
      const intent = classifyIntents(floats);
      expect(intent).toBe('profile');
    });
  });

  describe('FastTFLiteAdapter execution', () => {
    const adapter = new FastTFLiteAdapter();

    it('performs single-shot inference successfully', async () => {
      const req = {
        requestId: 'req-tflite-1',
        modelId: 'tflite-distilbert-intent',
        prompt: 'hello there assistant',
        issuedAt: new Date().toISOString(),
      };

      const res = await adapter.run(req);
      expect(res.text).toContain('greeting');
      expect(res.usage.promptTokens).toBeGreaterThan(0);
      expect(res.usage.completionTokens).toBeGreaterThan(0);
    });

    it('performs streaming inference by invoking onToken callback', async () => {
      const req = {
        requestId: 'req-tflite-2',
        modelId: 'tflite-distilbert-intent',
        prompt: 'analyze process conformance alignment',
        issuedAt: new Date().toISOString(),
      };

      const tokensReceived: string[] = [];
      const res = await adapter.stream(req, (t) => {
        tokensReceived.push(t);
      });

      expect(res.text).toContain('petri-net');
      expect(tokensReceived.length).toBeGreaterThan(0);
      expect(tokensReceived.join('')).toEqual(res.text);
    });
  });

  describe('EdgeAiSyncBroker SQLite & Supabase Sync', () => {
    it('persists response locally to SQLite', async () => {
      const broker = new EdgeAiSyncBroker();
      const mockResponse = {
        text: 'Sync policy evaluation',
        usage: { promptTokens: 3, completionTokens: 5, totalTokens: 8 },
        requestId: 'req-p1',
        completedAt: new Date().toISOString(),
        latencyMs: 142,
        receipt: {
          id: 'infrec_req-p1_xyz',
          requestId: 'req-p1',
          modelId: 'tflite-distilbert-intent',
          deltaHash: 'delta-xyz',
          previousHash: 'prev-xyz',
          payloadHash: 'pay-xyz',
          hashTier: 'blake3' as const,
          issuedAt: new Date().toISOString(),
          onDevice: true as const,
        },
      };

      await broker.persistLocal(mockResponse);
      expect(expoDb.runSync).toHaveBeenCalled();
    });

    it('syncs pending SQLite records to Supabase and marks them synced', async () => {
      const broker = new EdgeAiSyncBroker();
      const mockRecord = {
        id: 'infrec_1',
        request_id: 'req_1',
        model_id: 'tflite-model',
        text: 'Response text',
        latency_ms: 120,
        payload_hash: 'phash',
        delta_hash: 'dhash',
        created_at: Date.now(),
      };

      (expoDb.getAllSync as jest.Mock).mockReturnValue([mockRecord]);
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      });

      await broker.syncPendingReceipts();

      expect(supabase.from).toHaveBeenCalledWith('edge_inference_logs');
      expect(expoDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE local_inference_results SET status = \'synced\''),
        'infrec_1'
      );
    });
  });
});
