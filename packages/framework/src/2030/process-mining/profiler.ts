/**
 * Dr. Wil van der Aalst AGI Doctrine Implementation for Pcp Agent.
 *
 * This file contains:
 * 1. Petri Net representation schemas for Agent native operations.
 * 2. OCEL 2.0 compliant log emission, validation, and parsing structures.
 * 3. A high-performance token-game replay conformance checker.
 * 4. Fuzz testing utilities for injecting and detecting trace deviations.
 * 5. Conformance checking performance benchmark.
 *
 * For architectural details, see the implementation in
 * [profiler.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/profiler.ts).
 */

// Types & Interfaces
export interface PetriNet {
  places: string[];
  transitions: string[];
  arcs: {
    source: string;
    target: string;
    weight: number;
  }[];
  initialMarking: Record<string, number>;
}

export interface ReplayResult {
  fitness: number;
  missingTokens: number;
  consumedTokens: number;
  producedTokens: number;
  remainingTokens: number;
  isConforming: boolean;
  missingTransitions: string[];
}

export interface Ocel2Event {
  id: string;
  type: string;
  time: string; // ISO 8601
  objects: string[];
  attributes?: Record<string, any>;
}

export interface Ocel2Object {
  id: string;
  type: string;
  attributes?: Record<string, any>;
}

export interface Ocel2Log {
  eventTypes: Record<string, { parameters: Record<string, string> }>;
  objectTypes: Record<string, { attributes: Record<string, string> }>;
  events: Ocel2Event[];
  objects: Ocel2Object[];
}

// 1. Petri Net schema representing Agent-native operations.
export const AgentNativePetriNet: PetriNet = {
  places: [
    'p_ready',
    'p_zkp_pending',
    'p_authorized',
    'p_execution_pending',
    'p_completed',
    'p_denied',
  ],
  transitions: [
    't_receive',
    't_verify_pass',
    't_verify_fail',
    't_skip_zkp',
    't_execute',
    't_complete',
  ],
  arcs: [
    { source: 'p_ready', target: 't_receive', weight: 1 },
    { source: 't_receive', target: 'p_zkp_pending', weight: 1 },
    { source: 'p_zkp_pending', target: 't_verify_pass', weight: 1 },
    { source: 't_verify_pass', target: 'p_authorized', weight: 1 },
    { source: 'p_zkp_pending', target: 't_verify_fail', weight: 1 },
    { source: 't_verify_fail', target: 'p_denied', weight: 1 },
    { source: 'p_zkp_pending', target: 't_skip_zkp', weight: 1 },
    { source: 't_skip_zkp', target: 'p_authorized', weight: 1 },
    { source: 'p_authorized', target: 't_execute', weight: 1 },
    { source: 't_execute', target: 'p_execution_pending', weight: 1 },
    { source: 'p_execution_pending', target: 't_complete', weight: 1 },
    { source: 't_complete', target: 'p_completed', weight: 1 },
  ],
  initialMarking: {
    p_ready: 1,
  },
};

// 2. Parser / Conformance Checker
export class ConformanceChecker {
  private net: PetriNet;
  private inputMap: Map<string, { place: string; weight: number }[]> = new Map();
  private outputMap: Map<string, { place: string; weight: number }[]> = new Map();

  constructor(net: PetriNet) {
    this.net = net;
    for (const t of net.transitions) {
      this.inputMap.set(t, []);
      this.outputMap.set(t, []);
    }
    for (const arc of net.arcs) {
      if (net.transitions.includes(arc.source)) {
        const list = this.outputMap.get(arc.source) || [];
        list.push({ place: arc.target, weight: arc.weight });
        this.outputMap.set(arc.source, list);
      } else if (net.transitions.includes(arc.target)) {
        const list = this.inputMap.get(arc.target) || [];
        list.push({ place: arc.source, weight: arc.weight });
        this.inputMap.set(arc.target, list);
      }
    }
  }

  public replayTrace(trace: string[], finalPlace?: string): ReplayResult {
    const marking = { ...this.net.initialMarking };
    let produced = 0;
    for (const p of Object.keys(marking)) {
      produced += marking[p];
    }
    let consumed = 0;
    let missing = 0;
    let remaining = 0;
    const missingTransitions: string[] = [];

    for (const transition of trace) {
      if (!this.net.transitions.includes(transition)) {
        missingTransitions.push(transition);
        missing += 1;
        consumed += 1;
        remaining += 1;
        produced += 1;
        continue;
      }
      const inputs = this.inputMap.get(transition) || [];
      const outputs = this.outputMap.get(transition) || [];

      for (const input of inputs) {
        const currentTokens = marking[input.place] || 0;
        if (currentTokens < input.weight) {
          const shortage = input.weight - currentTokens;
          missing += shortage;
          produced += shortage;
          marking[input.place] = input.weight;
        }
        marking[input.place] -= input.weight;
        consumed += input.weight;
      }

      for (const output of outputs) {
        marking[output.place] = (marking[output.place] || 0) + output.weight;
        produced += output.weight;
      }
    }

    if (finalPlace) {
      const finalMarking: Record<string, number> = { [finalPlace]: 1 };
      for (const p of Object.keys(finalMarking)) {
        const required = finalMarking[p];
        const current = marking[p] || 0;
        if (current < required) {
          const shortage = required - current;
          missing += shortage;
          produced += shortage;
          marking[p] = required;
        }
        marking[p] -= required;
        consumed += required;
      }
    }

    for (const p of Object.keys(marking)) {
      if (marking[p] > 0) {
        remaining += marking[p];
      }
    }

    const fitness =
      consumed > 0 ? 0.5 * (1 - missing / consumed) + 0.5 * (1 - remaining / produced) : 0;

    return {
      fitness: Math.max(0, Math.min(1, fitness)),
      missingTokens: missing,
      consumedTokens: consumed,
      producedTokens: produced,
      remainingTokens: remaining,
      isConforming: missing === 0 && remaining === 0 && missingTransitions.length === 0,
      missingTransitions,
    };
  }

  public checkLogConformance(log: Ocel2Log): Record<string, ReplayResult> {
    const objectEventsMap: Record<string, Ocel2Event[]> = {};
    for (const event of log.events) {
      for (const objId of event.objects) {
        if (!objectEventsMap[objId]) {
          objectEventsMap[objId] = [];
        }
        objectEventsMap[objId].push(event);
      }
    }

    const results: Record<string, ReplayResult> = {};
    for (const objId of Object.keys(objectEventsMap)) {
      const objectEvents = objectEventsMap[objId];
      const eventsWithIndex = objectEvents.map((evt, idx) => ({ evt, idx }));
      eventsWithIndex.sort((a, b) => {
        const timeA = new Date(a.evt.time).getTime();
        const timeB = new Date(b.evt.time).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.idx - b.idx;
      });
      const sortedEvents = eventsWithIndex.map((x) => x.evt);
      const trace = sortedEvents.map((e) => e.type);

      let finalPlace = 'p_completed';
      if (trace.includes('t_verify_fail')) {
        finalPlace = 'p_denied';
      }
      results[objId] = this.replayTrace(trace, finalPlace);
    }
    return results;
  }
}

// 3. Fuzzer for OCEL 2.0 logs
export class OcelFuzzer {
  public static generateConformingTrace(
    requestId: string,
    outcome: 'success' | 'denied' | 'skipped_zkp',
    baseTime: number
  ): Ocel2Event[] {
    const events: Ocel2Event[] = [];
    let timeOffset = 0;
    const addEvent = (type: string) => {
      events.push({
        id: `e-${requestId}-${type}`,
        type,
        time: new Date(baseTime + timeOffset).toISOString(),
        objects: [requestId],
      });
      timeOffset += 10;
    };

    addEvent('t_receive');
    if (outcome === 'success') {
      addEvent('t_verify_pass');
      addEvent('t_execute');
      addEvent('t_complete');
    } else if (outcome === 'denied') {
      addEvent('t_verify_fail');
    } else {
      addEvent('t_skip_zkp');
      addEvent('t_execute');
      addEvent('t_complete');
    }
    return events;
  }

  public static injectDeviation(
    trace: Ocel2Event[],
    deviationType: 'skip_step' | 'swap_order' | 'duplicate_step' | 'invalid_step'
  ): Ocel2Event[] {
    const fuzzed = [...trace];
    if (fuzzed.length === 0) return fuzzed;

    switch (deviationType) {
      case 'skip_step':
        if (fuzzed.length > 2) {
          const indexToRemove = 1 + Math.floor(Math.random() * (fuzzed.length - 2));
          fuzzed.splice(indexToRemove, 1);
        }
        break;
      case 'swap_order':
        if (fuzzed.length >= 2) {
          const idx = Math.floor(Math.random() * (fuzzed.length - 1));
          const temp = fuzzed[idx];
          fuzzed[idx] = { ...fuzzed[idx + 1], time: temp.time };
          fuzzed[idx + 1] = { ...temp, time: fuzzed[idx + 1].time };
        }
        break;
      case 'duplicate_step': {
        const indexToDuplicate = Math.floor(Math.random() * fuzzed.length);
        const sourceEvent = fuzzed[indexToDuplicate];
        const dup = {
          ...sourceEvent,
          id: `${sourceEvent.id}-dup`,
          time: new Date(new Date(sourceEvent.time).getTime() + 1).toISOString(),
        };
        fuzzed.splice(indexToDuplicate + 1, 0, dup);
        break;
      }
      case 'invalid_step': {
        const insertIndex = Math.floor(Math.random() * fuzzed.length);
        fuzzed.splice(insertIndex, 0, {
          id: `e-invalid-${Math.random()}`,
          type: 't_unauthorized_bypass',
          time: new Date(new Date(fuzzed[insertIndex].time).getTime() - 1).toISOString(),
          objects: fuzzed[insertIndex].objects,
        });
        break;
      }
    }
    return fuzzed;
  }
}

// 4. Performance benchmark runner
export interface BenchmarkReport {
  totalEvents: number;
  totalObjects: number;
  totalTimeMs: number;
  latencyPerEventMs: number;
  conformanceRate: number;
}

export function runBenchmark(eventCount: number = 10000): BenchmarkReport {
  // Setup conforming events representing agent operations
  const ocelLog: Ocel2Log = {
    eventTypes: {
      t_receive: { parameters: {} },
      t_verify_pass: { parameters: {} },
      t_verify_fail: { parameters: {} },
      t_skip_zkp: { parameters: {} },
      t_execute: { parameters: {} },
      t_complete: { parameters: {} },
    },
    objectTypes: {
      AgentRequest: { attributes: {} },
    },
    events: [],
    objects: [],
  };

  const baseTime = Date.now();
  let objectsGenerated = 0;
  let accumulatedEvents = 0;

  // We want to generate ~eventCount events in total
  // An average trace has 4 events (receive, verify_pass, execute, complete)
  while (accumulatedEvents < eventCount) {
    const objId = `req-${objectsGenerated++}`;
    ocelLog.objects.push({ id: objId, type: 'AgentRequest' });

    // Mix the trace types
    const rand = Math.random();
    const outcome = rand < 0.7 ? 'success' : rand < 0.9 ? 'skipped_zkp' : 'denied';
    const traceEvents = OcelFuzzer.generateConformingTrace(
      objId,
      outcome,
      baseTime + objectsGenerated * 100
    );

    ocelLog.events.push(...traceEvents);
    accumulatedEvents += traceEvents.length;
  }

  // Pre-instantiate ConformanceChecker
  const checker = new ConformanceChecker(AgentNativePetriNet);

  // Measure conformance checking execution time
  const start = performance.now();
  const results = checker.checkLogConformance(ocelLog);
  const end = performance.now();

  const totalTimeMs = end - start;
  const totalEvents = ocelLog.events.length;
  const latencyPerEventMs = totalTimeMs / totalEvents;

  // Calculate statistics
  let conformingCount = 0;
  for (const objId of Object.keys(results)) {
    if (results[objId].isConforming) {
      conformingCount++;
    }
  }
  const conformanceRate = conformingCount / Object.keys(results).length;

  console.log(
    `[Process Mining Profiler] Replayed ${totalEvents} events across ${ocelLog.objects.length} objects.`
  );
  console.log(`[Process Mining Profiler] Total Time: ${totalTimeMs.toFixed(3)} ms`);
  console.log(`[Process Mining Profiler] Latency per Event: ${latencyPerEventMs.toFixed(6)} ms`);
  console.log(`[Process Mining Profiler] Conformance rate: ${(conformanceRate * 100).toFixed(2)}%`);
  console.log(
    `[Process Mining Profiler] For design docs and implementation details, refer to [profiler.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/profiler.ts)`
  );

  // Assertion: latency per event must be under 5ms
  if (latencyPerEventMs >= 5.0) {
    throw new Error(
      `Performance Regression: Conformance checking latency is ${latencyPerEventMs.toFixed(4)} ms/event, which exceeds the limit of 5.0 ms/event. ` +
        `Check implementation in [profiler.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/profiler.ts)`
    );
  }

  return {
    totalEvents,
    totalObjects: ocelLog.objects.length,
    totalTimeMs,
    latencyPerEventMs,
    conformanceRate,
  };
}
