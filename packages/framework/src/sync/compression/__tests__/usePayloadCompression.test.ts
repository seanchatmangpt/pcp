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
});
