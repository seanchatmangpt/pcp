import { StateStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

// Initialize a dedicated MMKV instance for Zustand stores
export const mmkvInstance = createMMKV({
  id: 'membrane-client-zustand-storage',
});

/**
 * Persisted Zustand storage interface utilizing react-native-mmkv.
 * Fast, synchronous key-value storage adapter for local-first caches.
 */
export const mmkvStorage: StateStorage = {
  /**
   * Set a value in storage.
   */
  setItem: (name: string, value: string): void => {
    mmkvInstance.set(name, value);
  },

  /**
   * Retrieve a value from storage. Returns null if not found.
   */
  getItem: (name: string): string | null => {
    const value = mmkvInstance.getString(name);
    return value ?? null;
  },

  /**
   * Remove a value from storage.
   */
  removeItem: (name: string): void => {
    mmkvInstance.remove(name);
  },
};

/**
 * Creates an isolated Zustand storage adapter backed by a unique MMKV database instance.
 * This guarantees strict instance isolation at the storage layer.
 * 
 * @param storeId The unique identifier for the Zustand store.
 * @returns A Zustand StateStorage adapter and its underlying MMKV instance.
 */
export function createIsolatedMMKVStorage(storeId: string): {
  storage: StateStorage;
  instance: ReturnType<typeof createMMKV>;
} {
  if (!storeId || storeId.trim() === '') {
    throw new Error('storeId must be a non-empty string for isolated MMKV storage');
  }

  const instance = createMMKV({
    id: `membrane-client-zustand-storage-${storeId}`,
  });

  const storage: StateStorage = {
    setItem: (name: string, value: string): void => {
      instance.set(name, value);
    },
    getItem: (name: string): string | null => {
      const value = instance.getString(name);
      return value ?? null;
    },
    removeItem: (name: string): void => {
      instance.remove(name);
    },
  };

  return { storage, instance };
}
