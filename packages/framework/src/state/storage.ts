import { StateStorage } from 'zustand/middleware';
import { createMMKV, MMKV } from 'react-native-mmkv';

export interface StorageAdapter {
  storage: StateStorage;
  instance: MMKV;
}

/**
 * Creates an isolated Zustand storage adapter backed by a unique MMKV database instance.
 * Guarantees strict instance isolation at the storage layer for local-first caches.
 *
 * @param storeId The unique identifier for the storage instance.
 * @returns A Zustand StateStorage adapter and its underlying MMKV instance.
 */
export function createStorageAdapter(storeId: string): StorageAdapter {
  if (!storeId || storeId.trim() === '') {
    throw new Error('storeId must be a non-empty string for isolated MMKV storage');
  }

  const instance = createMMKV({
    id: `framework-state-storage-${storeId}`,
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
