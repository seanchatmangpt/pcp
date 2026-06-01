export interface HookActorRef {
  tenantId: string;
  packId: string;
  hookId: string;
  instanceId: string;
}

export interface HookState {
  [key: string]: any;
}

export interface HookEffect {
  type: string;
  payload: any;
}

export type HookMessageType = 'graph_delta' | 'receipt_event' | 'replay_request' | 'supervisor_signal';

export interface HookMessage {
  id: string;
  type: HookMessageType;
  payload: any;
  actorRef?: HookActorRef;
  timestamp?: string;
  causationId?: string;
  correlationId?: string;
}

export interface ReplayResult {
  success: boolean;
  outputHash: string;
  state: HookState;
  effects: HookEffect[];
  error?: string;
}

export interface HookExecutionContext {
  actorRef: HookActorRef;
  state: HookState;
  timestamp: string;
}

export interface HookBehavior {
  init?: () => Promise<HookState>;
  handleDelta?: (msg: HookMessage, ctx: HookExecutionContext) => Promise<HookEffect[]>;
  handleReceipt?: (msg: HookMessage, ctx: HookExecutionContext) => Promise<void>;
  handleReplay?: (msg: HookMessage, ctx: HookExecutionContext) => Promise<ReplayResult>;
  terminate?: (reason: string, ctx: HookExecutionContext) => Promise<void>;
}

export type SupervisorAction = 'suppress' | 'batch' | 'reroute' | 'fork' | 'quarantine' | 'repair' | 'escalate' | 'restart';

export interface HookSupervisor {
  onFailure: (error: any, msg: HookMessage, attempts: number) => Promise<SupervisorAction>;
}

export type HookReceiptStatus = 'Pending' | 'Confirmed' | 'Quarantined';

export interface HookReceipt {
  receiptHash: string;
  previousReceiptHash: string;
  hookRunId: string;
  tenantId: string;
  actorRef: HookActorRef;
  messageId: string;
  inputHash: string;
  outputHash: string;
  deltaHash: string;
  status: HookReceiptStatus;
  avatarProjectionHashes: Record<string, string>;
  supervisorEvents: string[];
  timestamp: string;
  signature?: string;
}

export interface HookReplayProof {
  actorRef: HookActorRef;
  initialState: HookState;
  messages: HookMessage[];
  finalState: HookState;
  effects: HookEffect[];
  receiptChainHash: string;
  verified: boolean;
}
