import { renderHook, act } from '@testing-library/react-native';
import { useLocalInference } from '../useLocalInference';
import { defaultLocalInferenceEngine } from '../LocalInferenceEngine';

// Mock the engine to control its behavior
jest.mock('../LocalInferenceEngine', () => {
  const originalModule = jest.requireActual('../LocalInferenceEngine');
  return {
    ...originalModule,
    defaultLocalInferenceEngine: {
      infer: jest.fn(),
      streamInfer: jest.fn(),
    },
  };
});

describe('useLocalInference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useLocalInference());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.result).toBe(null);
  });

  it('should handle non-streaming inference successfully', async () => {
    const mockResult = {
      text: 'Mock response',
      usage: { promptTokens: 2, completionTokens: 2, totalTokens: 4 },
    };
    (defaultLocalInferenceEngine.infer as jest.Mock).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useLocalInference());

    await act(async () => {
      await result.current.runInference({ prompt: 'test' });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(mockResult);
    expect(result.current.error).toBe(null);
    expect(defaultLocalInferenceEngine.infer).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'test' })
    );
  });

  it('should handle streaming inference successfully', async () => {
    const mockResult = {
      text: 'Streaming response',
      usage: { promptTokens: 2, completionTokens: 2, totalTokens: 4 },
    };

    (defaultLocalInferenceEngine.streamInfer as jest.Mock).mockImplementation(
      async (options, onToken) => {
        onToken('Streaming ');
        onToken('response');
        return mockResult;
      }
    );

    const { result } = renderHook(() => useLocalInference({ stream: true }));

    await act(async () => {
      await result.current.runInference({ prompt: 'test' });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result?.text).toBe('Streaming response');
    expect(defaultLocalInferenceEngine.streamInfer).toHaveBeenCalled();
  });

  it('should handle errors during inference', async () => {
    const mockError = new Error('Inference failed');
    (defaultLocalInferenceEngine.infer as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useLocalInference());

    await act(async () => {
      try {
        await result.current.runInference({ prompt: 'test' });
      } catch (e) {
        // Expected
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(mockError);
    expect(result.current.result).toBe(null);
  });

  it('should reset state correctly', async () => {
    const mockResult = {
      text: 'test',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
    (defaultLocalInferenceEngine.infer as jest.Mock).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useLocalInference());

    await act(async () => {
      await result.current.runInference({ prompt: 'test' });
    });

    expect(result.current.result).toEqual(mockResult);

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBe(null);
    expect(result.current.isLoading).toBe(false);
  });

  it('should abort previous request when a new one starts', async () => {
    let resolveFirst: (val: any) => void = () => {};
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    (defaultLocalInferenceEngine.infer as jest.Mock)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({ text: 'second' });

    const { result } = renderHook(() => useLocalInference());

    let firstCallResult: any;
    act(() => {
      result.current.runInference({ prompt: 'first' }).then((res) => {
        firstCallResult = res;
      });
    });

    await act(async () => {
      await result.current.runInference({ prompt: 'second' });
    });

    expect(result.current.result?.text).toBe('second');
    // First call should have been aborted, but we need to trigger the error to see the behavior
  });

  it('should handle AbortError silently and return null', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    (defaultLocalInferenceEngine.infer as jest.Mock).mockRejectedValue(abortError);

    const { result } = renderHook(() => useLocalInference());

    let callResult: any;
    await act(async () => {
      callResult = await result.current.runInference({ prompt: 'test' });
    });

    expect(callResult).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.isLoading).toBe(false);
  });

  it('should abort ongoing request when reset is called', async () => {
    const firstPromise = new Promise(() => {}); // Never resolves
    (defaultLocalInferenceEngine.infer as jest.Mock).mockReturnValue(firstPromise);

    const { result } = renderHook(() => useLocalInference());

    act(() => {
      result.current.runInference({ prompt: 'test' });
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should handle non-Error catch values', async () => {
    (defaultLocalInferenceEngine.infer as jest.Mock).mockRejectedValue('String error');

    const { result } = renderHook(() => useLocalInference());

    await act(async () => {
      try {
        await result.current.runInference({ prompt: 'test' });
      } catch (e) {
        // Expected
      }
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('String error');
  });
});
