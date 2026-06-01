import { MembraneReceipt } from './types';

export class MembraneChain {
  private receipts: MembraneReceipt[] = [];

  append(receipt: MembraneReceipt) {
    this.receipts.push(receipt);
    this.receipts.sort((a, b) => a.timestamp - b.timestamp);
  }

  getReceipts(): MembraneReceipt[] {
    return [...this.receipts];
  }

  getReceiptAt(timestamp: number): MembraneReceipt | null {
    // Find exact or closest preceding
    const past = this.receipts.filter((r) => r.timestamp <= timestamp);
    if (past.length === 0) return null;
    return past[past.length - 1];
  }

  clear() {
    this.receipts = [];
  }
}
