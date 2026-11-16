import { renderHook, waitFor } from '@testing-library/react-native';
import { useIntelligentSearch } from '../useIntelligentSearch';
import { useLocalInference } from '../../../ai/on-device/useLocalInference';
import { useNeuroSymbolicQuery } from '../../../data/neuro-symbolic/useNeuroSymbolicQuery';

jest.mock('../../../ai/on-device/useLocalInference');
jest.mock('../../../data/neuro-symbolic/useNeuroSymbolicQuery');
jest.mock('../../../vkg/client', () => {
  return {
    VKGClientFacade: jest.fn().mockImplementation(() => ({})),
  };
});

describe('useIntelligentSearch', () => {
  const mockRunInference = jest.fn();
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalInference as jest.Mock).mockReturnValue({
      runInference: mockRunInference,
    });
    (useNeuroSymbolicQuery as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('should initialize and perform search without AI expansion if disabled', async () => {
    const { result } = renderHook(() =>
      useIntelligentSearch('test query', { useAiExpansion: false })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.expandedQuery).toBeUndefined();
    expect(mockRunInference).not.toHaveBeenCalled();
    expect(useNeuroSymbolicQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        neuro: expect.objectContaining({ prompt: 'test query' }),
      })
    );
  });

  it('should expand query using AI and then search', async () => {
    mockRunInference.mockResolvedValue({ text: 'expanded query' });

    const { result } = renderHook(() =>
      useIntelligentSearch('original query', { useAiExpansion: true })
    );

    // Initial state
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.expandedQuery).toBe('expanded query');
    });

    expect(result.current.isLoading).toBe(false);
    expect(useNeuroSymbolicQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        neuro: expect.objectContaining({ prompt: 'expanded query' }),
      })
    );
  });

  it('should fallback to original query if AI expansion fails', async () => {
    const aiError = new Error('AI failed');
    mockRunInference.mockRejectedValue(aiError);

    const { result } = renderHook(() =>
      useIntelligentSearch('original query', { useAiExpansion: true })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(aiError);
    expect(result.current.expandedQuery).toBeUndefined();
    expect(useNeuroSymbolicQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        neuro: expect.objectContaining({ prompt: 'original query' }),
      })
    );
  });
});
