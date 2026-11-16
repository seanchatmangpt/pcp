/**
 * @fileoverview TrueXPowerSyncDB enforcing PATQ laws, SQLite transactions, and BLAKE3 receipts.
 */

import { db, expoDb } from '@/src/lib/db/db';
import { syncQueue, syncAdmissionReceipts, syncJobQuarantine } from '@/src/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { blake3, canonicalStringify } from '@/src/lib/crypto/receipts';

// Ensure the SQLite profiles table exists physically
expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "profiles" (
    "id" TEXT PRIMARY KEY,
    "username" TEXT,
    "full_name" TEXT,
    "website" TEXT,
    "avatar_url" TEXT,
    "updated_at" TEXT
  );
`);

// Local Drizzle representation of profiles table for type-safe execution
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  username: text('username'),
  fullName: text('full_name'),
  website: text('website'),
  avatarUrl: text('avatar_url'),
  updatedAt: text('updated_at'),
});

export interface AdmissionDecision {
  verdict: 'admit' | 'reject';
  reason?: string;
}

/**
 * AdmissionGate validating incoming entity inputs before queueing.
 */
export class AdmissionGate {
  evaluate(jobType: string, entityId: string | null, payload: any): AdmissionDecision {
    if (!entityId || entityId.trim().length === 0) {
      return { verdict: 'reject', reason: 'entityId must be non-empty' };
    }
    if (!jobType || jobType.trim().length === 0) {
      return { verdict: 'reject', reason: 'jobType must be non-empty' };
    }
    if (!payload) {
      return { verdict: 'reject', reason: 'payload must be non-empty' };
    }

    if (jobType === 'profiles' || jobType.toLowerCase().includes('profile')) {
      if (typeof payload !== 'object') {
        return { verdict: 'reject', reason: 'payload must be an object' };
      }
      if ('username' in payload && (payload.username === undefined || payload.username === null || payload.username.trim() === '')) {
        return { verdict: 'reject', reason: 'username must be a non-empty string' };
      }
    }

    return { verdict: 'admit' };
  }
}

export class TrueXPowerSyncDB {
  private gate = new AdmissionGate();

  /**
   * Performs an atomic write transaction enforcing PATQ rules:
   * 1. Runs AdmissionGate to evaluate candidate inputs.
   * 2. Quarantines and throws on gate rejection.
   * 3. Fetches latest receipt hash or defaults to genesis.
   * 4. Generates BLAKE3 chained receipt hash.
   * 5. Atomically inserts job/receipt and updates target profiles table.
   */
  async writeTransaction(jobType: string, entityId: string, payload: any): Promise<string> {
    const decision = this.gate.evaluate(jobType, entityId, payload);
    
    if (decision.verdict === 'reject') {
      await db.insert(syncJobQuarantine).values({
        jobType,
        payload: canonicalStringify(payload),
        entityId,
        rejectionReason: decision.reason || 'Input validation failed',
        verdict: 'reject',
        createdAt: new Date(),
      });
      throw new Error(`PATQ AdmissionGate rejected job: ${decision.reason}`);
    }

    const admittedAt = new Date().toISOString();

    const finalReceiptHash = await db.transaction(async (tx) => {
      // 1. Insert job into syncQueue
      const queueInsert = await tx.insert(syncQueue).values({
        jobType,
        payload: canonicalStringify(payload),
        entityId,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      }).returning({ id: syncQueue.id });

      const jobId = queueInsert[0]?.id || null;

      // 2. Fetch latest receipt hash
      const latestReceipts = await tx
        .select()
        .from(syncAdmissionReceipts)
        .orderBy(desc(syncAdmissionReceipts.createdAt))
        .limit(1);

      const previousReceiptHash =
        latestReceipts[0]?.receiptHash ?? '@truex/membrane-client:outbox-admission:genesis';

      // 3. Compute BLAKE3 receipt chain hash
      const payloadHash = blake3(canonicalStringify(payload));
      const receiptHash = blake3(previousReceiptHash + payloadHash + admittedAt + jobType);
      const receiptId = `rcpt_${receiptHash.substring(0, 32)}`;

      // 4. Insert receipt record
      await tx.insert(syncAdmissionReceipts).values({
        id: receiptId,
        jobId,
        jobType,
        entityId,
        payloadHash,
        previousReceiptHash,
        receiptHash,
        admittedAt,
        status: 'committed',
        createdAt: new Date(),
      });

      // 5. Update target profile details if profiles table
      if (jobType === 'profiles' && entityId) {
        const existing = await tx.select().from(profiles).where(eq(profiles.id, entityId));
        if (existing.length > 0) {
          await tx
            .update(profiles)
            .set({
              username: payload.username,
              fullName: payload.full_name,
              website: payload.website,
              avatarUrl: payload.avatar_url,
              updatedAt: admittedAt,
            })
            .where(eq(profiles.id, entityId));
        } else {
          await tx.insert(profiles).values({
            id: entityId,
            username: payload.username,
            fullName: payload.full_name,
            website: payload.website,
            avatarUrl: payload.avatar_url,
            updatedAt: admittedAt,
          });
        }
      }

      return receiptHash;
    });

    return finalReceiptHash;
  }

  /**
   * Fetches the next transaction from the outbox queue to sync to Supabase.
   */
  async getNextCrudTransaction(): Promise<any> {
    const nextJobs = await db
      .select()
      .from(syncQueue)
      .where(eq(syncQueue.status, 'pending'))
      .orderBy(syncQueue.id)
      .limit(1);

    if (nextJobs.length === 0) {
      return null;
    }

    const job = nextJobs[0];

    // Transition job to processing status
    await db
      .update(syncQueue)
      .set({ status: 'processing' })
      .where(eq(syncQueue.id, job.id));

    const payloadObj = JSON.parse(job.payload);

    return {
      transactionId: job.id,
      crud: [
        {
          id: job.id,
          op: 'PUT',
          table: job.jobType,
          client_row_id: job.entityId || '',
          opData: payloadObj,
        },
      ],
      complete: async () => {
        // Complete the outbox sync entry
        await db.delete(syncQueue).where(eq(syncQueue.id, job.id));
      },
    };
  }

  async submitAdmittedProfileUpdate(
    entityId: string,
    payload: {
      username?: string;
      full_name?: string;
      website?: string;
      avatar_url?: string;
      updatedAt?: string;
    }
  ): Promise<string> {
    return this.writeTransaction('profiles', entityId, payload);
  }
}
