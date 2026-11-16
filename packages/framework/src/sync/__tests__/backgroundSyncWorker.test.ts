/**
 * @fileoverview Unit tests for backgroundSyncWorker and energy-efficient sync policies.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';

// Save registered executor reference (must start with 'mock')
let mockTaskExecutor: any = null;
let defineTaskCalledWith: any[] = [];

// Mock Expo Modules as virtual
jest.mock('expo-task-manager', () => {
  return {
    defineTask: jest.fn((name, executor) => {
      mockTaskExecutor = executor;
      defineTaskCalledWith.push([name, executor]);
    }),
    isTaskDefined: jest.fn(() => true),
  };
}, { virtual: true });

jest.mock('expo-background-fetch', () => {
  return {
    BackgroundFetchResult: {
      NoData: 1,
      NewData: 2,
      Failed: 3,
    },
    registerTaskAsync: jest.fn(),
  };
}, { virtual: true });

let mockBatteryLevel = 0.8;
let mockBatteryState = 1; // UNPLUGGED

jest.mock('expo-battery', () => {
  return {
    BatteryState: {
      UNKNOWN: 0,
      UNPLUGGED: 1,
      CHARGING: 2,
      FULL: 3,
    },
    getBatteryLevelAsync: jest.fn(() => Promise.resolve(mockBatteryLevel)),
    getBatteryStateAsync: jest.fn(() => Promise.resolve(mockBatteryState)),
  };
}, { virtual: true });

let mockNetworkConnected = true;

jest.mock('expo-network', () => {
  return {
    getNetworkStateAsync: jest.fn(() =>
      Promise.resolve({
        isConnected: mockNetworkConnected,
        isInternetReachable: mockNetworkConnected,
      })
    ),
  };
}, { virtual: true });

describe('Background Sync Worker & Energy Throttling Tests', () => {
  let uploadSpy: jest.SpyInstance;
  let BACKGROUND_SYNC_TASK: string;
  let STRETCHED_SYNC_INTERVAL: number;
  let NORMAL_SYNC_INTERVAL: number;
  let workerModule: any;

  beforeAll(() => {
    // Load worker dynamically to avoid module hoisting assignment issues
    workerModule = require('../backgroundSyncWorker');
    BACKGROUND_SYNC_TASK = workerModule.BACKGROUND_SYNC_TASK;
    STRETCHED_SYNC_INTERVAL = workerModule.STRETCHED_SYNC_INTERVAL;
    NORMAL_SYNC_INTERVAL = workerModule.NORMAL_SYNC_INTERVAL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatteryLevel = 0.8;
    mockBatteryState = 1; // UNPLUGGED
    mockNetworkConnected = true;
    
    // Spy on uploadData on the dynamically loaded connector
    uploadSpy = jest.spyOn(workerModule.supabaseConnector, 'uploadData').mockResolvedValue(undefined);
  });

  it('defines the background task during module load', () => {
    expect(defineTaskCalledWith).toContainEqual([
      BACKGROUND_SYNC_TASK,
      expect.any(Function)
    ]);
    expect(mockTaskExecutor).toBeDefined();
  });

  it('fails and defers sync when network is offline', async () => {
    mockNetworkConnected = false;

    const result = await mockTaskExecutor!({ data: {} });
    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.Failed);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('stretches sync intervals and defers replication under low battery (< 20%)', async () => {
    mockBatteryLevel = 0.15; // 15% battery
    mockBatteryState = 1; // UNPLUGGED (not charging)

    const result = await mockTaskExecutor!({ data: {} });
    
    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    expect(uploadSpy).not.toHaveBeenCalled();
    
    // Verifies interval stretching
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
      BACKGROUND_SYNC_TASK,
      expect.objectContaining({
        minimumInterval: STRETCHED_SYNC_INTERVAL,
      })
    );
  });

  it('runs outbox replication normally when battery is low but charging', async () => {
    mockBatteryLevel = 0.15; // 15% battery
    mockBatteryState = 2; // CHARGING

    const result = await mockTaskExecutor!({ data: {} });
    
    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NewData);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    
    // Verifies interval restored to normal
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
      BACKGROUND_SYNC_TASK,
      expect.objectContaining({
        minimumInterval: NORMAL_SYNC_INTERVAL,
      })
    );
  });

  it('runs outbox replication normally when battery is healthy', async () => {
    mockBatteryLevel = 0.85; // 85% battery
    mockBatteryState = 1; // UNPLUGGED

    const result = await mockTaskExecutor!({ data: {} });
    
    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NewData);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });
});
