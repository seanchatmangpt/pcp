import { InterceptorFunction, InterceptorContext } from '../types';
import { ApprovalFlowManager } from './manager';

/**
 * Creates a membrane interceptor that enforces decentralized governance
 * by pausing "high-tension" mutations and requiring external verification.
 */
export const createGovernanceInterceptor = (manager: ApprovalFlowManager): InterceptorFunction => {
  return async (ctx: InterceptorContext): Promise<boolean | undefined> => {
    const config = manager.findMatchingConfig(ctx.capabilityId, ctx.input);

    if (config) {
      // High-tension mutation detected.
      // We initiate the decentralized approval flow and halt immediate execution.
      await manager.initiateApproval(ctx);

      // Returning false tells the membrane to 'deny' this specific execution turn.
      // The mutation remains in a "pending verification" state within the manager.
      return false;
    }

    // Neutral verdict: allow other interceptors to evaluate or proceed to execution.
    return undefined;
  };
};
