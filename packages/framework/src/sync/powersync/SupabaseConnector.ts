/**
 * @fileoverview SupabaseConnector implementing PowerSyncBackendConnector.
 * Connects PowerSync sync queue mutations to the Supabase backend.
 */

import { supabase } from '@/lib/supabase';

export interface CrudEntry {
  id: number;
  op: 'PUT' | 'PATCH' | 'DELETE';
  table: string;
  client_row_id: string;
  opData?: Record<string, any>;
}

export interface CrudTransaction {
  transactionId: string | number;
  crud: CrudEntry[];
  complete(): Promise<void>;
}

export interface PowerSyncBackendConnector {
  fetchCredentials(): Promise<{ endpoint: string; token: string } | null>;
  uploadData(db: any): Promise<void>;
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  /**
   * Fetches credentials from Supabase.
   * Uses auth.getSession() to retrieve the active session and JWT token.
   */
  async fetchCredentials(): Promise<{ endpoint: string; token: string } | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        return null;
      }
      
      const endpoint =
        process.env.EXPO_PUBLIC_POWERSYNC_URL || 'https://mock.powersync.truex.net';
      
      return {
        endpoint,
        token: session.access_token,
      };
    } catch (e) {
      console.error('Error fetching Supabase session for PowerSync credentials:', e);
      return null;
    }
  }

  /**
   * Uploads mutations queue from PowerSync client DB to Supabase.
   * Processes PUT, PATCH, and DELETE operations sequentially.
   */
  async uploadData(db: any): Promise<void> {
    if (!db || typeof db.getNextCrudTransaction !== 'function') {
      return;
    }

    // Process all pending transactions sequentially
    while (true) {
      const transaction: CrudTransaction | null = await db.getNextCrudTransaction();
      if (!transaction) {
        break;
      }

      try {
        for (const entry of transaction.crud) {
          const { op, table, client_row_id, opData } = entry;
          const data = opData || {};

          if (op === 'PUT') {
            const { error } = await supabase
              .from(table)
              .upsert({ id: client_row_id, ...data });
            if (error) {
              throw new Error(`Supabase PUT error on table ${table}: ${error.message}`);
            }
          } else if (op === 'PATCH') {
            const { error } = await supabase
              .from(table)
              .update(data)
              .eq('id', client_row_id);
            if (error) {
              throw new Error(`Supabase PATCH error on table ${table}: ${error.message}`);
            }
          } else if (op === 'DELETE') {
            const { error } = await supabase
              .from(table)
              .delete()
              .eq('id', client_row_id);
            if (error) {
              throw new Error(`Supabase DELETE error on table ${table}: ${error.message}`);
            }
          }
        }
        
        // Finalize transaction locally
        await transaction.complete();
      } catch (err) {
        console.error('Failed to replicate PowerSync outbox queue transaction:', err);
        throw err;
      }
    }
  }
}
