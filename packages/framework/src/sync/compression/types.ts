/**
 * Supported compression algorithms for sync payloads.
 */
export type CompressionAlgorithm = 'zlib' | 'brotli' | 'none';

/**
 * Options for payload compression.
 */
export interface CompressionOptions {
  /** The algorithm to use. Defaults to 'none'. */
  algorithm: CompressionAlgorithm;
  /** Compression level (1-9). Specific meaning depends on the algorithm. */
  level?: number;
  /** Threshold in bytes below which compression is not applied. */
  threshold?: number;
}

/**
 * Interface for a compression strategy implementation.
 */
export interface CompressionStrategy {
  /**
   * Compresses the given payload.
   * @param payload The raw string payload.
   * @returns The compressed payload (might be base64 encoded string or similar).
   */
  compress(payload: string): Promise<string>;

  /**
   * Decompresses the given payload.
   * @param compressedPayload The compressed payload string.
   * @returns The decompressed raw string payload.
   */
  decompress(compressedPayload: string): Promise<string>;
}
