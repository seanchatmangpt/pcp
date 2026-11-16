import { useMemo, useCallback } from 'react';
import { CompressionOptions } from './types';
import { getCompressionStrategy } from './strategies';

/**
 * Hook to apply payload compression/decompression based on the selected algorithm.
 *
 * @param options - Configuration for compression (algorithm, level, threshold).
 * @returns An object containing compress and decompress functions.
 *
 * @example
 * ```tsx
 * const { compress, decompress } = usePayloadCompression({ algorithm: 'zlib', threshold: 1024 });
 * const compressed = await compress(largePayload);
 * ```
 */
export function usePayloadCompression(options: CompressionOptions = { algorithm: 'none' }) {
  const strategy = useMemo(() => getCompressionStrategy(options.algorithm), [options.algorithm]);

  /**
   * Compresses a payload if it exceeds the threshold and algorithm is not 'none'.
   */
  const compress = useCallback(
    async (payload: string): Promise<string> => {
      if (options.algorithm === 'none') {
        return payload;
      }

      const threshold = options.threshold ?? 0;
      if (payload.length < threshold) {
        return payload;
      }

      return strategy.compress(payload);
    },
    [strategy, options.algorithm, options.threshold]
  );

  /**
   * Decompresses a payload.
   */
  const decompress = useCallback(
    async (compressedPayload: string): Promise<string> => {
      if (options.algorithm === 'none') {
        return compressedPayload;
      }

      // Check if it's actually compressed (our mocks use prefixes)
      // In a real zlib implementation, we might need a more robust check or just try/catch
      try {
        return await strategy.decompress(compressedPayload);
      } catch (error) {
        // If decompression fails, it might not have been compressed (e.g. below threshold when sent)
        return compressedPayload;
      }
    },
    [strategy, options.algorithm]
  );

  return {
    compress,
    decompress,
  };
}
