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
});
