/**
 * ZoeOS / Truex Digital Twin & DOE Models (Diagrams 54-62)
 * Defines the structural types for Experiment Design, Treatment Runs,
 * Response Surfaces, and Digital Twin Simulation scenarios.
 */

export interface HookFactor {
  id: string;
  name: string;
}

export interface FactorLevel {
  id: string;
  value: string | number | boolean;
}

export interface ResponseMetric {
  id: string;
  name: string;
  unit: string;
}

export interface TreatmentSetting {
  factorId: string;
  levelId: string;
}

export interface ResponseObservation {
  metricId: string;
  value: number;
}

/**
 * Diagram 55: Experiment Design ERD
 */
export interface ExperimentDesign {
  id: string;
  objective: string;
  factors: HookFactor[];
  levels: Record<string, FactorLevel[]>;
  metrics: ResponseMetric[];
}

export interface TreatmentRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  settings: TreatmentSetting[];
  observations: ResponseObservation[];
}

/**
 * Diagram 57: Response Surface Diagram
 */
export interface ResponseSurfaceModel {
  id: string;
  experimentId: string;
  optimizationObjective: 'maximize' | 'minimize' | 'target';
  candidateSettings: TreatmentSetting[];
}

/**
 * Diagram 60: Digital Twin Scenario Runtime
 */
export interface DigitalTwinScenario {
  id: string;
  name: string;
  simulationClockHorizonMs: number;
  syntheticDeltas: Record<string, unknown>[]; // Mock GraphDeltas
  replicaStateHash: string;
}

export interface TwinOutcome {
  scenarioId: string;
  outcomeMetrics: ResponseObservation[];
  divergenceHash: string;
}
