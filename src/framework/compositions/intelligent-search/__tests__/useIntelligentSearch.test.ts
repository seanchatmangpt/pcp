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

  it('should fallback to original query if AI returns empty text', async () => {
    mockRunInference.mockResolvedValue({ text: '' });

    const { result } = renderHook(() =>
      useIntelligentSearch('original query', { useAiExpansion: true })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.expandedQuery).toBeUndefined();
    expect(useNeuroSymbolicQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        neuro: expect.objectContaining({ prompt: 'original query' }),
      })
    );
  });

  it('should handle search errors', async () => {
    const searchError = new Error('Search failed');
    (useNeuroSymbolicQuery as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: searchError,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() =>
      useIntelligentSearch('test query', { useAiExpansion: false })
    );

    expect(result.current.error).toBe(searchError);
  });

  it('should handle empty query', async () => {
    const { result } = renderHook(() => useIntelligentSearch('', { useAiExpansion: true }));

    expect(mockRunInference).not.toHaveBeenCalled();
    expect(result.current.expandedQuery).toBeUndefined();
  });

  it('should pass threshold and limit options to search', async () => {
    renderHook(() =>
      useIntelligentSearch('test', { threshold: 0.5, limit: 5, useAiExpansion: false })
    );

    expect(useNeuroSymbolicQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        neuro: {
          prompt: 'test',
          threshold: 0.5,
          limit: 5,
        },
      })
    );
  });

  it('should show isLoading=true when searching', async () => {
    (useNeuroSymbolicQuery as jest.Mock).mockReturnValue({
      data: [],
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useIntelligentSearch('test', { useAiExpansion: false }));

    expect(result.current.isLoading).toBe(true);
  });

  it('should handle non-Error catch in expand', async () => {
    mockRunInference.mockRejectedValue('Something went wrong');

    const { result } = renderHook(() =>
      useIntelligentSearch('original query', { useAiExpansion: true })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Something went wrong');
  });
});
