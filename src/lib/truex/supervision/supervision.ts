import { HookMessage, SupervisorAction } from '../hook-otp/types';
import { FloodSupervisor } from './floodSupervisor';
import { PressureSupervisor } from './pressure';
import { OscillationSupervisor } from './oscillation';
import { AvatarLoadSupervisor } from './avatarLoad';
import { HookActorInstance } from '../hook-otp/registry';

export interface ConformanceReport {
  isConforming: boolean;
  fitness: number;
  precision: number;
  simplicity: number;
  verdict: 'TRUTHFUL' | 'VARIANCE' | 'DECEPTIVE';
  deviations: string[];
}

export class SupervisionProcessConformanceEvaluator {
  private floodSupervisor: FloodSupervisor;
  private pressureSupervisor: PressureSupervisor;
  private oscillationSupervisor: OscillationSupervisor;
  private loadSupervisor: AvatarLoadSupervisor;

  constructor(
    maxFloodLimit = 5,
    floodWindowMs = 1000,
    maxQueueLength = 10,
    maxOscillationDepth = 3,
    maxLoadFactor = 0.85
  ) {
    this.floodSupervisor = new FloodSupervisor(maxFloodLimit, floodWindowMs);
    this.pressureSupervisor = new PressureSupervisor(maxQueueLength);
    this.oscillationSupervisor = new OscillationSupervisor(maxOscillationDepth);
    this.loadSupervisor = new AvatarLoadSupervisor(maxLoadFactor);
  }

  /**
   * Evaluates runtime conformance of a single message against an actor instance.
   * Returns a recommendation for SupervisorAction or 'allow' if conforming.
   *
   * @param msg The HookMessage being processed.
   * @param instance The target HookActorInstance.
   * @param currentLoadFactor The system avatar load factor.
   */
  public evaluateMessage(
    msg: HookMessage,
    instance: HookActorInstance,
    currentLoadFactor = 0.0
  ): { action: SupervisorAction | 'allow'; reason?: string } {
    // 1. Check Oscillation
    const oscillationResult = this.oscillationSupervisor.detectOscillation(msg);
    if (oscillationResult === 'quarantine') {
      return { action: 'quarantine', reason: 'Circular message oscillation detected' };
    }

    // 2. Check Flood
    const floodResult = this.floodSupervisor.recordAndCheck(msg);
    if (floodResult === 'suppress') {
      return { action: 'suppress', reason: 'Notification flood detected' };
    }

    // 3. Check Pressure
    if (instance.mailbox) {
      const pressureResult = this.pressureSupervisor.checkPressure(instance.mailbox);
      if (pressureResult === 'batch') {
        return { action: 'batch', reason: 'High queue pressure detected' };
      }
    }

    // 4. Check Load
    const loadResult = this.loadSupervisor.checkLoad(currentLoadFactor);
    if (loadResult === 'suppress') {
      return { action: 'suppress', reason: 'High avatar load detected' };
    }

    return { action: 'allow' };
  }

  /**
   * Evaluates trace conformance between actual event logs and a declared process workflow.
   * Computes Van der Aalst metrics for fitness, precision, simplicity, and verdict.
   *
   * @param declaredWorkflow Sequence of expected activity names.
   * @param actualEvents Sequence of observed activity names.
   */
  public evaluateTraceConformance(
    declaredWorkflow: string[],
    actualEvents: string[]
  ): ConformanceReport {
    if (!declaredWorkflow || !actualEvents || !Array.isArray(declaredWorkflow) || !Array.isArray(actualEvents)) {
      throw new Error('Invalid input types. Requires declaredWorkflow and actualEvents arrays.');
    }

    if (declaredWorkflow.length === 0 && actualEvents.length === 0) {
      return {
        isConforming: true,
        fitness: 1.0,
        precision: 1.0,
        simplicity: 1.0,
        verdict: 'TRUTHFUL',
        deviations: [],
      };
    }

    const declaredEdges = new Set<string>();
    for (let i = 0; i < declaredWorkflow.length - 1; i++) {
      declaredEdges.add(`${declaredWorkflow[i]}->${declaredWorkflow[i + 1]}`);
    }

    const actualEdges = new Set<string>();
    for (let i = 0; i < actualEvents.length - 1; i++) {
      actualEdges.add(`${actualEvents[i]}->${actualEvents[i + 1]}`);
    }

    let matches = 0;
    const deviations: string[] = [];
    actualEdges.forEach((edge) => {
      if (declaredEdges.has(edge)) {
        matches++;
      } else {
        deviations.push(`Found undeclared transition: ${edge}`);
      }
    });

    const totalDeclared = declaredEdges.size || 1;
    const totalActual = actualEdges.size || 1;

    const fitness = matches / totalDeclared;
    const precision = matches / totalActual;
    const simplicity = 1 / (1 + deviations.length);

    let verdict: 'TRUTHFUL' | 'VARIANCE' | 'DECEPTIVE' = 'DECEPTIVE';
    if (fitness >= 0.9) {
      verdict = 'TRUTHFUL';
    } else if (fitness >= 0.6) {
      verdict = 'VARIANCE';
    }

    return {
      isConforming: deviations.length === 0,
      fitness,
      precision,
      simplicity,
      verdict,
      deviations,
    };
  }
}
