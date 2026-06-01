import { MembraneReceipt } from './types';
import { sha256, canonicalStringify } from '../crypto/receipts';

export class Receipts {
  private static chain: MembraneReceipt[] = [];

  static clear() {
    this.chain = [];
  }

  static append(receipt: MembraneReceipt) {
    this.chain.push(receipt);
  }

  static getLastHash(): string {
    if (this.chain.length === 0) return '';
    return this.chain[this.chain.length - 1].deltaHash;
  }

  static getHistory(): MembraneReceipt[] {
    return this.chain;
  }

  /**
   * Emit a refutation receipt (negative outcome)
   */
  static async emitRefusal(
    commandId: string,
    capabilityId: string,
    prevHash: string,
    errorMsg: string
  ): Promise<MembraneReceipt> {
    const timestamp = new Date().toISOString();
    const data = { commandId, capabilityId, error: errorMsg, success: false };
    const resultHash = sha256(canonicalStringify(data));
    const hash = sha256(prevHash + resultHash);

    const receipt: MembraneReceipt = {
      id: `rec_refuse_${Math.random().toString(36).substr(2, 9)}`,
      commandId,
      capabilityId,
      timestamp,
      verdict: 'deny',
      success: false,
      deltaHash: hash,
      previousHash: prevHash,
      error: errorMsg,
      resultHash
    };

    this.append(receipt);
    return receipt;
  }

  /**
   * Validate chain lineage continuity
   */
  static validateChain(c: MembraneReceipt[]): { valid: boolean; error?: string } {
    for (let i = 0; i < c.length; i++) {
      const prevHash = i === 0 ? '' : c[i - 1].deltaHash;
      const rec = c[i];
      if (rec.previousHash !== prevHash) {
        return { valid: false, error: `broken lineage at index ${i}` };
      }
      const expectedHash = sha256(prevHash + (rec.resultHash || ''));
      if (rec.deltaHash !== expectedHash) {
        return { valid: false, error: `invalid hash signature at index ${i}` };
      }
    }
    return { valid: true };
  }
}
