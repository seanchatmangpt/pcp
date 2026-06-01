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

  describe('createIsolatedMMKVStorage Instance Isolation', () => {
    it('should enforce absolute isolation between distinct stores', () => {
      const storeA = createIsolatedMMKVStorage('store-a');
      const storeB = createIsolatedMMKVStorage('store-b');

      // 1. Verify instances are different MMKV databases
      expect(storeA.instance).not.toBe(storeB.instance);
      expect(storeA.instance.id).toBe('membrane-client-zustand-storage-store-a');
      expect(storeB.instance.id).toBe('membrane-client-zustand-storage-store-b');

      // 2. Set key in Store A
      storeA.storage.setItem('user-profile', 'alice');
      
      // 3. Verify Store A contains value, but Store B does not
      expect(storeA.storage.getItem('user-profile')).toBe('alice');
      expect(storeB.storage.getItem('user-profile')).toBeNull();

      // 4. Set same key in Store B to different value
      storeB.storage.setItem('user-profile', 'bob');

      // 5. Verify they hold different values for the same key name
      expect(storeA.storage.getItem('user-profile')).toBe('alice');
      expect(storeB.storage.getItem('user-profile')).toBe('bob');

      // 6. Remove key in Store A
      storeA.storage.removeItem('user-profile');

      // 7. Verify Store A's key is gone, Store B's key remains unaffected
      expect(storeA.storage.getItem('user-profile')).toBeNull();
      expect(storeB.storage.getItem('user-profile')).toBe('bob');
    });

    it('should retain data when re-instantiating the same storeId', () => {
      // Re-instantiating store-c should access the same underlying mock database
      const storeC1 = createIsolatedMMKVStorage('store-c');
      storeC1.storage.setItem('token', 'jwt-xyz');

      const storeC2 = createIsolatedMMKVStorage('store-c');
      expect(storeC2.storage.getItem('token')).toBe('jwt-xyz');
    });

    it('should throw error when initialized with an invalid storeId', () => {
      expect(() => createIsolatedMMKVStorage('')).toThrow('storeId must be a non-empty string');
      expect(() => createIsolatedMMKVStorage('   ')).toThrow('storeId must be a non-empty string');
    });
  });
});
