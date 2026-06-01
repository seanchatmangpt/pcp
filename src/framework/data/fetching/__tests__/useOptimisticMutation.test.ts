import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useOptimisticMutation } from '../useOptimisticMutation';

describe('useOptimisticMutation', () => {
  it('should handle a successful mutation', async () => {
    const mutationFn = jest.fn().mockResolvedValue('success-data');
    const onMutate = jest.fn().mockReturnValue('context-data');
    const onSuccess = jest.fn();
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation({ mutationFn, onMutate, onSuccess, onError })
    );

    expect(result.current.isMutating).toBe(false);

    let promise: any;
    act(() => {
      promise = result.current.mutate('input-vars');
    });

    expect(result.current.isMutating).toBe(true);

    const data = await act(async () => {
      return await promise;
    });

    expect(data).toBe('success-data');

    await waitFor(() => {
      expect(result.current.isMutating).toBe(false);
    });

    expect(result.current.error).toBeNull();

    expect(onMutate).toHaveBeenCalledWith('input-vars');
    expect(mutationFn).toHaveBeenCalledWith('input-vars');
    expect(onSuccess).toHaveBeenCalledWith('success-data', 'input-vars', 'context-data');
    expect(onError).not.toHaveBeenCalled();
  });

  it('should handle a failed mutation', async () => {
    const error = new Error('mutation-failed');
    const mutationFn = jest.fn().mockRejectedValue(error);
    const onMutate = jest.fn().mockReturnValue('context-data');
    const onSuccess = jest.fn();
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation({ mutationFn, onMutate, onSuccess, onError })
    );

    let promise: any;
    act(() => {
      promise = result.current.mutate('input-vars');
    });

    await act(async () => {
      try {
        await promise;
      } catch (e) {
        // ignore
      }
    });

    await waitFor(() => {
      expect(result.current.isMutating).toBe(false);
    });

    expect(result.current.error).toBe(error);

    expect(onMutate).toHaveBeenCalledWith('input-vars');
    expect(mutationFn).toHaveBeenCalledWith('input-vars');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error, 'input-vars', 'context-data');
  });

  it('should work without optional callbacks', async () => {
    const mutationFn = jest.fn().mockResolvedValue('success-data');

    const { result } = renderHook(() => useOptimisticMutation({ mutationFn }));

    let promise: any;
    act(() => {
      promise = result.current.mutate('input-vars');
    });

    const data = await act(async () => await promise);
    expect(data).toBe('success-data');
    expect(mutationFn).toHaveBeenCalledWith('input-vars');
  });

  it('should catch error when no onError provided', async () => {
    const error = new Error('mutation-failed');
    const mutationFn = jest.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useOptimisticMutation({ mutationFn }));

    let promise: any;
    act(() => {
      promise = result.current.mutate('input-vars');
    });

    await act(async () => {
      try {
        await promise;
      } catch (e) {}
    });

    await waitFor(() => {
      expect(result.current.error).toBe(error);
    });
  });
});
