import { renderHook, act } from '@testing-library/react-native';
import { useSemanticForm } from '../useSemanticForm';
import { fetchSemanticSchema } from '../utils';
jest.mock('../utils');

describe('useSemanticForm', () => {
  const mockClient = { match: jest.fn() };
  const mockSchema = {
    targetType: 'https://schema.org/Person',
    fields: [
      {
        predicate: 'https://schema.org/name',
        label: 'Name',
        required: true,
        range: 'http://www.w3.org/2001/XMLSchema#string',
      },
    ],
  };

  beforeEach(() => {
    (fetchSemanticSchema as jest.Mock).mockResolvedValue(mockSchema);
  });

  it('should load schema on mount', async () => {
    const { result } = renderHook(() =>
      useSemanticForm(mockClient as any, 'https://schema.org/Person')
    );

    expect(result.current.isLoadingSchema).toBe(true);

    await act(async () => {
      // Wait for useEffect
    });

    expect(result.current.isLoadingSchema).toBe(false);
    expect(result.current.schema).toEqual(mockSchema);
  });

  it('should update field values', async () => {
    const { result } = renderHook(() =>
      useSemanticForm(mockClient as any, 'https://schema.org/Person')
    );

    await act(async () => {
      result.current.setFieldValue('https://schema.org/name', 'John Doe');
    });

    expect(result.current.values['https://schema.org/name']).toBe('John Doe');
  });

  it('should validate required fields', async () => {
    const { result } = renderHook(() =>
      useSemanticForm(mockClient as any, 'https://schema.org/Person')
    );

    await act(async () => {
      // Wait for schema
    });

    let isValid: boolean = false;
    await act(async () => {
      isValid = result.current.validate();
    });

    expect(isValid).toBe(false);
    expect(result.current.errors['https://schema.org/name']).toBe('Name is required');

    await act(async () => {
      result.current.setFieldValue('https://schema.org/name', 'John Doe');
    });

    await act(async () => {
      isValid = result.current.validate();
    });

    expect(isValid).toBe(true);
    expect(result.current.errors['https://schema.org/name']).toBe('');
  });

  it('should handle submission', async () => {
    const onSubmit = jest.fn();
    const { result } = renderHook(() =>
      useSemanticForm(mockClient as any, 'https://schema.org/Person')
    );

    await act(async () => {
      result.current.setFieldValue('https://schema.org/name', 'John Doe');
    });

    await act(async () => {
      await result.current.handleSubmit(onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith({ 'https://schema.org/name': 'John Doe' });
    expect(result.current.isSubmitting).toBe(false);
  });
});
