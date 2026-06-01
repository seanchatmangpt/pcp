import { renderHook, act } from '@testing-library/react-native';
import { usePayloadCompression } from '../usePayloadCompression';

describe('usePayloadCompression', () => {
  const largePayload = 'A'.repeat(1024);
  const smallPayload = 'short';

  it('should return payload as is when algorithm is none', async () => {
    const { result } = renderHook(() => usePayloadCompression({ algorithm: 'none' }));

    let compressed: string = '';
    await act(async () => {
      compressed = await result.current.compress(largePayload);
    });
    expect(compressed).toBe(largePayload);

    let decompressed: string = '';
    await act(async () => {
      decompressed = await result.current.decompress(largePayload);
    });
    expect(decompressed).toBe(largePayload);
  });

  it('should compress and decompress using zlib strategy', async () => {
    const { result } = renderHook(() => usePayloadCompression({ algorithm: 'zlib' }));

    let compressed: string = '';
    await act(async () => {
      compressed = await result.current.compress('hello');
    });
    expect(compressed.startsWith('zlib:')).toBe(true);
    expect(compressed).not.toBe('hello');

    let decompressed: string = '';
    await act(async () => {
      decompressed = await result.current.decompress(compressed);
    });
    expect(decompressed).toBe('hello');
  });

  it('should compress and decompress using brotli strategy', async () => {
    const { result } = renderHook(() => usePayloadCompression({ algorithm: 'brotli' }));

    let compressed: string = '';
    await act(async () => {
      compressed = await result.current.compress('hello');
    });
    expect(compressed.startsWith('brotli:')).toBe(true);
    expect(compressed).not.toBe('hello');

    let decompressed: string = '';
    await act(async () => {
      decompressed = await result.current.decompress(compressed);
    });
    expect(decompressed).toBe('hello');
  });

  it('should respect threshold for compression', async () => {
    const { result } = renderHook(() =>
      usePayloadCompression({ algorithm: 'zlib', threshold: 10 })
    );

    // Below threshold
    let compressedSmall: string = '';
    await act(async () => {
      compressedSmall = await result.current.compress('short');
    });
    expect(compressedSmall).toBe('short');

    // Above threshold
    let compressedLarge: string = '';
    await act(async () => {
      compressedLarge = await result.current.compress('this is longer than 10 chars');
    });
    expect(compressedLarge.startsWith('zlib:')).toBe(true);
  });

  it('should handle decompression of uncompressed data gracefully', async () => {
    const { result } = renderHook(() => usePayloadCompression({ algorithm: 'zlib' }));

    let decompressed: string = '';
    await act(async () => {
      decompressed = await result.current.decompress('not compressed');
    });
    expect(decompressed).toBe('not compressed');
  });

  it('should differentiate between zlib and brotli outputs', async () => {
    const { result: zlibHook } = renderHook(() => usePayloadCompression({ algorithm: 'zlib' }));
    const { result: brotliHook } = renderHook(() => usePayloadCompression({ algorithm: 'brotli' }));

    let zlibOut: string = '';
    let brotliOut: string = '';

    await act(async () => {
      zlibOut = await zlibHook.current.compress('hello');
      brotliOut = await brotliHook.current.compress('hello');
    });

    expect(zlibOut).not.toBe(brotliOut);
    expect(zlibOut.startsWith('zlib:')).toBe(true);
    expect(brotliOut.startsWith('brotli:')).toBe(true);
  });
});
