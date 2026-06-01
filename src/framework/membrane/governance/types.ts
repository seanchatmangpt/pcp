import { InterceptorContext } from '../types';

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'waiting';

export interface VerificationStep {
  id: string;
  label: string;
  status: VerificationStatus;
  requiredRole?: string;
  metadata?: Record<string, any>;
  completedAt?: string;
  completedBy?: string;
}

export interface VerificationRequest {
  id: string;
  capabilityId: string;
  commandId: string;
  input: any;
  status: VerificationStatus;
  steps: VerificationStep[];
  requestedAt: string;
  resolvedAt?: string;
  context: InterceptorContext;
}

export interface ApprovalFlowConfig {
  id: string;
  capabilityPattern: string | RegExp;
  tensionPredicate: (input: any) => boolean;
  steps: Array<Omit<VerificationStep, 'status' | 'id'> & { id: string }>;
}

export interface GovernanceHook {
  onVerificationRequested?: (request: VerificationRequest) => Promise<void> | void;
  onStepCompleted?: (request: VerificationRequest, stepId: string) => Promise<void> | void;
  onVerificationResolved?: (request: VerificationRequest) => Promise<void> | void;
}
