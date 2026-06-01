/**
 * ZoeOS / Truex Hook Definition Anatomy (Diagram 7)
 * Defines the structural types for the VKG Hook Engine.
 */

export type HookAuthority = 'client' | 'server' | 'both';
export type HookMode = 'advise' | 'simulate' | 'annotate' | 'block' | 'repair' | 'settle';

export interface HookCondition {
  kind: 'pattern' | 'ask-lite' | 'count' | 'threshold' | 'shape-lite';
  pattern?: string;
  query?: string;
  threshold?: number;
}

export interface HookEffect {
  kind: 'constructQuads' | 'annotateProjection' | 'repairCandidate' | 'emitEvent' | 'blockRefuse';
  constructQuads?: { subject: string; predicate: string; object: string; graph?: string }[];
  annotation?: string;
  event?: string;
}

export interface AvatarProjection {
  avatar: 'admin' | 'pastor' | 'volunteer' | 'member' | 'guest' | 'operator';
  jtbd: string;
  surface: 'visible' | 'hidden' | 'summary' | 'alert';
  actions: string[];
}

export interface HookReceipt {
  inputHash: string;
  outputHash: string;
  deltaHash: string;
  previousReceiptHash: string;
  receiptHash: string;
}

export interface VkgHook {
  id: string;
  name: string;
  authority: HookAuthority;
  mode: HookMode;
  condition: HookCondition;
  effects: HookEffect[];
  projections: AvatarProjection[];
  supervisors: string[]; // references to Supervisor Hook IDs
  receipts: boolean; // whether to emit a receipt
}
