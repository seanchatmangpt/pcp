export type OptimizationLevel = 'peak' | 'balanced' | 'power-saver' | 'critical';

export interface DeviceVitals {
  fps: number;
  batteryLevel: number; // 0 to 1
  isCharging: boolean;
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
}

export interface OptimizationProfile {
  level: OptimizationLevel;
  syncFrequencyMs: number;
  animationComplexity: 'full' | 'reduced' | 'minimal' | 'none';
  zkpVerificationDepth: 'exhaustive' | 'standard' | 'fast' | 'minimal';
  allowBackgroundSync: boolean;
  enableExpensiveHaptics: boolean;
}

export interface OptimizationMetrics {
  vitals: DeviceVitals;
  profile: OptimizationProfile;
  lastUpdated: number;
}

export type OptimizationListener = (metrics: OptimizationMetrics) => void;
