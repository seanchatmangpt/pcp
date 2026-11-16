/**
 * @fileoverview EdgeAiSyncBroker persisting local inference results to SQLite and syncing to Supabase.
 */

import { expoDb } from '@/src/lib/db/db';
import { supabase } from '@/lib/supabase';
import { InferenceResponse } from './LocalInferenceEngine';

export class EdgeAiSyncBroker {
  constructor() {
    // Self-healing database initialization: ensure local_inference_results exists
    expoDb.execSync(`
      CREATE TABLE IF NOT EXISTS "local_inference_results" (
        "id" TEXT PRIMARY KEY,
        "request_id" TEXT NOT NULL,
        "model_id" TEXT NOT NULL,
        "text" TEXT NOT NULL,
        "latency_ms" INTEGER NOT NULL,
        "payload_hash" TEXT NOT NULL,
        "delta_hash" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "created_at" INTEGER NOT NULL
      );
    `);
  }

  /**
   * Persists an inference response locally in SQLite.
   */
  async persistLocal(response: InferenceResponse): Promise<void> {
    const insertQuery = `
      INSERT OR REPLACE INTO local_inference_results 
      (id, request_id, model_id, text, latency_ms, payload_hash, delta_hash, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `;

    const now = Date.now();
    
    try {
      expoDb.runSync(
        insertQuery,
        response.receipt.id,
        response.requestId,
        response.receipt.modelId,
        response.text,
        response.latencyMs,
        response.receipt.payloadHash,
        response.receipt.deltaHash,
        now
      );
    } catch (err) {
      console.error('EdgeAiSyncBroker failed to persist local inference result:', err);
      throw err;
    }
  }

  /**
   * Syncs all pending local inference records to Supabase.
   */
  async syncPendingReceipts(): Promise<void> {
    let pending: any[] = [];
    
    try {
      const selectQuery = `SELECT * FROM local_inference_results WHERE status = 'pending'`;
      pending = expoDb.getAllSync(selectQuery);
    } catch (err) {
      console.error('EdgeAiSyncBroker failed to query pending local results:', err);
      return;
    }

    for (const record of pending) {
      try {
        const { error } = await supabase.from('edge_inference_logs').upsert({
          id: record.id,
          request_id: record.request_id,
          model_id: record.model_id,
          text: record.text,
          latency_ms: record.latency_ms,
          payload_hash: record.payload_hash,
          delta_hash: record.delta_hash,
          created_at: new Date(record.created_at).toISOString(),
        });

        if (error) {
          console.warn(`Supabase Edge AI sync rejected for ${record.id}: ${error.message}`);
          continue;
        }

        // Update local status to synced
        const updateQuery = `UPDATE local_inference_results SET status = 'synced' WHERE id = ?`;
        expoDb.runSync(updateQuery, record.id);
      } catch (err) {
        console.error(`EdgeAiSyncBroker failed to sync record ${record.id} to Supabase:`, err);
      }
    }
  }
}
