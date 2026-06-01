import { mmkvInstance } from '@/src/lib/store/mmkvStorage';
import { db } from '@/src/lib/db/db';
const syncQueue = {} as any;

/**
 * StatePoisoner bypasses the Operational Membrane and directly injects
 * corrupted data into the underlying persistence layers (MMKV & SQLite)
 * to test the AutonomousRepairAgent and SelfHealingManager.
 */
export class StatePoisoner {
  /**
   * Injects invalid JSON or conflicting types directly into the MMKV store.
   */
  static poisonMmkvCache(key: string) {
    // Write an unparseable object string to break JSON.parse expectations
    mmkvInstance.set(key, '{"broken_json": true, "missing_bracket": ');
  }

  /**
   * Inserts mathematically impossible states into the local sync queue.
   */
  static async poisonSyncQueue() {
    // Inject a job with a null status, which breaks typescript constraints
    await db.insert(syncQueue).values({
      id: `poison_${Date.now()}`,
      jobType: 'CRITICAL_MUTATION',
      payload: '{"intent": "delete_all"}',
      status: 'pending', // Will be mutated via raw SQL if needed, but for now we rely on the payload structure
      attempts: -100, // Impossible attempt count
    } as any);
  }

  /**
   * Overwrites the cryptographic receipt history with a fragmented chain.
   */
  static poisonMembraneChain(membraneInstance: any) {
    // Replaces the receipt history array with an invalid structure to trigger validateChain() failure
    membraneInstance.receipts.clear();
    membraneInstance.receipts.append({
      id: 'fake-id',
      commandId: 'fake',
      capabilityId: 'fake',
      timestamp: 'fake',
      verdict: 'allow',
      success: true,
      deltaHash: '0x000',
      previousHash: 'NON_EXISTENT_HASH_123',
    });
  }
}
