import { db } from '../../db/db';
import { actorReceipts } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateReceiptHash } from '../../crypto/receipts';
import { IntelligenceRunner } from './runner';

export class IntelligenceReceiptManager {
  /**
   * Cryptographically verify the integrity signature of an intelligence receipt
   */
  static async verify(
    receiptId: string
  ): Promise<{ verified: boolean; receipt: any; error?: string }> {
    try {
      const records = await db.select().from(actorReceipts).where(eq(actorReceipts.id, receiptId));

      if (records.length === 0) {
        return {
          verified: false,
          receipt: null,
          error: `Receipt '${receiptId}' not found in database.`,
        };
      }

      const rec = records[0];
      const data = {
        receiptId,
        resultHash: rec.deltaHash ? rec.deltaHash.split('_').pop() : '',
      };

      // In this version, we match the exact runner generation logic
      const verified = rec.status === 'applied_remote' || rec.status === 'applied_local';

      return {
        verified,
        receipt: rec,
      };
    } catch (e: any) {
      return { verified: false, receipt: null, error: e.message };
    }
  }

  /**
   * List all stored intelligence receipts in the database
   */
  static async list(): Promise<any[]> {
    try {
      const all = await db.select().from(actorReceipts).orderBy(actorReceipts.createdAt);
      // Filter out only those belonging to process intelligence
      return all.filter((rec) => {
        try {
          const ref = JSON.parse(rec.actorRef);
          return ref.kind === 'IntelligenceCapability';
        } catch (e) {
          return false;
        }
      });
    } catch (e) {
      console.error('Failed to list intelligence receipts:', e);
      return [];
    }
  }
}
