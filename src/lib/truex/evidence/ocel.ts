import { HookReceipt } from '../hook-otp/types';
import { stringifyActorRef } from '../hook-otp/actorRef';
import type {
  OcelLogTs,
  OcelObjectTs,
  OcelEventTs,
  OcelAttributeTs,
  OcelAttributeValueTs,
  EventObjectLinkTs,
  ObjectObjectLinkTs,
  ObjectChangeTs
} from '../../../types/bindings';

export type {
  OcelLogTs,
  OcelObjectTs,
  OcelEventTs,
  OcelAttributeTs,
  OcelAttributeValueTs,
  EventObjectLinkTs,
  ObjectObjectLinkTs,
  ObjectChangeTs
};

export interface OcelObject {
  id?: string;
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

export function exportToOcelTs(receipts: HookReceipt[]): OcelLogTs {
  const objects: OcelObjectTs[] = [];
  const events: OcelEventTs[] = [];
  const e2o: EventObjectLinkTs[] = [];
  const seenObjects = new Set<string>();

  for (const receipt of receipts) {
    const actorKey = stringifyActorRef(receipt.actorRef);

    if (!seenObjects.has(actorKey)) {
      objects.push({
        id: actorKey,
        object_type: 'TruexHookActor',
        attributes: [
          { key: 'tenantId', value: { type: 'String', value: receipt.tenantId } },
          { key: 'hookId', value: { type: 'String', value: receipt.actorRef.hookId } },
          { key: 'instanceId', value: { type: 'String', value: receipt.actorRef.instanceId } },
        ],
      });
      seenObjects.add(actorKey);
    }

    const timestampNs = receipt.timestamp ? BigInt(new Date(receipt.timestamp).getTime()) * 1000000n : null;

    events.push({
      id: receipt.hookRunId,
      activity: 'HookRunEvaluated',
      timestamp_ns: timestampNs,
      attributes: [
        { key: 'messageId', value: { type: 'String', value: receipt.messageId } },
        { key: 'inputHash', value: { type: 'String', value: receipt.inputHash } },
        { key: 'outputHash', value: { type: 'String', value: receipt.outputHash } },
        { key: 'deltaHash', value: { type: 'String', value: receipt.deltaHash } },
        { key: 'receiptHash', value: { type: 'String', value: receipt.receiptHash } },
        { key: 'status', value: { type: 'String', value: receipt.status } },
      ],
    });

    e2o.push({
      event_id: receipt.hookRunId,
      object_id: actorKey,
      qualifier: 'actor_runs',
    });
  }

  return {
    objects,
    events,
    e2o,
    o2o: [],
    changes: [],
  };
}

export function importFromOcelTs(log: OcelLogTs): Partial<HookReceipt>[] {
  return log.events.map((evt) => {
    const getAttr = (key: string): string | undefined => {
      const attr = evt.attributes.find((a) => a.key === key);
      if (attr && attr.value.type === 'String') {
        return attr.value.value;
      }
      return undefined;
    };

    const timestamp = evt.timestamp_ns
      ? new Date(Number(evt.timestamp_ns) / 1000000).toISOString()
      : undefined;

    return {
      hookRunId: evt.id,
      timestamp,
      messageId: getAttr('messageId'),
      inputHash: getAttr('inputHash'),
      outputHash: getAttr('outputHash'),
      deltaHash: getAttr('deltaHash'),
      receiptHash: getAttr('receiptHash'),
      status: getAttr('status') as any,
    };
  });
}

export function toOcelLogTs(log: OcelLog): OcelLogTs {
  const objects: OcelObjectTs[] = [];
  const events: OcelEventTs[] = [];
  const e2o: EventObjectLinkTs[] = [];
  const seenObjects = new Set<string>();

  for (const [id, obj] of Object.entries(log.objects)) {
    const attributes: OcelAttributeTs[] = Object.entries(obj.attributes).map(([key, val]) => {
      let attrVal: OcelAttributeValueTs;
      if (typeof val === 'string') {
        attrVal = { type: 'String', value: val };
      } else if (typeof val === 'number') {
        attrVal = { type: 'Float', value: val };
      } else if (typeof val === 'boolean') {
        attrVal = { type: 'Boolean', value: val };
      } else {
        attrVal = { type: 'String', value: JSON.stringify(val) };
      }
      return { key, value: attrVal };
    });
    objects.push({
      id,
      object_type: obj.type,
      attributes,
    });
    seenObjects.add(id);
  }

  for (const evt of log.events) {
    const attributes: OcelAttributeTs[] = Object.entries(evt.vmap).map(([key, val]) => {
      let attrVal: OcelAttributeValueTs;
      if (typeof val === 'string') {
        attrVal = { type: 'String', value: val };
      } else if (typeof val === 'number') {
        attrVal = { type: 'Float', value: val };
      } else if (typeof val === 'boolean') {
        attrVal = { type: 'Boolean', value: val };
      } else {
        attrVal = { type: 'String', value: JSON.stringify(val) };
      }
      return { key, value: attrVal };
    });

    const timestampNs = evt.timestamp ? BigInt(new Date(evt.timestamp).getTime()) * 1000000n : null;

    events.push({
      id: evt.id,
      activity: evt.activity,
      timestamp_ns: timestampNs,
      attributes,
    });

    for (const objId of evt.omap) {
      e2o.push({
        event_id: evt.id,
        object_id: objId,
        qualifier: 'related',
      });
    }
  }

  return {
    objects,
    events,
    e2o,
    o2o: [],
    changes: [],
  };
}


