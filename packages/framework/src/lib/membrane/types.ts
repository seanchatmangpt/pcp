export type AdmissibilityVerdict = 'allow' | 'deny' | 'fork' | 'observe';

export interface MembraneConfig {
  mode: 'strict' | 'simulate' | 'audit';
  tenantId: string;
  authorityRole: 'admin' | 'pastor' | 'volunteer' | 'member' | 'guest' | 'anonymous';
}

export interface MembraneReceipt {
  id: string;
  commandId: string;
  capabilityId: string;
  timestamp: string;
  verdict: AdmissibilityVerdict;
  success: boolean;
  deltaHash: string;
  previousHash: string;
  error?: string;
  resultHash?: string;
}

export interface InterceptorContext {
  commandId: string;
  capabilityId: string;
  input: any;
  config: MembraneConfig;
}

export type InterceptorFunction = (ctx: InterceptorContext) => Promise<boolean | undefined>;

export interface TrajectoryFlow {
  name: string;
  allowedTransitions: Record<string, string[]>;
}
