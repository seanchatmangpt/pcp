import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAutoSyncState } from '../AutoSyncState';

// Mock MMKV
const mockSet = jest.fn();
const mockGetString = jest.fn();
const mockRemove = jest.fn();
jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    set: mockSet,
    getString: mockGetString,
    remove: mockRemove,
  })),
}));

// Mock VKG for predictive prefetching
const mockMatch = jest.fn().mockResolvedValue([]);
jest.mock('../../../../vkg/react', () => ({
  useVkg: () => ({
    match: mockMatch,
  }),
}));

describe('useAutoSyncState', () => {
  const defaultOptions = {
    key: 'test-key',
    initialValue: 'initial',
    peerId: 'peer-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with initial value and hydrates from MMKV', async () => {
    const jsonStr = JSON.stringify({
      value: { value: 'cached-value', timestamp: Date.now(), peerId: 'peer-1' },
    });
    mockGetString.mockReturnValue(jsonStr);

    const { result } = renderHook(() => useAutoSyncState(defaultOptions));

    // Initially might show initialValue or cached depending on effect timing
    // But after hydration effect it should show cached-value
    await waitFor(() => {
      expect(result.current[0]).toBe('cached-value');
    });

    expect(mockGetString).toHaveBeenCalledWith('state');
  });

  it('initializes with initial value when no cache exists', async () => {
    mockGetString.mockReturnValue(null);

    const { result } = renderHook(() => useAutoSyncState(defaultOptions));

    await waitFor(() => {
      expect(result.current[0]).toBe('initial');
    });

    // It should have saved the initial value to cache
    expect(mockSet).toHaveBeenCalled();
  });

  it('updates value and persists to MMKV', async () => {
    mockGetString.mockReturnValue(null);
    const { result } = renderHook(() => useAutoSyncState(defaultOptions));

    await act(async () => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');

    await waitFor(() => {
      // Check if mockSet was called with the new value
      const lastCall = [...mockSet.mock.calls].reverse().find((call) => call[0] === 'state');
      expect(lastCall[1]).toContain('new-value');
    });
  });

  it('triggers predictive pre-fetching', async () => {
    renderHook(() =>
      useAutoSyncState({
        ...defaultOptions,
        uri: 'pcp://test/proximity',
      })
    );

    await waitFor(() => {
      expect(mockMatch).toHaveBeenCalled();
    });
  });

  it('handles CRDT merge from external state', async () => {
    mockGetString.mockReturnValue(null);
    const { result } = renderHook(() => useAutoSyncState(defaultOptions));

    const externalState = {
      value: { value: 'external-value', timestamp: Date.now() + 1000, peerId: 'peer-2' },
    };

    await act(async () => {
      result.current[2](externalState);
    });

    expect(result.current[0]).toBe('external-value');
  });

  it('handles parsing errors gracefully', async () => {
    mockGetString.mockReturnValue('invalid-json');
    const { result } = renderHook(() => useAutoSyncState(defaultOptions));

    await waitFor(() => {
      expect(result.current[0]).toBe('initial');
    });
  });
});
