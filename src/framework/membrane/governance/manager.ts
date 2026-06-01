import {
  VerificationRequest,
  ApprovalFlowConfig,
  GovernanceHook,
  VerificationStatus,
} from './types';
import { InterceptorContext } from '../types';

export class ApprovalFlowManager {
  private configs: ApprovalFlowConfig[] = [];
  private requests: Map<string, VerificationRequest> = new Map();
  private hooks: GovernanceHook[] = [];

  /**
   * Registers a new approval flow configuration for specific capabilities and tension levels.
   */
  public registerConfig(config: ApprovalFlowConfig) {
    this.configs.push(config);
  }

  /**
   * Registers a governance hook for multi-step semantic verification.
   */
  public registerHook(hook: GovernanceHook) {
    this.hooks.push(hook);
  }

  /**
   * Determines if a given operation requires an approval flow.
   */
  public findMatchingConfig(capabilityId: string, input: any): ApprovalFlowConfig | undefined {
    return this.configs.find((config) => {
      const matches =
        typeof config.capabilityPattern === 'string'
          ? capabilityId === config.capabilityPattern
          : config.capabilityPattern.test(capabilityId);

      return matches && config.tensionPredicate(input);
    });
  }

  /**
   * Initiates a new verification request based on the intercepted context.
   */
  public async initiateApproval(ctx: InterceptorContext): Promise<VerificationRequest> {
    const config = this.findMatchingConfig(ctx.capabilityId, ctx.input);
    if (!config) {
      throw new Error(`No approval flow configured for capability: ${ctx.capabilityId}`);
    }

    const requestId = `verify_${ctx.commandId}_${Math.random().toString(36).substring(2, 7)}`;
    const request: VerificationRequest = {
      id: requestId,
      capabilityId: ctx.capabilityId,
      commandId: ctx.commandId,
      input: ctx.input,
      status: 'pending',
      steps: config.steps.map((step) => ({ ...step, status: 'pending' })),
      requestedAt: new Date().toISOString(),
      context: ctx,
    };

    this.requests.set(requestId, request);

    // Notify hooks of new request
    await Promise.all(this.hooks.map((h) => h.onVerificationRequested?.(request)));

    return request;
  }

  /**
   * Completes a specific step in the verification process.
   */
  public async completeStep(
    requestId: string,
    stepId: string,
    actorId: string
  ): Promise<VerificationRequest> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`Verification request not found: ${requestId}`);

    const stepIndex = request.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) throw new Error(`Step ${stepId} not found in request ${requestId}`);

    const step = request.steps[stepIndex];
    if (step.status !== 'pending') return request;

    step.status = 'approved';
    step.completedAt = new Date().toISOString();
    step.completedBy = actorId;

    // Trigger step completion hooks
    await Promise.all(this.hooks.map((h) => h.onStepCompleted?.(request, stepId)));

    // Auto-resolve if all steps are approved
    if (request.steps.every((s) => s.status === 'approved')) {
      request.status = 'approved';
      request.resolvedAt = new Date().toISOString();
      await Promise.all(this.hooks.map((h) => h.onVerificationResolved?.(request)));
    }

    return request;
  }

  /**
   * Rejects the entire verification request.
   */
  public async rejectRequest(requestId: string, reason: string): Promise<VerificationRequest> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`Verification request not found: ${requestId}`);

    request.status = 'rejected';
    request.resolvedAt = new Date().toISOString();
    request.steps.forEach((s) => {
      if (s.status === 'pending') s.status = 'rejected';
    });

    await Promise.all(this.hooks.map((h) => h.onVerificationResolved?.(request)));
    return request;
  }

  public getRequest(requestId: string): VerificationRequest | undefined {
    return this.requests.get(requestId);
  }

  public getPendingRequests(): VerificationRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.status === 'pending');
  }
}
