/**
 * ZoeOS / Truex Supervisor Hooks (Diagrams 23-29)
 * Defines the structural types for governing propagation pressure,
 * preventing notification floods, and detecting oscillation.
 */

import { VkgHook } from '../hooks/types.js';

export interface PropagationMetrics {
  activationRate: number;
  fanout: number;
  cascadeDepth: number;
  oscillationScore: number;
}

export type SupervisorControl = 'throttle' | 'suppress' | 'quarantine' | 'fork' | 'batch' | 'reroute';

export interface SupervisorHook {
  id: string;
  name: string;
  evaluateMetrics(metrics: PropagationMetrics): SupervisorControl | 'normal';
}

/**
 * Diagram 24: Propagation Pressure Monitoring
 */
export class PropagationPressureMonitor {
  calculatePressure(metrics: PropagationMetrics): number {
    return (metrics.activationRate * 1.5) + (metrics.fanout * 2.0) + (metrics.cascadeDepth * 0.5);
  }

  checkLimit(pressure: number, limit: number): boolean {
    return pressure > limit;
  }
}

/**
 * Diagram 25: Notification Flood Intervention
 */
export class FloodSupervisor implements SupervisorHook {
  id = 'flood-supervisor';
  name = 'Notification Flood Intervention';
  private threshold = 200; // prompts per minute

  evaluateMetrics(metrics: PropagationMetrics): SupervisorControl | 'normal' {
    if (metrics.activationRate > this.threshold) {
      return 'batch'; // or 'suppress'
    }
    return 'normal';
  }
}

/**
 * Diagram 26: Oscillation Detection
 */
export class OscillationDetector implements SupervisorHook {
  id = 'oscillation-detector';
  name = 'Cycle Pattern Detector';
  
  evaluateMetrics(metrics: PropagationMetrics): SupervisorControl | 'normal' {
    if (metrics.oscillationScore > 0.8) {
      return 'quarantine'; // dampens the cycle
    }
    return 'normal';
  }
}
