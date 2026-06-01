export interface StateVariance {
  key: string;
  expected: any;
  actual: any;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

export interface TestResult {
  success: boolean;
  error?: string;
  logs: string[];
}

export interface RepairPlan {
  variance: StateVariance;
  action: () => Promise<void>;
  description: string;
}

export interface AutonomousConfig {
  monitorIntervalMs: number;
  autoRepair: boolean;
  onVarianceDetected?: (variance: StateVariance) => void;
  onRepairCompleted?: (result: TestResult) => void;
}

export type StateGetter = () => Record<string, any>;
export type StateSetter = (state: Record<string, any>) => void;
export type InvariantChecker = (state: Record<string, any>) => StateVariance[];
