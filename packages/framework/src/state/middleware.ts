/**
 * @module framework/state/middleware
 * Advanced local persistence middleware for Zustand.
 */
import { PersistOptions, createJSONStorage } from 'zustand/middleware';
import { createStorageAdapter } from './storage';

/**
 * Configuration for persistent MMKV middleware.
 */
export interface LocalPersistenceOptions<T> extends Omit<PersistOptions<T, T>, 'name' | 'storage'> {
  /** The unique name of the store (used as the storage key and MMKV instance id). */
  name: string;
}

/**
 * Factory to create a persistence configuration backed by an isolated MMKV instance.
 *
 * @param options Local persistence options including the store name.
 * @returns Persist options ready to be passed to Zustand's persist middleware.
 */
export function createPersistenceConfig<T>(
  options: LocalPersistenceOptions<T>
): PersistOptions<T, T> {
  const { name, ...rest } = options;
  const adapter = createStorageAdapter(name);

  return {
    name,
    storage: createJSONStorage(() => adapter.storage),
    ...rest,
  };
}
