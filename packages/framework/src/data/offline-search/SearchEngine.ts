/**
 * @fileoverview SQLite FTS5 Search Engine for Offline Graph Data
 */

import { expoDb } from '@/src/lib/db/db';
import { SearchOptions, SearchResult } from './types';

export class SearchEngine {
  private static isInitialized = false;

  /**
   * Initializes the FTS5 virtual table and triggers if they don't exist.
   * This ensures sub-millisecond search performance by keeping an up-to-date index.
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Use a transaction to ensure atomic setup
    expoDb.withTransactionSync(() => {
      // 1. Create the FTS5 virtual table using 'external content' pattern.
      // This saves space by not duplicating the data, but requires triggers to sync.
      // We index objectValue and store subject/predicate for metadata.
      expoDb.execSync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS quads_fts USING fts5(
          subject UNINDEXED,
          predicate UNINDEXED,
          objectValue,
          content='quads',
          content_rowid='id',
          tokenize='unicode61 remove_diacritics 1'
        );
      `);

      // 2. Create triggers to keep the index in sync with the primary 'quads' table.
      // These triggers handle all CRUD operations automatically.

      // INSERT trigger
      expoDb.execSync(`
        CREATE TRIGGER IF NOT EXISTS quads_ai AFTER INSERT ON quads BEGIN
          INSERT INTO quads_fts(rowid, subject, predicate, objectValue)
          VALUES (new.id, new.subject, new.predicate, new.objectValue);
        END;
      `);

      // DELETE trigger
      expoDb.execSync(`
        CREATE TRIGGER IF NOT EXISTS quads_ad AFTER DELETE ON quads BEGIN
          INSERT INTO quads_fts(quads_fts, rowid, subject, predicate, objectValue)
          VALUES('delete', old.id, old.subject, old.predicate, old.objectValue);
        END;
      `);

      // UPDATE trigger
      expoDb.execSync(`
        CREATE TRIGGER IF NOT EXISTS quads_au AFTER UPDATE ON quads BEGIN
          INSERT INTO quads_fts(quads_fts, rowid, subject, predicate, objectValue)
          VALUES('delete', old.id, old.subject, old.predicate, old.objectValue);
          INSERT INTO quads_fts(rowid, subject, predicate, objectValue)
          VALUES (new.id, new.subject, new.predicate, new.objectValue);
        END;
      `);

      // 3. Check if we need to perform an initial rebuild of the index.
      // This is necessary if the quads table had data before the FTS table was created.
      const count = expoDb.getFirstSync<{ count: number }>(
        'SELECT count(*) as count FROM quads_fts'
      );

      if (count && count.count === 0) {
        const quadsCount = expoDb.getFirstSync<{ count: number }>(
          'SELECT count(*) as count FROM quads'
        );
        if (quadsCount && quadsCount.count > 0) {
          expoDb.execSync("INSERT INTO quads_fts(quads_fts) VALUES('rebuild');");
        }
      }
    });

    this.isInitialized = true;
  }

  /**
   * Performs a full-text search over the quads data.
   * Supports prefix matching and BM25 ranking.
   *
   * @param query The search query string
   * @param options Search configuration options
   * @returns A promise resolving to an array of SearchResults
   */
  public static async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.initialize();

    const sanitized = query.replace(/[^\w\s]/g, ' ').trim();
    if (!sanitized) return [];

    // Transform query into FTS5 prefix search: "word1* word2*"
    const ftsQuery = sanitized
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `${term}*`)
      .join(' ');

    if (!ftsQuery) return [];

    const limit = options.limit ?? 20;

    // Build SQL with optional filters
    let sql = `
      SELECT 
        subject, 
        predicate, 
        objectValue,
        bm25(quads_fts) as rank,
        snippet(quads_fts, 2, '<b>', '</b>', '...', 10) as snippet
      FROM quads_fts
      WHERE quads_fts MATCH ?
    `;

    const params: any[] = [ftsQuery];

    if (options.predicate) {
      sql += ` AND predicate = ?`;
      params.push(options.predicate);
    }

    sql += ` ORDER BY rank LIMIT ?`;
    params.push(limit);

    try {
      const results = expoDb.getAllSync<SearchResult & { snippet: string }>(sql, ...params);
      return results.map((r: SearchResult & { snippet: string }) => ({
        subject: r.subject,
        predicate: r.predicate,
        objectValue: r.objectValue,
        rank: r.rank,
        snippet: r.snippet,
      }));
    } catch (error) {
      console.error('Offline search failed:', error);
      return [];
    }
  }
}
