import { useSuspenseQuery, clearSuspenseCache } from '../useSuspenseQuery';

describe('useSuspenseQuery', () => {
  beforeEach(() => {
    clearSuspenseCache();
  });

  afterEach(() => {
    clearSuspenseCache();
  });

  it('should throw a promise when data is pending', () => {
    const promise = new Promise<string>(() => {});
    const queryFn = jest.fn().mockReturnValue(promise);

    let thrown: any;
    try {
      useSuspenseQuery('test-key', queryFn);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Promise);
  });

  it('should return data when query resolves', async () => {
    const promise = Promise.resolve('test-data');
    const queryFn = jest.fn().mockReturnValue(promise);

    // Initial render throws promise
    let thrown: any;
    try {
      useSuspenseQuery('test-key-2', queryFn);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Promise);

    await promise;

    // Subsequent render returns data
    const result = useSuspenseQuery('test-key-2', queryFn);
    expect(result).toBe('test-data');
  });

  it('should throw an error when query fails', async () => {
    const error = new Error('test-error');
    const promise = Promise.reject(error);
    const queryFn = jest.fn().mockReturnValue(promise);

    // Initial render throws promise
    try {
      useSuspenseQuery('test-key-3', queryFn);
    } catch (e) {
      // expected
    }

    try {
      await promise;
    } catch (e) {
      // expected
    }
    await new Promise(process.nextTick);

    // Subsequent render throws error
    let thrownError: any;
    try {
      useSuspenseQuery('test-key-3', queryFn);
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBe(error);
  });

  it('should clear specific cache key', async () => {
    const promise1 = Promise.resolve('data-1');
    const promise2 = Promise.resolve('data-2');

    try {
      useSuspenseQuery('key-1', () => promise1);
    } catch (e) {}
    try {
      useSuspenseQuery('key-2', () => promise2);
    } catch (e) {}

    await Promise.all([promise1, promise2]);

    clearSuspenseCache('key-1');

    let thrown: any;
    try {
      useSuspenseQuery('key-1', () => promise1);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Promise);

    const result = useSuspenseQuery('key-2', () => promise2);
    expect(result).toBe('data-2');
  });

  it('should clear all cache if no key provided', async () => {
    const promise1 = Promise.resolve('data-1');
    const promise2 = Promise.resolve('data-2');

    try {
      useSuspenseQuery('key-1', () => promise1);
    } catch (e) {}
    try {
      useSuspenseQuery('key-2', () => promise2);
    } catch (e) {}

    await Promise.all([promise1, promise2]);

    clearSuspenseCache();

    let thrown: any;
    try {
      useSuspenseQuery('key-1', () => promise1);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Promise);
  });
});
