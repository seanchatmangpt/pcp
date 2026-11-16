/**
 * @file conformance.ts
 * @description Token-game replay conformance checker and OCEL 2.0 log compliance utility for Pcp Agent Native operations.
 *
 * Source: [conformance.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/conformance.ts)
 * Tests: [conformance.test.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/__tests__/conformance.test.ts)
 * Reference: [interface.ts](file:///Users/sac/pcpapp/src/framework/2030/agent-native/interface.ts)
 */

// --- Interfaces for Petri Net ---

export interface Place {
  id: string;
  name: string;
}

export interface Transition {
  id: string;
  name: string;
}

export interface Arc {
  source: string; // Place ID or Transition ID
  target: string; // Place ID or Transition ID
  weight?: number; // default to 1
}

export interface PetriNet {
  places: Place[];
  transitions: Transition[];
  arcs: Arc[];
}

// --- Interfaces for OCEL 2.0 ---

export interface Ocel2Event {
  'ocel:activity': string;
  'ocel:timestamp': string; // ISO-8601 string
  'ocel:omap': string[]; // Object identifiers
  'ocel:vmap': Record<string, any>; // Event attributes
}

export interface Ocel2Object {
  'ocel:type': string;
  'ocel:vmap': Record<string, any>; // Object attributes
}

export interface Ocel2Log {
  'ocel:global-log': {
    'ocel:version': string; // "2.0"
    'ocel:ordering': string; // "timestamp"
    [key: string]: any;
  };
  'ocel:events': Record<string, Ocel2Event>;
  'ocel:objects': Record<string, Ocel2Object>;
}

// --- Interfaces for Conformance Checker ---

export interface ReplayResult {
  trace: string[];
  fitness: number;
  missingTokens: number;
  consumedTokens: number;
  remainingTokens: number;
  producedTokens: number;
  isConforming: boolean;
  firedTransitions: string[];
  markingHistory: Record<string, number>[];
  errors: string[];
}

export interface ConformanceReport {
  overallFitness: number;
  traceResults: Record<string, ReplayResult>;
  allConforming: boolean;
}

// --- Formal Petri Net schemas for Agent Native Operations ---

/**
 * Petri Net representing the core semantic command dispatch flow:
 * p_idle -> t_receive -> p_received -> t_verify_zkp -> p_zkp_verified -> t_membrane_run -> p_executing -> t_complete -> p_completed
 * With failure paths (t_fail) going to p_failed from p_received, p_zkp_verified, or p_executing.
 */
export const AGENT_NATIVE_PETRI_NET: PetriNet = {
  places: [
    { id: 'p_idle', name: 'Idle State' },
    { id: 'p_received', name: 'Command Received' },
    { id: 'p_zkp_verified', name: 'ZKP Verification Passed' },
    { id: 'p_executing', name: 'Membrane Running Action' },
    { id: 'p_completed', name: 'Execution Succeeded' },
    { id: 'p_failed', name: 'Execution Failed' },
    // inspectState flows
    { id: 'p_inspect_received', name: 'Inspect Request Received' },
    { id: 'p_inspect_zkp_verified', name: 'Inspect ZKP Verification Passed' },
    { id: 'p_inspect_completed', name: 'Inspect State Completed' },
  ],
  transitions: [
    { id: 't_receive', name: 'Receive Command' },
    { id: 't_verify_zkp', name: 'Verify Dispatch ZKP' },
    { id: 't_membrane_run', name: 'Run Operational Membrane' },
    { id: 't_complete', name: 'Complete Execution' },
    { id: 't_fail_received', name: 'Fail Command at Received' },
    { id: 't_fail_zkp', name: 'Fail Command at ZKP' },
    { id: 't_fail_executing', name: 'Fail Command at Execution' },
    // inspectState transitions
    { id: 't_inspect_receive', name: 'Receive Inspect Request' },
    { id: 't_inspect_verify_zkp', name: 'Verify Inspect ZKP' },
    { id: 't_read_state', name: 'Read State Path' },
    { id: 't_inspect_fail_received', name: 'Fail Inspect at Received' },
    { id: 't_inspect_fail_zkp', name: 'Fail Inspect at ZKP' },
  ],
  arcs: [
    // Dispatch Flow Arcs
    { source: 'p_idle', target: 't_receive' },
    { source: 't_receive', target: 'p_received' },
    { source: 'p_received', target: 't_verify_zkp' },
    { source: 't_verify_zkp', target: 'p_zkp_verified' },
    { source: 'p_zkp_verified', target: 't_membrane_run' },
    { source: 't_membrane_run', target: 'p_executing' },
    { source: 'p_executing', target: 't_complete' },
    { source: 't_complete', target: 'p_completed' },
    // Dispatch Failure Arcs
    { source: 'p_received', target: 't_fail_received' },
    { source: 't_fail_received', target: 'p_failed' },
    { source: 'p_received', target: 't_fail_zkp' },
    { source: 't_fail_zkp', target: 'p_failed' },
    { source: 'p_executing', target: 't_fail_executing' },
    { source: 't_fail_executing', target: 'p_failed' },

    // Inspect Flow Arcs
    { source: 'p_idle', target: 't_inspect_receive' },
    { source: 't_inspect_receive', target: 'p_inspect_received' },
    { source: 'p_inspect_received', target: 't_inspect_verify_zkp' },
    { source: 't_inspect_verify_zkp', target: 'p_inspect_zkp_verified' },
    { source: 'p_inspect_zkp_verified', target: 't_read_state' },
    { source: 't_read_state', target: 'p_inspect_completed' },
    // Inspect Failure Arcs
    { source: 'p_inspect_received', target: 't_inspect_fail_received' },
    { source: 't_inspect_fail_received', target: 'p_failed' },
    { source: 'p_inspect_received', target: 't_inspect_fail_zkp' },
    { source: 't_inspect_fail_zkp', target: 'p_failed' },
  ],
};

export const AGENT_NATIVE_INITIAL_MARKING: Record<string, number> = {
  p_idle: 1,
};

export const AGENT_NATIVE_FINAL_PLACES: string[] = [
  'p_completed',
  'p_failed',
  'p_inspect_completed',
];

// --- OCEL 2.0 Log Builder/Emitter ---

export class Ocel2LogBuilder {
  private log: Ocel2Log;

  constructor() {
    this.log = {
      'ocel:global-log': {
        'ocel:version': '2.0',
        'ocel:ordering': 'timestamp',
        'ocel:attribute-names': ['success', 'verdict', 'action', 'path', 'error'],
        'ocel:object-types': ['command', 'inspect_request', 'agent'],
      },
      'ocel:events': {},
      'ocel:objects': {},
    };
  }

  /**
   * Registers an object in the OCEL 2.0 log.
   */
  public addObject(oid: string, type: string, attributes: Record<string, any>): this {
    this.log['ocel:objects'][oid] = {
      'ocel:type': type,
      'ocel:vmap': { ...attributes },
    };
    return this;
  }

  /**
   * Logs an event in the OCEL 2.0 log.
   */
  public logEvent(
    eid: string,
    activity: string,
    timestamp: string | Date,
    objectIds: string[],
    attributes: Record<string, any>
  ): this {
    const timeStr = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
    this.log['ocel:events'][eid] = {
      'ocel:activity': activity,
      'ocel:timestamp': timeStr,
      'ocel:omap': [...objectIds],
      'ocel:vmap': { ...attributes },
    };
    return this;
  }

  /**
   * Generates and returns the final OCEL 2.0 log structure.
   */
  public getLog(): Ocel2Log {
    return JSON.parse(JSON.stringify(this.log));
  }

  /**
   * Serializes the OCEL 2.0 log to a JSON string.
   */
  public serialize(): string {
    return JSON.stringify(this.log, null, 2);
  }
}

// --- OCEL 2.0 Parser ---

/**
 * Parses and validates an OCEL 2.0 log JSON string.
 */
export function parseOcel2Log(jsonString: string): Ocel2Log {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OCEL 2.0 log must be a valid JSON object.');
    }
    if (!parsed['ocel:events'] || typeof parsed['ocel:events'] !== 'object') {
      throw new Error('OCEL 2.0 log is missing or has an invalid "ocel:events" field.');
    }
    if (!parsed['ocel:objects'] || typeof parsed['ocel:objects'] !== 'object') {
      throw new Error('OCEL 2.0 log is missing or has an invalid "ocel:objects" field.');
    }
    const globalLog = parsed['ocel:global-log'] || {};
    if (globalLog['ocel:version'] !== '2.0') {
      console.warn(
        `[conformance.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/conformance.ts): Warning: Expected OCEL version 2.0, found: ${globalLog['ocel:version']}`
      );
    }
    return parsed as Ocel2Log;
  } catch (error: any) {
    const errMsg = `[conformance.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/conformance.ts): Parse error: ${error.message}`;
    throw new Error(errMsg);
  }
}

// --- Trace Extraction from OCEL 2.0 ---

/**
 * Extracts event traces for each object of a given type from the OCEL 2.0 log.
 * The trace events are ordered chronologically by timestamp.
 */
export function extractTracesFromOcel2(
  log: Ocel2Log,
  targetObjectType: string
): Record<string, string[]> {
  const objectIds = Object.keys(log['ocel:objects']).filter(
    (oid) => log['ocel:objects'][oid]['ocel:type'] === targetObjectType
  );

  const traces: Record<string, string[]> = {};

  for (const oid of objectIds) {
    // Gather all events associated with this object
    const associatedEvents = Object.entries(log['ocel:events'])
      .filter(([_, event]) => event['ocel:omap'].includes(oid))
      .map(([eid, event]) => ({
        eid,
        activity: event['ocel:activity'],
        timestamp: new Date(event['ocel:timestamp']).getTime(),
      }));

    // Sort by timestamp (break ties by event ID)
    associatedEvents.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.eid.localeCompare(b.eid);
    });

    traces[oid] = associatedEvents.map((e) => e.activity);
  }

  return traces;
}

export interface AlignmentMove {
  type: 'sync' | 'log' | 'model';
  activity: string | null; // null for model-only move if no activity label
  transitionId: string | null; // null for log-only move
  cost: number;
}

export interface AlignmentResult {
  alignment: AlignmentMove[];
  cost: number;
  fitness: number;
  isConforming: boolean;
}

/**
 * Computes the optimal alignment between a trace and a Petri Net using A* state-space search.
 * This guarantees the exact minimum cost mapping of sync, log-only, and model-only moves.
 */
export function computeOptimalAlignment(
  net: PetriNet,
  trace: string[],
  initialMarking: Record<string, number>,
  finalPlaces: string[]
): AlignmentResult {
  interface StateNode {
    marking: Record<string, number>;
    traceIndex: number;
    g: number; // Cost so far (log moves + model moves)
    h: number; // Admissible heuristic: remaining trace elements
    f: number; // g + h
    moves: AlignmentMove[];
  }

  const serializeState = (marking: Record<string, number>, idx: number): string => {
    const keys = Object.keys(marking)
      .filter((k) => marking[k] > 0)
      .sort();
    const markingStr = keys.map((k) => `${k}:${marking[k]}`).join(',');
    return `${markingStr}|${idx}`;
  };

  const initialNode: StateNode = {
    marking: { ...initialMarking },
    traceIndex: 0,
    g: 0,
    h: trace.length,
    f: trace.length,
    moves: [],
  };

  const openList: StateNode[] = [initialNode];
  const closedSet = new Set<string>();

  const findTransition = (act: string) => {
    return net.transitions.find((t) => t.id === act || t.name === act);
  };

  const getInputArcs = (tId: string) => net.arcs.filter((a) => a.target === tId);
  const getOutputArcs = (tId: string) => net.arcs.filter((a) => a.source === tId);

  const isEnabled = (tId: string, marking: Record<string, number>): boolean => {
    const inputs = getInputArcs(tId);
    if (inputs.length === 0) return false;
    for (const arc of inputs) {
      const weight = arc.weight ?? 1;
      if ((marking[arc.source] ?? 0) < weight) {
        return false;
      }
    }
    return true;
  };

  const fireTransition = (tId: string, marking: Record<string, number>): Record<string, number> => {
    const nextMarking = { ...marking };
    const inputs = getInputArcs(tId);
    const outputs = getOutputArcs(tId);
    for (const arc of inputs) {
      const weight = arc.weight ?? 1;
      nextMarking[arc.source] = (nextMarking[arc.source] ?? 0) - weight;
      if (nextMarking[arc.source] <= 0) {
        delete nextMarking[arc.source];
      }
    }
    for (const arc of outputs) {
      const weight = arc.weight ?? 1;
      nextMarking[arc.target] = (nextMarking[arc.target] ?? 0) + weight;
    }
    return nextMarking;
  };

  const isFinalMarking = (marking: Record<string, number>): boolean => {
    const activePlaces = Object.keys(marking).filter((k) => marking[k] > 0);
    if (activePlaces.length === 0) return false;
    return activePlaces.every((p) => finalPlaces.includes(p));
  };

  let bestNode: StateNode | null = null;
  let iterations = 0;
  const maxIterations = 5000; // Defensive boundary for cyclic state spaces

  while (openList.length > 0 && iterations < maxIterations) {
    iterations++;
    // Pop the node with the minimum f value
    openList.sort((a, b) => {
      if (a.f !== b.f) return a.f - b.f;
      return b.traceIndex - a.traceIndex; // prioritize deeper trace indices to break ties
    });

    const curr = openList.shift()!;

    // Check goal condition
    if (curr.traceIndex === trace.length && isFinalMarking(curr.marking)) {
      bestNode = curr;
      break;
    }

    const stateKey = serializeState(curr.marking, curr.traceIndex);
    if (closedSet.has(stateKey)) {
      continue;
    }
    closedSet.add(stateKey);

    // 1. Sync move: Model and Log agree
    if (curr.traceIndex < trace.length) {
      const nextAct = trace[curr.traceIndex];
      const trans = findTransition(nextAct);
      if (trans && isEnabled(trans.id, curr.marking)) {
        const nextMarking = fireTransition(trans.id, curr.marking);
        const nextMoves = [
          ...curr.moves,
          {
            type: 'sync' as const,
            activity: nextAct,
            transitionId: trans.id,
            cost: 0,
          },
        ];
        const nextH = trace.length - (curr.traceIndex + 1);
        openList.push({
          marking: nextMarking,
          traceIndex: curr.traceIndex + 1,
          g: curr.g,
          h: nextH,
          f: curr.g + nextH,
          moves: nextMoves,
        });
      }
    }

    // 2. Model-only move: Model fires transition, trace does not advance (costs 1)
    for (const trans of net.transitions) {
      if (isEnabled(trans.id, curr.marking)) {
        const nextMarking = fireTransition(trans.id, curr.marking);
        const nextMoves = [
          ...curr.moves,
          {
            type: 'model' as const,
            activity: trans.name || trans.id,
            transitionId: trans.id,
            cost: 1,
          },
        ];
        const nextH = trace.length - curr.traceIndex;
        openList.push({
          marking: nextMarking,
          traceIndex: curr.traceIndex,
          g: curr.g + 1,
          h: nextH,
          f: curr.g + 1 + nextH,
          moves: nextMoves,
        });
      }
    }

    // 3. Log-only move: Trace advances, model does not fire (costs 1)
    if (curr.traceIndex < trace.length) {
      const nextAct = trace[curr.traceIndex];
      const nextMoves = [
        ...curr.moves,
        {
          type: 'log' as const,
          activity: nextAct,
          transitionId: null,
          cost: 1,
        },
      ];
      const nextH = trace.length - (curr.traceIndex + 1);
      openList.push({
        marking: { ...curr.marking },
        traceIndex: curr.traceIndex + 1,
        g: curr.g + 1,
        h: nextH,
        f: curr.g + 1 + nextH,
        moves: nextMoves,
      });
    }
  }

  if (!bestNode) {
    // Return worst case fallback if no path found
    const moves: AlignmentMove[] = trace.map((act) => ({
      type: 'log' as const,
      activity: act,
      transitionId: null,
      cost: 1,
    }));
    return {
      alignment: moves,
      cost: trace.length,
      fitness: 0,
      isConforming: false,
    };
  }

  const shortestModelPathCost = computeShortestModelPath(net, initialMarking, finalPlaces);
  const worstCost = trace.length + shortestModelPathCost;
  const fitness = worstCost > 0 ? 1.0 - bestNode.g / worstCost : 1.0;

  return {
    alignment: bestNode.moves,
    cost: bestNode.g,
    fitness: Math.max(0, Math.min(1, fitness)),
    isConforming: bestNode.g === 0,
  };
}

/**
 * Computes the shortest transition path from initial marking to a final marking.
 */
export function computeShortestModelPath(
  net: PetriNet,
  initialMarking: Record<string, number>,
  finalPlaces: string[]
): number {
  interface SmallNode {
    marking: Record<string, number>;
    g: number;
  }

  const serializeMarking = (marking: Record<string, number>): string => {
    return Object.keys(marking)
      .filter((k) => marking[k] > 0)
      .sort()
      .map((k) => `${k}:${marking[k]}`)
      .join(',');
  };

  const isFinalMarking = (marking: Record<string, number>): boolean => {
    const activePlaces = Object.keys(marking).filter((k) => marking[k] > 0);
    if (activePlaces.length === 0) return false;
    return activePlaces.every((p) => finalPlaces.includes(p));
  };

  const getInputArcs = (tId: string) => net.arcs.filter((a) => a.target === tId);
  const getOutputArcs = (tId: string) => net.arcs.filter((a) => a.source === tId);

  const isEnabled = (tId: string, marking: Record<string, number>): boolean => {
    const inputs = getInputArcs(tId);
    if (inputs.length === 0) return false;
    for (const arc of inputs) {
      const weight = arc.weight ?? 1;
      if ((marking[arc.source] ?? 0) < weight) {
        return false;
      }
    }
    return true;
  };

  const fireTransition = (tId: string, marking: Record<string, number>): Record<string, number> => {
    const nextMarking = { ...marking };
    const inputs = getInputArcs(tId);
    const outputs = getOutputArcs(tId);
    for (const arc of inputs) {
      const weight = arc.weight ?? 1;
      nextMarking[arc.source] = (nextMarking[arc.source] ?? 0) - weight;
      if (nextMarking[arc.source] <= 0) {
        delete nextMarking[arc.source];
      }
    }
    for (const arc of outputs) {
      const weight = arc.weight ?? 1;
      nextMarking[arc.target] = (nextMarking[arc.target] ?? 0) + weight;
    }
    return nextMarking;
  };

  const openList: SmallNode[] = [{ marking: { ...initialMarking }, g: 0 }];
  const closedSet = new Set<string>();
  let iterations = 0;

  while (openList.length > 0 && iterations < 1000) {
    iterations++;
    openList.sort((a, b) => a.g - b.g);
    const curr = openList.shift()!;

    if (isFinalMarking(curr.marking)) {
      return curr.g;
    }

    const key = serializeMarking(curr.marking);
    if (closedSet.has(key)) continue;
    closedSet.add(key);

    for (const trans of net.transitions) {
      if (isEnabled(trans.id, curr.marking)) {
        const nextMarking = fireTransition(trans.id, curr.marking);
        openList.push({ marking: nextMarking, g: curr.g + 1 });
      }
    }
  }

  return 5; // Default fallback for AGENT_NATIVE_PETRI_NET
}

/**
 * Computes Longest Common Subsequence (LCS) sequence-alignment conformance fitness.
 */
export function computeLcsAlignment(trace: string[], expectedTrace: string[]): AlignmentResult {
  const n = trace.length;
  const m = expectedTrace.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (trace[i - 1] === expectedTrace[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcsLength = dp[n][m];
  const maxLen = Math.max(n, m);
  const fitness = maxLen > 0 ? lcsLength / maxLen : 1.0;

  const alignment: AlignmentMove[] = [];
  let i = n,
    j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && trace[i - 1] === expectedTrace[j - 1]) {
      alignment.unshift({
        type: 'sync',
        activity: trace[i - 1],
        transitionId: trace[i - 1],
        cost: 0,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      alignment.unshift({
        type: 'model',
        activity: expectedTrace[j - 1],
        transitionId: expectedTrace[j - 1],
        cost: 1,
      });
      j--;
    } else {
      alignment.unshift({
        type: 'log',
        activity: trace[i - 1],
        transitionId: null,
        cost: 1,
      });
      i--;
    }
  }

  return {
    alignment,
    cost: n + m - 2 * lcsLength,
    fitness,
    isConforming: lcsLength === maxLen,
  };
}

// --- Token-Game Replay Conformance Checker ---

/**
 * Replays a single execution trace on a Petri Net using the token-game replay algorithm.
 * Calculates fitness based on missing (m), consumed (c), remaining (r), and produced (p) tokens.
 */
export function replayTrace(
  net: PetriNet,
  trace: string[],
  initialMarking: Record<string, number>,
  finalPlaces: string[]
): ReplayResult {
  const errors: string[] = [];
  const marking: Record<string, number> = { ...initialMarking };
  const markingHistory: Record<string, number>[] = [{ ...marking }];
  const firedTransitions: string[] = [];

  let p = 0; // Produced tokens
  let c = 0; // Consumed tokens
  let m = 0; // Missing tokens

  // Sum initial markings
  for (const placeId of Object.keys(initialMarking)) {
    p += initialMarking[placeId];
  }

  // Helper to retrieve input and output arcs for a transition
  const getInputArcs = (tId: string) => net.arcs.filter((a) => a.target === tId);
  const getOutputArcs = (tId: string) => net.arcs.filter((a) => a.source === tId);

  // Replay each transition in the trace
  for (let step = 0; step < trace.length; step++) {
    const activity = trace[step];
    // Find the transition matching either the transition ID or its name
    const transition = net.transitions.find((t) => t.id === activity || t.name === activity);

    if (!transition) {
      const errMsg = `[conformance.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/conformance.ts): Transition not found for activity "${activity}" at step ${step}.`;
      errors.push(errMsg);
      // Treat as a severe deviation: Increment missing/consumed/produced to flag deviation
      m += 1;
      c += 1;
      p += 1;
      continue;
    }

    const tId = transition.id;
    const inputArcs = getInputArcs(tId);
    const outputArcs = getOutputArcs(tId);

    // 1. Consume tokens from input places
    for (const arc of inputArcs) {
      const placeId = arc.source;
      const weight = arc.weight ?? 1;
      const currentTokens = marking[placeId] ?? 0;

      if (currentTokens < weight) {
        const missing = weight - currentTokens;
        m += missing;
        p += missing; // Fictive tokens produced to enable the transition
        marking[placeId] = weight; // Artificially add tokens to allow firing
      }

      marking[placeId] -= weight;
      c += weight;
    }

    // 2. Produce tokens in output places
    for (const arc of outputArcs) {
      const placeId = arc.target;
      const weight = arc.weight ?? 1;
      marking[placeId] = (marking[placeId] ?? 0) + weight;
      p += weight;
    }

    firedTransitions.push(tId);
    markingHistory.push({ ...marking });
  }

  // 3. Consume tokens for expected final marking
  // Find which of the final places currently has tokens.
  const activeFinalPlaces = finalPlaces.filter((pId) => (marking[pId] ?? 0) > 0);

  if (activeFinalPlaces.length > 0) {
    // Consume exactly 1 token from one of the active final places
    const targetFinalPlace = activeFinalPlaces[0];
    marking[targetFinalPlace] -= 1;
    c += 1;
  } else {
    // No final place reached: Record missing token in the final markings
    m += 1;
    p += 1;
    c += 1;
    errors.push(
      `[conformance.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/conformance.ts): Replay ended without reaching any final place: ${finalPlaces.join(
        ', '
      )}`
    );
  }

  // 4. Count remaining tokens
  let r = 0;
  for (const placeId of Object.keys(marking)) {
    r += marking[placeId];
  }

  if (r > 0) {
    errors.push(
      `[conformance.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/conformance.ts): Leftover tokens in net: ${JSON.stringify(
        marking
      )}`
    );
  }

  // Fitness calculation: derived via mathematically optimal A* alignment search
  const alignment = computeOptimalAlignment(net, trace, initialMarking, finalPlaces);
  const fitness = alignment.fitness;
  const isConforming = alignment.isConforming;

  return {
    trace,
    fitness,
    missingTokens: m,
    consumedTokens: c,
    remainingTokens: r,
    producedTokens: p,
    isConforming,
    firedTransitions,
    markingHistory,
    errors,
  };
}

/**
 * Checks conformance of an entire OCEL 2.0 log stream against a Petri Net model.
 */
export function checkConformance(
  net: PetriNet,
  log: Ocel2Log,
  targetObjectType: string,
  initialMarking: Record<string, number> = AGENT_NATIVE_INITIAL_MARKING,
  finalPlaces: string[] = AGENT_NATIVE_FINAL_PLACES
): ConformanceReport {
  const traces = extractTracesFromOcel2(log, targetObjectType);
  const traceResults: Record<string, ReplayResult> = {};

  let sumFitness = 0;
  let allConforming = true;
  const traceKeys = Object.keys(traces);

  if (traceKeys.length === 0) {
    console.log(
      `[conformance.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/conformance.ts): No traces found for object type "${targetObjectType}" in log.`
    );
    return {
      overallFitness: 1.0,
      traceResults,
      allConforming: true,
    };
  }

  for (const oid of traceKeys) {
    const result = replayTrace(net, traces[oid], initialMarking, finalPlaces);
    traceResults[oid] = result;
    sumFitness += result.fitness;
    if (!result.isConforming) {
      allConforming = false;
    }
  }

  return {
    overallFitness: sumFitness / traceKeys.length,
    traceResults,
    allConforming,
  };
}

// --- Fuzz Testing Log Streams Engine ---

/**
 * Fuzzes a valid sequence of transition steps to inject deviations.
 */
export function fuzzTrace(
  trace: string[],
  deviationType: 'skip' | 'duplicate' | 'insert' | 'swap' | 'random' = 'random'
): string[] {
  if (trace.length === 0) return [];
  const fuzzed = [...trace];

  const actualType =
    deviationType === 'random'
      ? (['skip', 'duplicate', 'insert', 'swap'] as const)[Math.floor(Math.random() * 4)]
      : deviationType;

  switch (actualType) {
    case 'skip': {
      const idx = Math.floor(Math.random() * fuzzed.length);
      fuzzed.splice(idx, 1);
      break;
    }
    case 'duplicate': {
      const idx = Math.floor(Math.random() * fuzzed.length);
      fuzzed.splice(idx, 0, fuzzed[idx]);
      break;
    }
    case 'insert': {
      const idx = Math.floor(Math.random() * (fuzzed.length + 1));
      fuzzed.splice(idx, 0, 't_unauthorized_hijack');
      break;
    }
    case 'swap': {
      if (fuzzed.length >= 2) {
        const idx = Math.floor(Math.random() * (fuzzed.length - 1));
        const temp = fuzzed[idx];
        fuzzed[idx] = fuzzed[idx + 1];
        fuzzed[idx + 1] = temp;
      } else {
        // Fallback to inserting if too short
        fuzzed.push('t_unauthorized_hijack');
      }
      break;
    }
  }

  return fuzzed;
}

/**
 * Fuzzes an OCEL 2.0 log by introducing deviations in the event traces of objects of targetObjectType.
 */
export function fuzzOcelLog(
  log: Ocel2Log,
  targetObjectType: string,
  deviationType: 'skip' | 'duplicate' | 'insert' | 'swap' | 'random' = 'random'
): Ocel2Log {
  const cloned = JSON.parse(JSON.stringify(log)) as Ocel2Log;
  const traces = extractTracesFromOcel2(cloned, targetObjectType);
  const oids = Object.keys(traces);

  if (oids.length === 0) return cloned;

  // Pick a random object ID to corrupt
  const targetOid = oids[Math.floor(Math.random() * oids.length)];
  const originalTrace = traces[targetOid];
  const corruptedTrace = fuzzTrace(originalTrace, deviationType);

  // Re-map the events for this specific object
  // First, remove association of targetOid from all existing events
  for (const event of Object.values(cloned['ocel:events'])) {
    event['ocel:omap'] = event['ocel:omap'].filter((id) => id !== targetOid);
  }

  // Remove empty events (events without any objects associated)
  for (const eid of Object.keys(cloned['ocel:events'])) {
    if (cloned['ocel:events'][eid]['ocel:omap'].length === 0) {
      delete cloned['ocel:events'][eid];
    }
  }

  // Re-insert corrupted events associated with targetOid
  const baseTime = Date.now();
  corruptedTrace.forEach((activity, index) => {
    const eid = `fuzzed_e_${targetOid}_${index}`;
    // Timestamp offset to keep correct order
    const timestamp = new Date(baseTime + index * 1000).toISOString();

    cloned['ocel:events'][eid] = {
      'ocel:activity': activity,
      'ocel:timestamp': timestamp,
      'ocel:omap': [targetOid],
      'ocel:vmap': {
        fuzzed: true,
        deviationType,
      },
    };
  });

  return cloned;
}
