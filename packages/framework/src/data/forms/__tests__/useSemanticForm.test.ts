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

  const mockSchemaWithNumbers = {
    targetType: 'https://schema.org/Person',
    fields: [
      {
        predicate: 'https://schema.org/age',
        label: 'Age',
        required: false,
        range: 'http://www.w3.org/2001/XMLSchema#integer',
      },
      {
        predicate: 'https://schema.org/height',
        label: 'Height',
        required: false,
        range: 'http://www.w3.org/2001/XMLSchema#double',
      },
    ],
  };

  it('should validate and parse integer and double fields', async () => {
    (fetchSemanticSchema as jest.Mock).mockResolvedValue(mockSchemaWithNumbers);
    const { result } = renderHook(() =>
      useSemanticForm(mockClient as any, 'https://schema.org/Person')
    );

    await act(async () => {
      // Wait for schema to load
    });

    // Test partial inputs for integer
    await act(async () => {
      result.current.setFieldValue('https://schema.org/age', '-');
    });
    let isValid = false;
    await act(async () => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(false);
    expect(result.current.errors['https://schema.org/age']).toBe('Age must be an integer');

    // Test valid integer
    await act(async () => {
      result.current.setFieldValue('https://schema.org/age', '25');
    });
    await act(async () => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(true);

    // Test partial inputs for double
    await act(async () => {
      result.current.setFieldValue('https://schema.org/height', '-.');
    });
    await act(async () => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(false);
    expect(result.current.errors['https://schema.org/height']).toBe('Height must be a number');

    // Test valid double
    await act(async () => {
      result.current.setFieldValue('https://schema.org/height', '1.75');
    });
    await act(async () => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(true);

    // Test handleSubmit parsing string inputs to JavaScript numbers
    const onSubmitSpy = jest.fn();
    await act(async () => {
      await result.current.handleSubmit(onSubmitSpy);
    });
    expect(onSubmitSpy).toHaveBeenCalledWith({
      'https://schema.org/age': 25,
      'https://schema.org/height': 1.75,
    });
  });
});
