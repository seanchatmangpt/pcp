import { renderHook, waitFor } from '@testing-library/react-native';
import { usePredictivePrefetch } from '../usePredictivePrefetch';

const mockMatch = jest.fn().mockResolvedValue([]);
jest.mock('../../../vkg/react', () => ({
  useVkg: () => ({
    match: mockMatch,
  }),
}));

describe('usePredictivePrefetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefetches data based on predicate uri', async () => {
    renderHook(() => usePredictivePrefetch('http://test.com/pred'));

    await waitFor(() => {
      expect(mockMatch).toHaveBeenCalled();
    });
  });

  it('fails silently if match throws', async () => {
    mockMatch.mockRejectedValueOnce(new Error('Graph down'));
    renderHook(() => usePredictivePrefetch('http://test.com/pred2'));

    await waitFor(() => {
      expect(mockMatch).toHaveBeenCalled();
    });
    // Shouldn't throw
  });
});
