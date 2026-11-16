import { OutboxDelta, OutboxHook, OutboxReceipt } from './types';
import { sha256 } from '../../lib/crypto/receipts';

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
    const inputHash = sha256(delta.subject);
    const outputHash = sha256(delta.object);
    const deltaHash = sha256(delta.predicate + delta.timestamp.toString());

    // Link the chain
    const receiptHash = sha256(this.lastReceiptHash + inputHash + outputHash + deltaHash);

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
