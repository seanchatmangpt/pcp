import { mmkvStorage, mmkvInstance, createIsolatedMMKVStorage } from './mmkvStorage';

// Mock react-native-mmkv with dynamic isolated instances
jest.mock('react-native-mmkv', () => {
  const instances: Record<string, any> = {};
  return {
    createMMKV: jest.fn((options?: { id?: string }) => {
      const id = options?.id || 'default';
      if (!instances[id]) {
        const store: Record<string, string> = {};
        instances[id] = {
          id,
          set: jest.fn((key: string, val: string) => {
            store[key] = val;
          }),
          getString: jest.fn((key: string) => {
            return store[key] !== undefined ? store[key] : undefined;
          }),
          remove: jest.fn((key: string) => {
            delete store[key];
          }),
          _store: store,
        };
      }
      return instances[id];
    }),
  };
});

describe('mmkvStorage Zustand Adapter & Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default mmkvStorage Adapter', () => {
    it('should set the value in MMKV', () => {
      const name = 'app-state';
      const value = JSON.stringify({ count: 1 });

      mmkvStorage.setItem(name, value);

      expect(mmkvInstance.set).toHaveBeenCalledWith(name, value);
      expect(mmkvStorage.getItem(name)).toBe(value);
    });

    it('should return value string if present and null if not', () => {
      const name = 'app-state';
      const storedValue = JSON.stringify({ count: 1 });
      mmkvStorage.setItem(name, storedValue);

      const result = mmkvStorage.getItem(name);
      expect(result).toBe(storedValue);

      const missing = mmkvStorage.getItem('non-existent');
      expect(missing).toBeNull();
    });

    it('should remove the key from MMKV', () => {
      const name = 'app-state';
      mmkvStorage.setItem(name, 'value');
      expect(mmkvStorage.getItem(name)).toBe('value');

      mmkvStorage.removeItem(name);

      expect(mmkvInstance.remove).toHaveBeenCalledWith(name);
      expect(mmkvStorage.getItem(name)).toBeNull();
    });
  });
});
