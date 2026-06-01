import { sha256, canonicalStringify } from '../crypto/receipts';

export class SimulationContext {
  private baseState: any;
  private speculativeState: any;

  constructor(initialState: any) {
    this.baseState = JSON.parse(JSON.stringify(initialState));
    this.speculativeState = JSON.parse(JSON.stringify(initialState));
  }

  /**
   * Run speculative execution on the cloned state
   */
  async simulateRun<T>(
    commandId: string,
    input: any,
    mutateBlock: (state: any, inp: any) => Promise<T>
  ): Promise<{
    success: boolean;
    result: T;
    speculativeHash: string;
    drift: boolean;
  }> {
    const result = await mutateBlock(this.speculativeState, input);
    const originalHash = sha256(canonicalStringify(this.baseState));
    const speculativeHash = sha256(canonicalStringify(this.speculativeState));
    const drift = originalHash !== speculativeHash;

    return {
      success: true,
      result,
      speculativeHash,
      drift
    };
  }

  getSpeculativeState() {
    return this.speculativeState;
  }
}
