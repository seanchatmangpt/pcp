import { createPersistenceConfig } from '../middleware';
import * as storageModule from '../storage';

jest.mock('../storage', () => ({
  createStorageAdapter: jest.fn(),
}));

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPersistenceConfig', () => {
    it('creates a configuration object for zustand persist', () => {
      const mockStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      };

      (storageModule.createStorageAdapter as jest.Mock).mockReturnValue({
        storage: mockStorage,
        instance: {}, // mmkv mock not needed for this test
      });

      const config = createPersistenceConfig({
        name: 'test-store',
        version: 1,
      });

      expect(storageModule.createStorageAdapter).toHaveBeenCalledWith('test-store');
      expect(config.name).toBe('test-store');
      expect(config.version).toBe(1);
      expect(config.storage).toBeDefined();

      // Test JSON storage wrapper behavior
      if (config.storage && config.storage.setItem) {
        config.storage.setItem(
          'key',
          'value' as unknown as import('zustand/middleware').StorageValue<unknown>
        );
        expect(mockStorage.setItem).toHaveBeenCalledWith('key', '"value"');
      }
    });
  });
});
