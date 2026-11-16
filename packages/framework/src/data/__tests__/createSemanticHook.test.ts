import { renderHook } from '@testing-library/react-native';
import { createSemanticHook } from '../vkg/createSemanticHook';
import { useSemanticNode } from '../vkg/useSemanticNode';

jest.mock('../vkg/useSemanticNode', () => ({
  useSemanticNode: jest.fn(),
}));

describe('createSemanticHook', () => {
  it('creates a hook bound to the given typeUri', () => {
    const mockReturn = {
      node: null,
      loading: false,
      error: null,
      mutate: jest.fn(),
      remove: jest.fn(),
      refresh: jest.fn(),
    };
    (useSemanticNode as jest.Mock).mockReturnValue(mockReturn);

    const useMyType = createSemanticHook<{ '@type': string; '@id': string; name?: string }>(
      'https://schema.org/MyType'
    );

    const { result } = renderHook(() => useMyType('123', { vkgClient: {} as any }));

    expect(useSemanticNode).toHaveBeenCalledWith(
      'https://schema.org/MyType',
      '123',
      expect.any(Object)
    );
    expect(result.current).toEqual(mockReturn);
  });
});
