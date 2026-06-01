import { HookReceipt } from '../hook-otp/types';
import { stringifyActorRef } from '../hook-otp/actorRef';

export interface OcelObject {
  id: string;
  type: string;
  attributes: Record<string, any>;
}

export interface OcelEvent {
  id: string;
  activity: string;
  timestamp: string;
  omap: string[]; // Related object IDs
  vmap: Record<string, any>; // Event values/attributes
}

export interface OcelLog {
  objects: Record<string, OcelObject>;
  events: OcelEvent[];
}

export function exportToOcel(receipts: HookReceipt[]): OcelLog {
  const objects: Record<string, OcelObject> = {};
  const events: OcelEvent[] = [];

  for (const receipt of receipts) {
    const actorKey = stringifyActorRef(receipt.actorRef);
    
    // Register the hook actor as an object if not present
    if (!objects[actorKey]) {
      objects[actorKey] = {
        id: actorKey,
        type: 'TruexHookActor',
        attributes: {
          tenantId: receipt.tenantId,
          hookId: receipt.actorRef.hookId,
          instanceId: receipt.actorRef.instanceId,
        },
      };
    }

    // Register each run as an event
    events.push({
      id: receipt.hookRunId,
      activity: 'HookRunEvaluated',
      timestamp: receipt.timestamp,
      omap: [actorKey],
      vmap: {
        messageId: receipt.messageId,
        inputHash: receipt.inputHash,
        outputHash: receipt.outputHash,
        deltaHash: receipt.deltaHash,
        receiptHash: receipt.receiptHash,
        status: receipt.status,
      },
    });
  }

  return { objects, events };
}

export function importFromOcel(log: OcelLog): Partial<HookReceipt>[] {
  return log.events.map((evt) => ({
    hookRunId: evt.id,
    timestamp: evt.timestamp,
    messageId: evt.vmap.messageId,
    inputHash: evt.vmap.inputHash,
    outputHash: evt.vmap.outputHash,
    deltaHash: evt.vmap.deltaHash,
    receiptHash: evt.vmap.receiptHash,
    status: evt.vmap.status,
  }));
}
