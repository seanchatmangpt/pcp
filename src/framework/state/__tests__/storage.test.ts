import { createStorageAdapter } from '../storage';

jest.mock('react-native-mmkv', () => {
  const mockSet = jest.fn();
  const mockGetString = jest.fn();
  const mockRemove = jest.fn();

  return {
    createMMKV: jest.fn(() => ({
      set: mockSet,
      getString: mockGetString,
      remove: mockRemove,
    })),
  };
});

describe('createStorageAdapter', () => {
  it('should create an isolated storage adapter with a valid storeId', () => {
    const { storage, instance } = createStorageAdapter('test-store');

    expect(instance).toBeDefined();
    expect(storage.setItem).toBeDefined();
    expect(storage.getItem).toBeDefined();
    expect(storage.removeItem).toBeDefined();
  });

  it('should throw an error if storeId is empty', () => {
    expect(() => createStorageAdapter('')).toThrow('storeId must be a non-empty string');
    expect(() => createStorageAdapter('   ')).toThrow('storeId must be a non-empty string');
  });

  it('should set, get, and remove items via the storage adapter', () => {
    const { storage, instance } = createStorageAdapter('test-store');

    // Set
    storage.setItem('key1', 'value1');
    expect(instance.set).toHaveBeenCalledWith('key1', 'value1');

    // Get
    (instance.getString as jest.Mock).mockReturnValueOnce('value1');
    const value = storage.getItem('key1');
    expect(value).toBe('value1');
    expect(instance.getString).toHaveBeenCalledWith('key1');

    // Get null
    (instance.getString as jest.Mock).mockReturnValueOnce(undefined);
    const nullValue = storage.getItem('key2');
    expect(nullValue).toBeNull();

    // Remove
    storage.removeItem('key1');
    expect(instance.remove).toHaveBeenCalledWith('key1');
  });
});
