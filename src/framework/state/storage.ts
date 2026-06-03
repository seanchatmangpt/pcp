import { StateStorage } from 'zustand/middleware';
import { createMMKV, MMKV } from 'react-native-mmkv';

export interface StorageAdapter {
  storage: StateStorage;
  instance: MMKV;
}

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
