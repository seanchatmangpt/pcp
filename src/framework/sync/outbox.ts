import crypto from 'crypto';
import { OutboxDelta, OutboxHook, OutboxReceipt } from './types';

export class FrameworkOutboxManager<
  TDelta extends OutboxDelta = OutboxDelta,
  THook extends OutboxHook = OutboxHook,
> {
  protected queue: { delta: TDelta; hook: THook; isBatched: boolean }[] = [];
  protected receipts: OutboxReceipt[] = [];
  protected lastReceiptHash: string = 'genesis_hash';

  public processedCount = 0;

  enqueue(delta: TDelta, hook: THook, isBatched: boolean) {
    this.queue.push({ delta, hook, isBatched });

    // For high concurrency, we simulate a fast flush if not batched
    if (!isBatched) {
      this.flushPending();
    }
  }

  flushPending() {
    const toProcess = this.queue.splice(0, this.queue.length);
    for (const item of toProcess) {
      this.generateReceipt(item.delta, item.hook);
      this.processedCount++;
    }
  }

  protected generateReceipt(delta: TDelta, hook: THook) {
    if (!hook.receipts) return;

    // Simulate input/output hashes quickly
    const inputHash = crypto.createHash('sha256').update(delta.subject).digest('hex');
    const outputHash = crypto.createHash('sha256').update(delta.object).digest('hex');
    const deltaHash = crypto
      .createHash('sha256')
      .update(delta.predicate + delta.timestamp.toString())
      .digest('hex');

    // Link the chain
    const receiptHash = crypto
      .createHash('sha256')
      .update(this.lastReceiptHash + inputHash + outputHash + deltaHash)
      .digest('hex');

    const receipt: OutboxReceipt = {
      inputHash,
      outputHash,
      deltaHash,
      previousReceiptHash: this.lastReceiptHash,
      receiptHash,
    };

    this.receipts.push(receipt);
    this.lastReceiptHash = receiptHash;
  }

  getReceiptCount(): number {
    return this.receipts.length;
  }
}
