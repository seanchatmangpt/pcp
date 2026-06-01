import { analyzeError } from '../analyzer';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock MMKV
jest.mock('react-native-mmkv', () => {
  return {
    MMKV: jest.fn().mockImplementation(() => ({
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

  it('should execute wipe-state action', async () => {
    const error = new Error('JSON parse error');
    const analysis = analyzeError(error);
    const wipeState = analysis.suggestions.find((s) => s.id === 'wipe-state');

    await wipeState?.action();
    expect(AsyncStorage.clear).toHaveBeenCalled();
  });

  it('should execute re-auth action', async () => {
    const error = new Error('auth error');
    const analysis = analyzeError(error);
    const reAuth = analysis.suggestions.find((s) => s.id === 're-auth');

    await reAuth?.action();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('supabase.auth.token');
  });
});
