declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'expo-file-system/legacy' {
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  export function readAsStringAsync(fileUri: string, options?: { encoding?: string }): Promise<string>;
  export function writeAsStringAsync(fileUri: string, contents: string, options?: { encoding?: string }): Promise<void>;
}

declare module 'expo-background-fetch' {
  export enum BackgroundFetchResult {
    NoData = 1,
    NewData = 2,
    Failed = 3,
  }
  export enum BackgroundFetchStatus {
    Restricted = 1,
    Denied = 2,
    Available = 3,
  }
  export interface BackgroundFetchOptions {
    minimumInterval?: number;
    stopOnTerminate?: boolean;
    startOnBoot?: boolean;
  }
  export function registerTaskAsync(taskName: string, options?: BackgroundFetchOptions): Promise<void>;
  export function unregisterTaskAsync(taskName: string): Promise<void>;
  export function getStatusAsync(): Promise<BackgroundFetchStatus>;
}

declare module 'expo-task-manager' {
  export type TaskManagerTaskBody<T = any> = {
    data: T;
    error: Error | null;
    executionInfo: {
      jobId: string;
      tasks: any[];
    };
  };
  export type TaskExecutor = (body: TaskManagerTaskBody) => any | Promise<any>;
  export function defineTask(taskName: string, taskExecutor: TaskExecutor): void;
  export function isTaskDefined(taskName: string): boolean;
}

declare module 'expo-battery' {
  export enum BatteryState {
    UNKNOWN = 0,
    UNPLUGGED = 1,
    CHARGING = 2,
    FULL = 3,
  }
  export function getBatteryLevelAsync(): Promise<number>;
  export function getBatteryStateAsync(): Promise<BatteryState>;
  export function isAvailableAsync(): Promise<boolean>;
}

declare module 'expo-network' {
  export interface NetworkState {
    type?: string;
    isConnected?: boolean;
    isInternetReachable?: boolean;
  }
  export function getNetworkStateAsync(): Promise<NetworkState>;
}
