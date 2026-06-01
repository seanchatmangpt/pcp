export type AdmissibilityVerdict = 'allow' | 'deny' | 'fork' | 'observe';

export interface MembraneConfig {
  mode: 'strict' | 'simulate' | 'audit';
  tenantId?: string;
  authorityRole?: string;
  [key: string]: any;
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

export interface InterceptorContext<TInput = any> {
  commandId: string;
  capabilityId: string;
  input: TInput;
  config: MembraneConfig;
}

export type InterceptorFunction<TInput = any> = (
  ctx: InterceptorContext<TInput>
) => Promise<boolean | undefined>;

export interface TrajectoryFlow {
  name: string;
  allowedTransitions: Record<string, string[]>;
}

export interface MembraneTelemetryEvent {
  timestamp: string;
  type: 'set' | 'get' | 'delete' | 'rollback' | 'span_start' | 'span_end';
  property?: string;
  originalValue?: any;
  value?: any;
  flowName?: string;
  success?: boolean;
  error?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  durationMs?: number;
}

export type TelemetryListener = (event: MembraneTelemetryEvent) => void;

export interface SecurityAuditEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'critical';
  action: string;
  commandId?: string;
  capabilityId?: string;
  details: Record<string, any>;
  actorId?: string;
}

export interface QuarantineRecord {
  commandId: string;
  payload: any;
  error: string;
  quarantinedAt: string;
}

export interface ExecutionResult<T> {
  success: boolean;
  result: T | null;
  receipt: MembraneReceipt;
  error?: string;
}

export interface ProxyWrapperOptions {
  onMutation?: (prop: string | symbol, value: any) => void;
  onTelemetry?: (event: MembraneTelemetryEvent) => void;
  flowName?: string;
}
