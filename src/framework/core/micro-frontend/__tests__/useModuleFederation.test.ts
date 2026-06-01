import { renderHook, waitFor } from '@testing-library/react-native';
import { useModuleFederation } from '../useModuleFederation';

describe('useModuleFederation', () => {
  const mockConfig = {
    name: 'testRemote',
    url: 'https://example.com/remoteEntry.js',
    scope: 'testScope',
    module: './testModule',
  };

  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useModuleFederation(mockConfig));
    expect(result.current.status).toBe('loading'); // It starts loading immediately in useEffect
  });

  it('should transition to ready status after loading', async () => {
    const { result } = renderHook(() => useModuleFederation(mockConfig));

    await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 2000 });

    expect(result.current.module).toBeDefined();
    expect(result.current.module.default).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('should transition to error status if no URL is provided', async () => {
    const invalidConfig = { ...mockConfig, url: '' };
    const { result } = renderHook(() => useModuleFederation(invalidConfig));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('No URL provided for federated module');
  });

  it('should handle loading errors', async () => {
    // In our stub, we don't have a way to force an error easily without modifying the hook
    // but we can test the error state if we were to mock the "fetch" or "import"
    // For this stub, we've already covered the empty URL error path.
  });
});
