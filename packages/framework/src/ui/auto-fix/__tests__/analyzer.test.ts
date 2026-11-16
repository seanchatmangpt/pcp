import { analyzeError } from '../analyzer';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock MMKV
jest.mock('react-native-mmkv', () => {
  return {
    createMMKV: jest.fn().mockImplementation(() => ({
      clearAll: jest.fn(),
    })),
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  clear: jest.fn(),
  removeItem: jest.fn(),
}));

describe('analyzeError', () => {
  it('should detect state-related errors', () => {
    const error = new Error('Cannot read property "name" of undefined');
    const analysis = analyzeError(error);

    expect(analysis.isStateRelated).toBe(true);
    expect(analysis.causes).toContain(
      'Potential corrupted local state or unexpected data structure.'
    );
    expect(analysis.suggestions.some((s) => s.id === 'wipe-state')).toBe(true);
  });

  it('should detect auth-related errors', () => {
    const error = new Error('Network request failed with 401');
    const analysis = analyzeError(error);

    expect(analysis.causes).toContain('Network or authentication failure.');
    expect(analysis.suggestions.some((s) => s.id === 're-auth')).toBe(true);
  });

  it('should include a generic rollback suggestion', () => {
    const error = new Error('Unknown error');
    const analysis = analyzeError(error);

    expect(analysis.suggestions.some((s) => s.id === 'rollback')).toBe(true);
  });

  it('should detect state-related errors with pluralized "cannot read properties" message', () => {
    const error = new Error('Cannot read properties of undefined (reading "foo")');
    const analysis = analyzeError(error);

    expect(analysis.isStateRelated).toBe(true);
    expect(analysis.causes).toContain(
      'Potential corrupted local state or unexpected data structure.'
    );
  });

  it('should handle null or undefined errors gracefully', () => {
    const analysisNull = analyzeError(null as any);
    expect(analysisNull).toBeDefined();
    expect(analysisNull.suggestions.some((s) => s.id === 'rollback')).toBe(true);

    const analysisUndefined = analyzeError(undefined as any);
    expect(analysisUndefined).toBeDefined();
    expect(analysisUndefined.suggestions.some((s) => s.id === 'rollback')).toBe(true);
  });

  it('should handle non-object thrown errors gracefully (string or number)', () => {
    const analysisString = analyzeError('Custom string error' as any);
    expect(analysisString).toBeDefined();
    expect(analysisString.suggestions.some((s) => s.id === 'rollback')).toBe(true);

    const analysisNumber = analyzeError(42 as any);
    expect(analysisNumber).toBeDefined();
    expect(analysisNumber.suggestions.some((s) => s.id === 'rollback')).toBe(true);
  });
});
