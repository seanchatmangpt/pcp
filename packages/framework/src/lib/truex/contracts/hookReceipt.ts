import { HookActorRef } from '../hook-otp/types';

export interface HookReceiptContract {
  receiptHash: string;
  previousReceiptHash: string;
  hookRunId: string;
  tenantId: string;
  actorRef: HookActorRef;
  messageId: string;
  inputHash: string;
  outputHash: string;
  deltaHash: string;
  status: 'Pending' | 'Confirmed' | 'Quarantined';
  avatarProjectionHashes: Record<string, string>;
  supervisorEvents: string[];
  timestamp: string;
  signature?: string;
}

export function createHookReceiptContract(receipt: HookReceiptContract): HookReceiptContract {
  return {
    ...receipt,
    status: receipt.status || 'Pending',
    avatarProjectionHashes: receipt.avatarProjectionHashes || {},
    supervisorEvents: receipt.supervisorEvents || [],
  };
}
