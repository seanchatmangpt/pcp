import { FPSMonitor, DeviceMonitor } from './Monitors';
import {
  OptimizationMetrics,
  OptimizationProfile,
  OptimizationLevel,
  OptimizationListener,
  DeviceVitals,
} from './types';
import { OPTIMIZATION_PROFILES, FPS_THRESHOLDS, BATTERY_THRESHOLDS } from './constants';

export class SelfOptimizingUXEngine {
  private static instance: SelfOptimizingUXEngine;
  private fpsMonitor = new FPSMonitor();
  private deviceMonitor = new DeviceMonitor();
  private listeners: Set<OptimizationListener> = new Set();

  private currentMetrics: OptimizationMetrics = {
    vitals: {
      fps: 60,
      batteryLevel: 1.0,
      isCharging: true,
      thermalState: 'nominal',
    },
    profile: OPTIMIZATION_PROFILES.peak,
    lastUpdated: Date.now(),
  };

  private constructor() {
    this.startMonitoring();
  }

  public static getInstance(): SelfOptimizingUXEngine {
    if (!this.instance) {
      this.instance = new SelfOptimizingUXEngine();
    }
    return this.instance;
  }

  private startMonitoring() {
    this.fpsMonitor.start((fps) => {
      this.updateVitals({ fps });
    });
  }

  public stopMonitoring() {
    this.fpsMonitor.stop();
  }

  public reset() {
    this.stopMonitoring();
    this.listeners.clear();
    this.currentMetrics = {
      vitals: {
        fps: 60,
        batteryLevel: 1.0,
        isCharging: true,
        thermalState: 'nominal',
      },
      profile: OPTIMIZATION_PROFILES.peak,
      lastUpdated: Date.now(),
    };
  }

  public updateVitals(newVitals: Partial<DeviceVitals>) {
    const vitals = {
      ...this.currentMetrics.vitals,
      ...newVitals,
    };

    // Update DeviceMonitor for non-fps vitals
    this.deviceMonitor.updateVitals(newVitals);

    // Sync with DeviceMonitor just in case
    const deviceVitals = this.deviceMonitor.getVitals();
    const mergedVitals: DeviceVitals = {
      fps: vitals.fps,
      ...deviceVitals,
    };

    const nextProfile = this.determineProfile(mergedVitals);

    this.currentMetrics = {
      vitals: mergedVitals,
      profile: nextProfile,
      lastUpdated: Date.now(),
    };

    this.notifyListeners();
  }

  private determineProfile(vitals: DeviceVitals): OptimizationProfile {
    // 1. Critical State (Thermal or extreme battery)
    if (
      vitals.thermalState === 'critical' ||
      (vitals.batteryLevel < BATTERY_THRESHOLDS.CRITICAL && !vitals.isCharging)
    ) {
      return OPTIMIZATION_PROFILES.critical;
    }

    // 2. Power Saver (Serious thermal or low battery)
    if (
      vitals.thermalState === 'serious' ||
      (vitals.batteryLevel < BATTERY_THRESHOLDS.LOW && !vitals.isCharging)
    ) {
      return OPTIMIZATION_PROFILES['power-saver'];
    }

    // 3. FPS Based throttling
    if (vitals.fps < FPS_THRESHOLDS.CRITICAL) {
      return OPTIMIZATION_PROFILES.critical;
    }
    if (vitals.fps < FPS_THRESHOLDS.POOR) {
      return OPTIMIZATION_PROFILES['power-saver'];
    }
    if (vitals.fps < FPS_THRESHOLDS.STABLE) {
      return OPTIMIZATION_PROFILES.balanced;
    }

    // 4. Fair Thermal State
    if (vitals.thermalState === 'fair') {
      return OPTIMIZATION_PROFILES.balanced;
    }

    // 5. Default Peak
    return OPTIMIZATION_PROFILES.peak;
  }

  public subscribe(listener: OptimizationListener): () => void {
    this.listeners.add(listener);
    listener(this.currentMetrics);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentMetrics));
  }

  public getMetrics(): OptimizationMetrics {
    return this.currentMetrics;
  }
}

export const uxOptimizer = SelfOptimizingUXEngine.getInstance();
