import { HyperDB } from '../HyperDB';
import { useHyperState, globalHyperDB } from '../useHyperState';

describe('HyperDB', () => {
  let db: HyperDB;

  beforeEach(() => {
    // Use lower dimension for faster tests
    db = new HyperDB(100, 42);
  });

  test('initializes with specified dimensions', () => {
    const testDb = new HyperDB(50);
    // We can't directly check private dims, but we can see it doesn't throw
    expect(testDb).toBeInstanceOf(HyperDB);
  });

  test('initializes with default dimensions and seed', () => {
    const defaultDb = new HyperDB();
    expect(defaultDb).toBeInstanceOf(HyperDB);
  });

  test('inserts and retrieves data correctly', () => {
    db.insert('user1', { name: 'Alice', age: 30 });
    expect(db.get('user1')).toEqual({ name: 'Alice', age: 30 });
  });
});

let mockState: any;
let mockSetState: any;

jest.mock('react', () => {
  return {
    useState: jest.fn((init) => {
      mockState = typeof init === 'function' ? init() : init;
      mockSetState = jest.fn((updater) => {
        mockState = typeof updater === 'function' ? updater(mockState) : updater;
      });
      return [mockState, mockSetState];
    }),
    useCallback: jest.fn((cb) => cb),
  };
});
