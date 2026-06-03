/**
 * Petri Net representations and Token Replay Conformance Checking Engine.
 * Following the Dr. Wil van der Aalst process mining doctrine.
 * See [petri-net.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/petri-net.ts) for details.
 */

import { OcelLogTs, OcelObjectTs, OcelEventTs, OcelAttributeTs, OcelAttributeValueTs, EventObjectLinkTs } from '@/src/lib/truex/evidence/ocel';


// Strongly typed representation of places and transitions
export type Place = 'Queue' | 'Verifying' | 'Attesting' | 'Signing' | 'Receipts' | 'Verified';
export type Transition = 'enqueue' | 'verifyZkp' | 'signEnclave' | 'signPq' | 'bindReceipt';

export const PLACES: Place[] = [
  'Queue',
  'Verifying',
  'Attesting',
  'Signing',
  'Receipts',
  'Verified',
];
export const TRANSITIONS: Transition[] = [
  'enqueue',
  'verifyZkp',
  'signEnclave',
  'signPq',
  'bindReceipt',
];

export interface Marking {
  Queue: number;
  Verifying: number;
  Attesting: number;
  Signing: number;
  Receipts: number;
  Verified: number;
}

export interface ReplayResult {
  fitness: number;
  produced: number;
  consumed: number;
  missing: number;
  remaining: number;
  finalMarking: Marking;
  isConforming: boolean;
  logs: string[];
}

// Input matrix WMinus[p][t] representing the weight of arcs from place p to transition t
export const W_MINUS: Record<Place, Record<Transition, number>> = {
  Queue: { enqueue: 0, verifyZkp: 1, signEnclave: 0, signPq: 0, bindReceipt: 0 },
  Verifying: { enqueue: 0, verifyZkp: 0, signEnclave: 1, signPq: 0, bindReceipt: 0 },
  Attesting: { enqueue: 0, verifyZkp: 0, signEnclave: 0, signPq: 1, bindReceipt: 0 },
  Signing: { enqueue: 0, verifyZkp: 0, signEnclave: 0, signPq: 0, bindReceipt: 2 }, // AND-join requires dual signatures
  Receipts: { enqueue: 0, verifyZkp: 0, signEnclave: 0, signPq: 0, bindReceipt: 0 },
  Verified: { enqueue: 0, verifyZkp: 0, signEnclave: 0, signPq: 0, bindReceipt: 0 },
};

// Output matrix WPlus[p][t] representing the weight of arcs from transition t to place p
export const W_PLUS: Record<Place, Record<Transition, number>> = {
  Queue: { enqueue: 1, verifyZkp: 0, signEnclave: 0, signPq: 0, bindReceipt: 0 },
  Verifying: { enqueue: 0, verifyZkp: 1, signEnclave: 0, signPq: 0, bindReceipt: 0 },
  Attesting: { enqueue: 0, verifyZkp: 1, signEnclave: 0, signPq: 0, bindReceipt: 0 }, // verifyZkp forks to Verifying and Attesting
  Signing: { enqueue: 0, verifyZkp: 0, signEnclave: 1, signPq: 1, bindReceipt: 0 },
  Receipts: { enqueue: 0, verifyZkp: 0, signEnclave: 0, signPq: 0, bindReceipt: 1 },
  Verified: { enqueue: 0, verifyZkp: 0, signEnclave: 0, signPq: 0, bindReceipt: 1 },
};

// Absolute link helper to comply with instructions
export function formatLog(message: string): string {
  const absoluteLink =
    '[petri-net.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/petri-net.ts)';
  return `[Agent Petri Net] ${message} - Reference: ${absoluteLink}`;
}

// Convert Marking object to vector array in the exact order of PLACES
export function markingToVector(marking: Marking): number[] {
  return PLACES.map((p) => marking[p] ?? 0);
}

// Convert vector array back to Marking object
export function vectorToMarking(vector: number[]): Marking {
  return {
    Queue: vector[0] ?? 0,
    Verifying: vector[1] ?? 0,
    Attesting: vector[2] ?? 0,
    Signing: vector[3] ?? 0,
    Receipts: vector[4] ?? 0,
    Verified: vector[5] ?? 0,
  };
}

// Build the incidence matrix C = WPlus - WMinus dynamically
export function getIncidenceMatrix(): number[][] {
  const matrix: number[][] = [];
  for (let pIdx = 0; pIdx < PLACES.length; pIdx++) {
    const place = PLACES[pIdx];
    const row: number[] = [];
    for (let tIdx = 0; tIdx < TRANSITIONS.length; tIdx++) {
      const trans = TRANSITIONS[tIdx];
      row.push(W_PLUS[place][trans] - W_MINUS[place][trans]);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Computes the next state vector using the structural matrix equation:
 * M_k = M_{k-1} + C * x_k
 *
 * @param prevMarkingVector Numerical vector representing token counts in PLACES order.
 * @param firingVector Numerical vector representing fired transitions in TRANSITIONS order.
 * @returns The resulting marking vector.
 */
export function computeStructuralStateEquation(
  prevMarkingVector: number[],
  firingVector: number[]
): number[] {
  const cMatrix = getIncidenceMatrix();
  const nextVector = [...prevMarkingVector];

  for (let pIdx = 0; pIdx < PLACES.length; pIdx++) {
    let delta = 0;
    for (let tIdx = 0; tIdx < TRANSITIONS.length; tIdx++) {
      delta += cMatrix[pIdx][tIdx] * firingVector[tIdx];
    }
    nextVector[pIdx] += delta;
  }

  return nextVector;
}

// Helper to construct a firing vector where exactly one transition fires
export function createFiringVector(transition: Transition): number[] {
  const vector = new Array(TRANSITIONS.length).fill(0);
  const index = TRANSITIONS.indexOf(transition);
  if (index !== -1) {
    vector[index] = 1;
  }
  return vector;
}

// Helper to check if a transition is enabled in a given marking
export function isTransitionEnabled(marking: Marking, transition: Transition): boolean {
  for (const p of PLACES) {
    if ((marking[p] ?? 0) < W_MINUS[p][transition]) {
      return false;
    }
  }
  return true;
}

// Simulates firing a transition in the Petri Net (throws if not enabled)
export function fireTransition(marking: Marking, transition: Transition): Marking {
  if (!isTransitionEnabled(marking, transition)) {
    throw new Error(
      `Transition ${transition} is not enabled in marking ${JSON.stringify(marking)}. ` +
        `Check validation rules at [petri-net.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/petri-net.ts).`
    );
  }
  const nextMarking = { ...marking };
  for (const p of PLACES) {
    nextMarking[p] = (nextMarking[p] ?? 0) - W_MINUS[p][transition] + W_PLUS[p][transition];
  }
  return nextMarking;
}

// --- OCEL 2.0 Compliant Logger Support ---

export interface OcelGlobalLog {
  'ocel:version': string;
  'ocel:ordering': string;
  'ocel:object-types': string[];
  'ocel:event-types'?: Record<
    string,
    {
      attributes: Record<string, string>;
    }
  >;
}

export interface OcelEvent {
  'ocel:activity': Transition;
  'ocel:timestamp': string;
  'ocel:omap': string[];
  'ocel:vmap': Record<string, any>;
}

export interface OcelObject {
  'ocel:type': string;
  'ocel:vmap': Record<string, any>;
}

export interface OcelLog {
  'ocel:global-log': OcelGlobalLog;
  'ocel:events': Record<string, OcelEvent>;
  'ocel:objects': Record<string, OcelObject>;
}

export function emitOcel2Log(
  events: Array<{
    eid: string;
    activity: Transition;
    timestamp: string;
    omap: string[];
    vmap?: Record<string, any>;
  }>,
  objects: Array<{
    oid: string;
    type: string;
    vmap?: Record<string, any>;
  }>
): OcelLog {
  const ocelEvents: Record<string, OcelEvent> = {};
  for (const e of events) {
    ocelEvents[e.eid] = {
      'ocel:activity': e.activity,
      'ocel:timestamp': e.timestamp,
      'ocel:omap': e.omap,
      'ocel:vmap': e.vmap ?? {},
    };
  }

  const ocelObjects: Record<string, OcelObject> = {};
  for (const o of objects) {
    ocelObjects[o.oid] = {
      'ocel:type': o.type,
      'ocel:vmap': o.vmap ?? {},
    };
  }

  return {
    'ocel:global-log': {
      'ocel:version': '2.0',
      'ocel:ordering': 'timestamp',
      'ocel:object-types': Array.from(new Set(objects.map((o) => o.type))),
      'ocel:event-types': {
        enqueue: { attributes: {} },
        verifyZkp: { attributes: {} },
        signEnclave: { attributes: {} },
        signPq: { attributes: {} },
        bindReceipt: { attributes: {} },
      },
    },
    'ocel:events': ocelEvents,
    'ocel:objects': ocelObjects,
  };
}

export function parseOcel2Log(jsonString: string): OcelLog {
  const log = JSON.parse(jsonString) as OcelLog;
  if (!log['ocel:global-log'] || log['ocel:global-log']['ocel:version'] !== '2.0') {
    throw new Error(
      `Invalid OCEL log: expected version 2.0. ` +
        `Check specifications at [petri-net.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/petri-net.ts).`
    );
  }
  return log;
}

// --- Token-Game Replay Conformance Checker ---

export class TokenReplayEngine {
  /**
   * Replays a sequence of transitions on the Petri Net.
   */
  public replayTrace(
    trace: Transition[],
    initialMarking: Marking = {
      Queue: 0,
      Verifying: 0,
      Attesting: 0,
      Signing: 0,
      Receipts: 0,
      Verified: 0,
    },
    expectedFinalMarking: Marking = {
      Queue: 0,
      Verifying: 0,
      Attesting: 0,
      Signing: 0,
      Receipts: 1,
      Verified: 1,
    }
  ): ReplayResult {
    const currentMarking = { ...initialMarking };
    const logs: string[] = [];

    let produced = 0;
    let consumed = 0;
    let missing = 0;
    let remaining = 0;

    // Count initial marking tokens as produced
    for (const p of PLACES) {
      produced += currentMarking[p] ?? 0;
    }

    logs.push(formatLog('Starting token-based replay.'));

    for (const transition of trace) {
      if (!TRANSITIONS.includes(transition)) {
        logs.push(
          formatLog(
            `[CONFORMANCE DEVIATION] Invalid transition '${transition}' skipped during replay.`
          )
        );
        missing += 1;
        produced += 1;
        consumed += 1;
        continue;
      }

      // Check enabling for transition
      for (const p of PLACES) {
        const weight = W_MINUS[p][transition];
        if (weight > 0) {
          const currentVal = currentMarking[p] ?? 0;
          if (currentVal < weight) {
            const shortage = weight - currentVal;
            missing += shortage;
            produced += shortage;
            currentMarking[p] = currentVal + shortage;
            logs.push(
              formatLog(
                `[CONFORMANCE DEVIATION] Place '${p}' missing ${shortage} token(s) to fire '${transition}'.`
              )
            );
          }
        }
      }

      // Consume tokens
      for (const p of PLACES) {
        const weight = W_MINUS[p][transition];
        if (weight > 0) {
          currentMarking[p] = (currentMarking[p] ?? 0) - weight;
          consumed += weight;
        }
      }

      // Produce tokens
      for (const p of PLACES) {
        const weight = W_PLUS[p][transition];
        if (weight > 0) {
          currentMarking[p] = (currentMarking[p] ?? 0) + weight;
          produced += weight;
        }
      }
    }

    // Final marking check
    for (const p of PLACES) {
      const expected = expectedFinalMarking[p] ?? 0;
      const actual = currentMarking[p] ?? 0;
      if (actual < expected) {
        const shortage = expected - actual;
        missing += shortage;
        produced += shortage;
        currentMarking[p] = actual + shortage;
        logs.push(
          formatLog(
            `[CONFORMANCE DEVIATION] Missing ${shortage} token(s) in place '${p}' at termination.`
          )
        );
      }
    }

    // Consume expected final marking tokens
    for (const p of PLACES) {
      const expected = expectedFinalMarking[p] ?? 0;
      currentMarking[p] = (currentMarking[p] ?? 0) - expected;
      consumed += expected;
    }

    // Remaining tokens check
    for (const p of PLACES) {
      const actual = currentMarking[p] ?? 0;
      if (actual > 0) {
        remaining += actual;
        logs.push(
          formatLog(`[CONFORMANCE DEVIATION] Remaining token(s) in place '${p}' after execution.`)
        );
      }
    }

    // Fitness calculation
    // f = 0.5 * (1 - m/c) + 0.5 * (1 - r/p)
    const term1 =
      consumed > 0 ? Math.max(0, (consumed - missing) / consumed) : missing === 0 ? 1 : 0;
    const term2 =
      produced > 0 ? Math.max(0, (produced - remaining) / produced) : remaining === 0 ? 1 : 0;
    const fitness = 0.5 * term1 + 0.5 * term2;
    const fitnessCleaned = Math.max(0, Math.min(1, fitness));
    const isConforming = fitnessCleaned === 1.0;

    logs.push(
      formatLog(
        `Conformance check finished. Fitness: ${fitnessCleaned.toFixed(4)}. Conforming: ${isConforming}.`
      )
    );

    return {
      fitness: fitnessCleaned,
      produced,
      consumed,
      missing,
      remaining,
      finalMarking: currentMarking,
      isConforming,
      logs,
    };
  }

  /**
   * Replays an OCEL 2.0 log projected on a specific object ID.
   */
  public replayOcelObject(
    log: OcelLog,
    objectId: string,
    initialMarking?: Marking,
    expectedFinalMarking?: Marking
  ): ReplayResult {
    // Extract events mapped to this object
    const events = Object.entries(log['ocel:events'])
      .filter(([_, e]) => e['ocel:omap'].includes(objectId))
      .map(([eid, e]) => ({
        eid,
        activity: e['ocel:activity'],
        timestamp: new Date(e['ocel:timestamp']).getTime(),
      }));

    // Sort by timestamp, and then by EID
    events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.eid.localeCompare(b.eid);
    });

    const trace = events.map((e) => e.activity);
    return this.replayTrace(trace, initialMarking, expectedFinalMarking);
  }
}

// --- Fuzz Testing Stream Generator ---

export interface FuzzOptions {
  strategy:
    | 'valid'
    | 'missing_enqueue'
    | 'missing_verify_zkp'
    | 'missing_sign_enclave'
    | 'missing_sign_pq'
    | 'missing_bind_receipt'
    | 'duplicate_step'
    | 'out_of_order';
  tokenId: string;
  agentId: string;
}

export function fuzzLogStream(options: FuzzOptions): OcelLog {
  const { strategy, tokenId, agentId } = options;
  const events: Array<{
    eid: string;
    activity: Transition;
    timestamp: string;
    omap: string[];
    vmap?: Record<string, any>;
  }> = [];

  const now = new Date('2026-06-01T03:00:00Z');
  const getNextTimestamp = (offsetSec: number) => {
    now.setSeconds(now.getSeconds() + offsetSec);
    return now.toISOString();
  };

  const addEvent = (activity: Transition) => {
    const eid = `e-${activity}-${Math.random().toString(36).substr(2, 9)}`;
    events.push({
      eid,
      activity,
      timestamp: getNextTimestamp(10),
      omap: [tokenId, agentId],
      vmap: { worker: agentId },
    });
  };

  switch (strategy) {
    case 'valid': {
      addEvent('enqueue');
      addEvent('verifyZkp');
      addEvent('signEnclave');
      addEvent('signPq');
      addEvent('bindReceipt');
      break;
    }
    case 'missing_enqueue': {
      addEvent('verifyZkp');
      addEvent('signEnclave');
      addEvent('signPq');
      addEvent('bindReceipt');
      break;
    }
    case 'missing_verify_zkp': {
      addEvent('enqueue');
      addEvent('signEnclave');
      addEvent('signPq');
      addEvent('bindReceipt');
      break;
    }
    case 'missing_sign_enclave': {
      addEvent('enqueue');
      addEvent('verifyZkp');
      addEvent('signPq');
      addEvent('bindReceipt');
      break;
    }
    case 'missing_sign_pq': {
      addEvent('enqueue');
      addEvent('verifyZkp');
      addEvent('signEnclave');
      addEvent('bindReceipt');
      break;
    }
    case 'missing_bind_receipt': {
      addEvent('enqueue');
      addEvent('verifyZkp');
      addEvent('signEnclave');
      addEvent('signPq');
      break;
    }
    case 'duplicate_step': {
      addEvent('enqueue');
      addEvent('verifyZkp');
      addEvent('verifyZkp'); // duplicate
      addEvent('signEnclave');
      addEvent('signPq');
      addEvent('bindReceipt');
      break;
    }
    case 'out_of_order': {
      addEvent('bindReceipt');
      addEvent('enqueue');
      addEvent('verifyZkp');
      addEvent('signEnclave');
      addEvent('signPq');
      break;
    }
    default: {
      throw new Error(`Unknown fuzzing strategy: ${strategy}`);
    }
  }

  const objects = [
    { oid: tokenId, type: 'Token', vmap: { status: 'active' } },
    { oid: agentId, type: 'Agent', vmap: { role: 'attester' } },
  ];

  return emitOcel2Log(events, objects);
}

export function petriNetOcelToOcelLogTs(log: OcelLog): OcelLogTs {
  const objects: OcelObjectTs[] = [];
  const events: OcelEventTs[] = [];
  const e2o: EventObjectLinkTs[] = [];

  for (const [id, obj] of Object.entries(log['ocel:objects'])) {
    const attributes: OcelAttributeTs[] = Object.entries(obj['ocel:vmap'] || {}).map(([key, val]) => {
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
      object_type: obj['ocel:type'],
      attributes,
    });
  }

  for (const [id, evt] of Object.entries(log['ocel:events'])) {
    const attributes: OcelAttributeTs[] = Object.entries(evt['ocel:vmap'] || {}).map(([key, val]) => {
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

    const timestampNs = evt['ocel:timestamp'] ? BigInt(new Date(evt['ocel:timestamp']).getTime()) * 1000000n : null;

    events.push({
      id,
      activity: evt['ocel:activity'],
      timestamp_ns: timestampNs,
      attributes,
    });

    for (const objId of evt['ocel:omap']) {
      e2o.push({
        event_id: id,
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

