import { OutboxManager } from '../outbox';
import { GraphDelta } from '../../hooks/engine';
import { VkgHook } from '../../hooks/types';
import crypto from 'crypto';

describe('OutboxManager', () => {
  let outbox: OutboxManager;

  const mockDelta: GraphDelta = {
    id: 'd1',
    subject: 'sub',
    predicate: 'pred',
    object: 'obj',
    timestamp: 12345,
  };

  const mockHook: VkgHook = {
    id: 'h1',
    name: 'test-hook',
    authority: 'client',
    mode: 'annotate',
    condition: { kind: 'pattern', pattern: 'pred' },
    effects: [],
    projections: [],
    supervisors: [],
    receipts: false,
  };

  const mockHookWithReceipt: VkgHook = {
    ...mockHook,
    id: 'h2',
    receipts: true,
  };

  beforeEach(() => {
    outbox = new OutboxManager();
  });

  it('should initialize correctly', () => {
    expect(outbox.processedCount).toBe(0);
    expect(outbox.getReceiptCount()).toBe(0);
  });

  it('should not flush if batched', () => {
    outbox.enqueue(mockDelta, mockHook, true);
    // Queue should have 1 item, but processedCount is 0
    expect(outbox.processedCount).toBe(0);
  });

  it('should flush immediately if not batched', () => {
    outbox.enqueue(mockDelta, mockHook, false);
    // Queue should be flushed, processedCount should be 1
    expect(outbox.processedCount).toBe(1);
    // But since mockHook.receipts is false, no receipt generated
    expect(outbox.getReceiptCount()).toBe(0);
  });

  it('should flush pending items', () => {
    outbox.enqueue(mockDelta, mockHook, true);
    outbox.enqueue(mockDelta, mockHook, true);
    
    expect(outbox.processedCount).toBe(0);
    
    outbox.flushPending();
    
    expect(outbox.processedCount).toBe(2);
    expect(outbox.getReceiptCount()).toBe(0);
  });

  it('should generate receipts if hook requires it', () => {
    outbox.enqueue(mockDelta, mockHookWithReceipt, false);
    
    expect(outbox.processedCount).toBe(1);
    expect(outbox.getReceiptCount()).toBe(1);
  });

  it('should chain receipt hashes correctly', () => {
    outbox.enqueue(mockDelta, mockHookWithReceipt, true);
    outbox.enqueue(mockDelta, mockHookWithReceipt, true);

    outbox.flushPending();

    expect(outbox.processedCount).toBe(2);
    expect(outbox.getReceiptCount()).toBe(2);

    // Verify hash calculations match the expected implementation
    // We can't access the private receipts array directly without casting
    const receipts = (outbox as any).receipts;
    
    const inputHash = crypto.createHash('sha256').update(mockDelta.subject).digest('hex');
    const outputHash = crypto.createHash('sha256').update(mockDelta.object).digest('hex');
    const deltaHash = crypto.createHash('sha256').update(mockDelta.predicate + mockDelta.timestamp).digest('hex');

    const expectedReceiptHash1 = crypto.createHash('sha256')
      .update('genesis_hash' + inputHash + outputHash + deltaHash)
      .digest('hex');

    expect(receipts[0]).toEqual({
      inputHash,
      outputHash,
      deltaHash,
      previousReceiptHash: 'genesis_hash',
      receiptHash: expectedReceiptHash1,
    });

    const expectedReceiptHash2 = crypto.createHash('sha256')
      .update(expectedReceiptHash1 + inputHash + outputHash + deltaHash)
      .digest('hex');

    expect(receipts[1]).toEqual({
      inputHash,
      outputHash,
      deltaHash,
      previousReceiptHash: expectedReceiptHash1,
      receiptHash: expectedReceiptHash2,
    });
  });
});
