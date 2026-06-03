import { StateStorage } from 'zustand/middleware';
import { createMMKV, MMKV } from 'react-native-mmkv';

export const mmkvInstance = createMMKV();

export const mmkvStorage: StateStorage = {
  setItem: (name: string, value: string): void => {
    mmkvInstance.set(name, value);
  },
  getItem: (name: string): string | null => {
    const value = mmkvInstance.getString(name);
    return value ?? null;
  },
  removeItem: (name: string): void => {
    mmkvInstance.remove(name);
  },
};

/**
 * @returns A Zustand StateStorage adapter and its underlying MMKV instance.
 */
export function createIsolatedMMKVStorage(storeId: string): {
  storage: StateStorage;
  instance: MMKV;
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
