/**
 * @fileoverview Type definitions for the BEAM-style Actor Runtime over Supabase Realtime.
 */

import { Quad } from '../vkg/rdf';

export interface ActorRef {
  tenantId: string;
  kind: string;
  id: string;
}

export interface Principal {
  id: string;
  role: 'admin' | 'pastor' | 'member' | 'guest';
}

export interface CommandEnvelope<T = any> {
  id: string;
  actor: ActorRef;
  command: string;
  principal: Principal;
  payload: T;
  idempotencyKey: string;
  causationId?: string;
  correlationId?: string;
}

export type ReceiptStatus =
  | 'accepted_pending'
  | 'rejected_local'
  | 'applied_local'
  | 'applied_remote'
  | 'rejected_remote'
  | 'quarantined';

export interface Receipt {
  id: string;
  commandId: string;
  actor: ActorRef;
  status: ReceiptStatus;
  deltaHash?: string;
  eventIds: string[];
  createdAt: string;
  error?: string;
}

export interface EventEnvelope<T = any> {
  id: string;
  commandId: string;
  actor: ActorRef;
  type: string;
  payload: T;
  createdAt: string;
}

export interface ConstructDelta {
  add: Quad[];
  remove: Quad[];
}

export interface CommandSpec<TInput = any> {
  roles: ('admin' | 'pastor' | 'member' | 'guest')[];
  inputValidator: (payload: any) => boolean | Promise<boolean>;
  construct: (payload: TInput, actor: ActorRef) => ConstructDelta | Promise<ConstructDelta>;
  emits: string[];
}

export interface QuerySpec<TInput = any, TOutput = any> {
  select: (params: TInput, store: any) => TOutput | Promise<TOutput>;
}

export interface SupervisionPolicy {
  maxRetries: number;
  backoffMs: number;
  strategy: 'restart' | 'resume' | 'stop';
}

export interface ActorBehavior {
  actorKind: string;
  commands: Record<string, CommandSpec>;
  queries: Record<string, QuerySpec>;
  supervise?: SupervisionPolicy;
}

export type DispatchMode = 'local' | 'remote';

export interface DispatchContext {
  mode: DispatchMode;
  authority: 'optimistic' | 'authoritative';
}
