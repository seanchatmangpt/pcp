/**
 * @fileoverview Background sync worker executing outbox replication.
 * Enforces energy-efficient background sync policies using expo modules.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import { TrueXPowerSyncDB } from './powersync/TrueXPowerSyncDB';
import { SupabaseConnector } from './powersync/SupabaseConnector';

export const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';
export const NORMAL_SYNC_INTERVAL = 15 * 60; // 15 minutes in seconds
export const STRETCHED_SYNC_INTERVAL = 60 * 60; // 1 hour in seconds

export const powersyncDb = new TrueXPowerSyncDB();
export const supabaseConnector = new SupabaseConnector();

/**
 * Runs the outbox queue replication sequentially.
 */
export async function runOutboxReplication(): Promise<void> {
  await supabaseConnector.uploadData(powersyncDb);
}

/**
 * Registers the background sync task with the task manager.
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  console.log('[BackgroundSyncWorker] Starting BACKGROUND_SYNC_TASK execution');

  try {
    // 1. Verify network connectivity
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || networkState.isInternetReachable === false) {
      console.log('[BackgroundSyncWorker] No active internet connection. Deferring sync.');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    // 2. Check battery status
    const batteryLevel = await Battery.getBatteryLevelAsync();
    const batteryState = await Battery.getBatteryStateAsync();

    const isLowBattery = batteryLevel < 0.20; // Less than 20%
    const isCharging =
      batteryState === Battery.BatteryState.CHARGING ||
      batteryState === Battery.BatteryState.FULL;

    if (isLowBattery && !isCharging) {
      console.log(
        `[BackgroundSyncWorker] Power conservation alert. Battery Level: ${Math.round(
          batteryLevel * 100
        )}%, charging: false. Stretching intervals and deferring replication.`
      );

      // Dynamically stretch sync intervals to conserve power
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
          minimumInterval: STRETCHED_SYNC_INTERVAL,
          stopOnTerminate: false,
          startOnBoot: true,
        });
      } catch (regErr) {
        console.warn('[BackgroundSyncWorker] Failed to stretch background task interval:', regErr);
      }

      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // If battery is healthy, ensure the interval is restored to normal
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: NORMAL_SYNC_INTERVAL,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (regErr) {
      // Ignore if registration is already configured
    }

    // 3. Runs outbox queue replication sequentially
    console.log('[BackgroundSyncWorker] Health policies satisfied. Initiating sequential replication.');
    await runOutboxReplication();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BackgroundSyncWorker] Error executing background task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
