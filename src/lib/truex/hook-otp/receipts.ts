import { HookReceipt, HookActorRef } from './types';
import { sha256, stringifyActorRef } from './actorRef';
import type { ReceiptShapeTs } from '../../../types/bindings';

export function generateReceipt(opts: {
  tenantId: string;
  actorRef: HookActorRef;
  messageId: string;
  previousReceiptHash: string;
  inputHash: string;
  outputHash: string;
  deltaHash: string;
  status: 'Pending' | 'Confirmed' | 'Quarantined';
  hookRunId: string;
  avatarProjectionHashes?: Record<string, string>;
  supervisorEvents?: string[];
}): HookReceipt {
  const rawPayload = [
    opts.tenantId,
    stringifyActorRef(opts.actorRef),
    opts.messageId,
    opts.previousReceiptHash,
    opts.inputHash,
    opts.outputHash,
    opts.deltaHash,
    opts.status,
    opts.hookRunId,
  ].join('|');

  const receiptHash = sha256(rawPayload);

  return {
    receiptHash,
    previousReceiptHash: opts.previousReceiptHash,
    hookRunId: opts.hookRunId,
    tenantId: opts.tenantId,
    actorRef: opts.actorRef,
    messageId: opts.messageId,
    inputHash: opts.inputHash,
    outputHash: opts.outputHash,
    deltaHash: opts.deltaHash,
    status: opts.status,
    avatarProjectionHashes: opts.avatarProjectionHashes || {},
    supervisorEvents: opts.supervisorEvents || [],
    timestamp: new Date().toISOString(),
  };
}

export function verifyReceiptIntegrity(receipt: HookReceipt): boolean {
  const rawPayload = [
    receipt.tenantId,
    stringifyActorRef(receipt.actorRef),
    receipt.messageId,
    receipt.previousReceiptHash,
    receipt.inputHash,
    receipt.outputHash,
    receipt.deltaHash,
    receipt.status,
    receipt.hookRunId,
  ].join('|');

  return receipt.receiptHash === sha256(rawPayload);
}

export function verifyReceiptChain(receipts: HookReceipt[]): boolean {
  for (let i = 0; i < receipts.length; i++) {
    const current = receipts[i];
    if (!verifyReceiptIntegrity(current)) {
      return false;
    }
    if (i > 0) {
      const prev = receipts[i - 1];
      if (current.previousReceiptHash !== prev.receiptHash) {
        return false;
      }
    }
  }
  return true;
}

export function toReceiptShapeTs(receipt: HookReceipt): ReceiptShapeTs {
  return {
    case_id: receipt.hookRunId,
    process_hash: receipt.receiptHash,
    parent_block_hash: receipt.previousReceiptHash,
    block_hash: receipt.receiptHash,
    timestamp_ns: receipt.timestamp ? new Date(receipt.timestamp).getTime() * 1000000 : Date.now() * 1000000,
    fitness: 1.0,
  };
}

