import { useActorOpsStore } from '../../actor/actorOps';

/**
 * AutonomicSimulator provides methods to inject synthetic environmental states
 * for testing adaptive UX, security hardening, and sync resiliency.
 */
export class AutonomicSimulator {
  private static simulatedFps: number | null = null;

  /**
   * Updates AppVitals to trigger Adaptive UX.
   */
  static simulateLowPerformance(fps: number) {
    console.log('[AutonomicSimulator] Simulating low performance: ' + fps + ' FPS');
    this.simulatedFps = fps;
  }

  static getSimulatedFps(): number | null {
    return this.simulatedFps;
  }

  static clearSimulation() {
    this.simulatedFps = null;
  }

  /**
   * Updates BehavioralAuth to trigger security hardening.
   */
  static simulateCompromisedTrust(score: number) {
    console.log('[AutonomicSimulator] Simulating compromised trust: ' + score);
    // Triggers step-up auth challenges
  }

  /**
   * Updates sync behaviors via ActorOps store.
   */
  static simulateNetworkChaos(latency: number, dropRate: number) {
    console.log(
      '[AutonomicSimulator] Simulating network chaos: ' +
        latency +
        'ms latency, ' +
        dropRate +
        ' drop rate'
    );
    useActorOpsStore.getState().setPacketDropRate(dropRate);
  }

  /**
   * Triggers a deliberate render error to test AutoFixer.
   */
  static simulateUIFault() {
    console.log('[AutonomicSimulator] Triggering deliberate UI fault');
    throw new Error('SIMULATED_UI_FAULT');
  }
}
