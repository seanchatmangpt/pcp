import { MembraneConfig, MembraneReceipt } from './types';
import { Interceptors } from './interceptors';
import { Trajectories } from './trajectories';
import { Receipts } from './receipts';
import { Quarantine } from './quarantine';
import { sha256, canonicalStringify } from '../crypto/receipts';

export class MembraneContext {
  private config: MembraneConfig;

  constructor(config: MembraneConfig) {
    this.config = config;
  }

  /**
   * Governs execution of any operation or process capability before settlement
   */
  async run<T>(
    capabilityId: string,
    commandId: string,
    input: any,
    executionBlock: () => Promise<T>
  ): Promise<{ success: boolean; result: T | null; receipt: MembraneReceipt; error?: string }> {
    const timestamp = new Date().toISOString();
    const prevHash = Receipts.getLastHash();

    // 1. Run Interceptor chain (Gate Admissibility)
    const interceptCtx = { commandId, capabilityId, input, config: this.config };
    const verdict = await Interceptors.evaluate(interceptCtx);

    if (verdict === 'deny') {
      const receipt = await Receipts.emitRefusal(commandId, capabilityId, prevHash, 'Admissibility denied by membrane interceptor');
      return { success: false, result: null, receipt, error: 'Denied by membrane' };
    }

    // 2. Run Trajectory checks
    if (input.flowName && input.fromState && input.toState) {
      const flowValid = Trajectories.validateTransition(input.flowName, input.fromState, input.toState);
      if (!flowValid) {
        const receipt = await Receipts.emitRefusal(commandId, capabilityId, prevHash, `Illegal state transition in ${input.flowName}`);
        await Quarantine.isolate(commandId, input, `Illegal transition: ${input.fromState} -> ${input.toState}`);
        return { success: false, result: null, receipt, error: 'Illegal trajectory transition' };
      }
    }

    // 3. Execute payload under membrane protection
    try {
      const executionResult = await executionBlock();

      // Compute deterministic state hash
      const resultHash = sha256(canonicalStringify(executionResult || {}));
      const receiptHash = sha256(prevHash + resultHash);

      const receipt: MembraneReceipt = {
        id: `rec_memb_${Math.random().toString(36).substr(2, 9)}`,
        commandId,
        capabilityId,
        timestamp,
        verdict,
        success: true,
        deltaHash: receiptHash,
        previousHash: prevHash,
        resultHash
      };

      Receipts.append(receipt);

      return { success: true, result: executionResult, receipt };
    } catch (err: any) {
      // 4. Quarantine on crash
      const errorMsg = err.message || 'Unknown execution fault';
      const receipt = await Receipts.emitRefusal(commandId, capabilityId, prevHash, errorMsg);
      await Quarantine.isolate(commandId, input, errorMsg);

      return { success: false, result: null, receipt, error: errorMsg };
    }
  }

  getConfig(): MembraneConfig {
    return this.config;
  }
}
