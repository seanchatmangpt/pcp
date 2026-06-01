import { CompressionStrategy, CompressionAlgorithm } from './types';

/**
 * No-op compression strategy.
 */
export class NoneCompressionStrategy implements CompressionStrategy {
  async compress(payload: string): Promise<string> {
    return payload;
  }
  async decompress(compressedPayload: string): Promise<string> {
    return compressedPayload;
  }
}

/**
 * Mock Zlib compression strategy.
 * In a real implementation, this would use a library like 'pako' or 'react-native-zlib'.
 */
export class ZlibCompressionStrategy implements CompressionStrategy {
  private readonly prefix = 'zlib:';

  async compress(payload: string): Promise<string> {
    // Mocking compression by base64 encoding
    // In production, use real zlib.deflate
    return this.prefix + btoa(payload);
  }

  async decompress(compressedPayload: string): Promise<string> {
    if (!compressedPayload.startsWith(this.prefix)) {
      throw new Error('Invalid zlib payload');
    }
    const data = compressedPayload.substring(this.prefix.length);
    return atob(data);
  }
}

/**
 * Mock Brotli compression strategy.
 * In a real implementation, this would use a library like 'brotli' or native bindings.
 */
export class BrotliCompressionStrategy implements CompressionStrategy {
  private readonly prefix = 'brotli:';

  async compress(payload: string): Promise<string> {
    // Mocking compression by base64 encoding + reverse (just to differentiate)
    // In production, use real brotli.compress
    return this.prefix + btoa(payload.split('').reverse().join(''));
  }

  async decompress(compressedPayload: string): Promise<string> {
    if (!compressedPayload.startsWith(this.prefix)) {
      throw new Error('Invalid brotli payload');
    }
    const data = compressedPayload.substring(this.prefix.length);
    return atob(data).split('').reverse().join('');
  }
}

/**
 * Factory to get the appropriate compression strategy.
 */
export function getCompressionStrategy(algorithm: CompressionAlgorithm): CompressionStrategy {
  switch (algorithm) {
    case 'zlib':
      return new ZlibCompressionStrategy();
    case 'brotli':
      return new BrotliCompressionStrategy();
    case 'none':
    default:
      return new NoneCompressionStrategy();
  }
}

/**
 * Helper to encode string to base64 (browser/node compatible-ish mock)
 */
function btoa(str: string): string {
  try {
    return Buffer.from(str, 'binary').toString('base64');
  } catch (e) {
    // Fallback for environments without Buffer (unlikely in this project but safe)
    return global.btoa ? global.btoa(str) : str;
  }
}

/**
 * Helper to decode base64 to string
 */
function atob(str: string): string {
  try {
    return Buffer.from(str, 'base64').toString('binary');
  } catch (e) {
    // Fallback for environments without Buffer
    return global.atob ? global.atob(str) : str;
  }
}
