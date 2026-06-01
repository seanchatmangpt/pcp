/**
 * Sliding-window concept drift detection on the event stream using Jaccard distance and EWMA.
 * Conforms to the "Dr. Wil van der Aalst AGI" process mining doctrine for the Pcp Agent.
 *
 * For architectural details, refer to:
 * - Implementation Plan: [drift_detector_implementation_plan.md](file:///Users/sac/.gemini/antigravity-cli/brain/bc47b56b-8374-43ff-9417-73010490fc44/drift_detector_implementation_plan.md)
 * - Source File: [drift-detector.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/drift-detector.ts)
 */
import { computeOptimalAlignment } from './conformance';

// ----------------------------------------------------
// 1. OCEL 2.0 Compliant JSON Formats
// ----------------------------------------------------

export interface OCEL2Event {
  'ocel:activity': string;
  'ocel:timestamp': string; // ISO 8601 string
  'ocel:omap': string[]; // Related Object IDs
  'ocel:vmap': Record<string, any>; // Event attributes (e.g., duration, resource, error)
}

export interface OCEL2Object {
  'ocel:type': string; // Object Type
  'ocel:ovmap': Record<string, any>; // Object Attributes
}

export interface OCEL2Log {
  'ocel:events': Record<string, OCEL2Event>;
  'ocel:objects': Record<string, OCEL2Object>;
  'ocel:global-log'?: Record<string, any>;
}

// ----------------------------------------------------
// 2. Petri Net Formats & Lifecycle Schemas
// ----------------------------------------------------

export interface PetriNetPlace {
  id: string;
  label?: string;
}

export interface PetriNetTransition {
  id: string;
  label?: string;
}

export interface PetriNetArc {
  source: string; // Place ID or Transition ID
  target: string; // Place ID or Transition ID
  weight?: number; // default 1
}

export interface PetriNet {
  places: PetriNetPlace[];
  transitions: PetriNetTransition[];
  arcs: PetriNetArc[];
}

export type Marking = Record<string, number>; // placeId -> token count

/**
 * Creates the default Petri Net transition schema representing the formal
 * Agent-First Native Operation lifecycle.
 *
 * Designed in compliance with the process mining doctrine detailed in
 * [drift_detector_implementation_plan.md](file:///Users/sac/.gemini/antigravity-cli/brain/bc47b56b-8374-43ff-9417-73010490fc44/drift_detector_implementation_plan.md).
 */
export function createAgentNativePetriNet(): PetriNet {
  return {
    places: [
      { id: 'p_start', label: 'Start Place' },
      { id: 'p_idle', label: 'Idle State' },
      { id: 'p_authenticating', label: 'Authenticating State' },
      { id: 'p_authenticated', label: 'Authenticated State' },
      { id: 'p_executing', label: 'Executing State' },
      { id: 'p_quarantined', label: 'Quarantined State' },
      { id: 'p_receipted', label: 'Receipted State' },
      { id: 'p_done', label: 'Done Sink Place' },
    ],
    transitions: [
      { id: 't_register', label: 'Register Agent' },
      { id: 't_authenticate', label: 'Request Authentication' },
      { id: 't_auth_success', label: 'Auth Success' },
      { id: 't_auth_fail', label: 'Auth Fail' },
      { id: 't_inspect', label: 'Inspect State' },
      { id: 't_dispatch', label: 'Dispatch Command' },
      { id: 't_execute_success', label: 'Execute Success' },
      { id: 't_execute_fail', label: 'Execute Fail' },
      { id: 't_release', label: 'Release Quarantine' },
      { id: 't_close', label: 'Close Operation' },
      { id: 't_teardown', label: 'Teardown Session' },
    ],
    arcs: [
      { source: 'p_start', target: 't_register' },
      { source: 't_register', target: 'p_idle' },

      { source: 'p_idle', target: 't_authenticate' },
      { source: 't_authenticate', target: 'p_authenticating' },

      { source: 'p_authenticating', target: 't_auth_success' },
      { source: 't_auth_success', target: 'p_authenticated' },

      { source: 'p_authenticating', target: 't_auth_fail' },
      { source: 't_auth_fail', target: 'p_quarantined' },

      { source: 'p_authenticated', target: 't_inspect' },
      { source: 't_inspect', target: 'p_receipted' },

      { source: 'p_authenticated', target: 't_dispatch' },
      { source: 't_dispatch', target: 'p_executing' },

      { source: 'p_executing', target: 't_execute_success' },
      { source: 't_execute_success', target: 'p_receipted' },

      { source: 'p_executing', target: 't_execute_fail' },
      { source: 't_execute_fail', target: 'p_quarantined' },

      { source: 'p_quarantined', target: 't_release' },
      { source: 't_release', target: 'p_idle' },

      { source: 'p_receipted', target: 't_close' },
      { source: 't_close', target: 'p_idle' },

      { source: 'p_idle', target: 't_teardown' },
      { source: 't_teardown', target: 'p_done' },
    ],
  };
}

export const DEFAULT_ACTIVITY_TO_TRANSITION_MAP: Record<string, string> = {
  register: 't_register',
  authenticate: 't_authenticate',
  auth_success: 't_auth_success',
  auth_fail: 't_auth_fail',
  inspect: 't_inspect',
  dispatch: 't_dispatch',
  execute_success: 't_execute_success',
  execute_fail: 't_execute_fail',
  release: 't_release',
  close: 't_close',
  teardown: 't_teardown',
};

// ----------------------------------------------------
// 3. Token-Game Replay Conformance Checker
// ----------------------------------------------------

export interface ReplayResult {
  fitness: number;
  produced: number;
  consumed: number;
  missing: number;
  remaining: number;
  isConforming: boolean;
  firedTransitions: string[];
  missingTokensDetail: Record<string, number>;
  remainingTokensDetail: Record<string, number>;
}

export class TokenReplayChecker {
  private net: PetriNet;
  private activityMap: Record<string, string>;
  private placeMap: Map<string, PetriNetPlace>;
  private transitionMap: Map<string, PetriNetTransition>;
  private inputArcs: Map<string, PetriNetArc[]>; // transitionId -> input arcs
  private outputArcs: Map<string, PetriNetArc[]>; // transitionId -> output arcs
  private sourcePlaces: string[];
  private sinkPlaces: string[];

  constructor(
    net: PetriNet,
    activityMap: Record<string, string> = DEFAULT_ACTIVITY_TO_TRANSITION_MAP
  ) {
    this.net = net;
    this.activityMap = activityMap;
    this.placeMap = new Map(net.places.map((p) => [p.id, p]));
    this.transitionMap = new Map(net.transitions.map((t) => [t.id, t]));
    this.inputArcs = new Map();
    this.outputArcs = new Map();

    for (const arc of net.arcs) {
      if (this.transitionMap.has(arc.target)) {
        if (!this.inputArcs.has(arc.target)) {
          this.inputArcs.set(arc.target, []);
        }
        this.inputArcs.get(arc.target)!.push(arc);
      }
      if (this.transitionMap.has(arc.source)) {
        if (!this.outputArcs.has(arc.source)) {
          this.outputArcs.set(arc.source, []);
        }
        this.outputArcs.get(arc.source)!.push(arc);
      }
    }

    const placeIncoming = new Set<string>();
    const placeOutgoing = new Set<string>();
    for (const arc of net.arcs) {
      if (this.placeMap.has(arc.target)) {
        placeIncoming.add(arc.target);
      }
      if (this.placeMap.has(arc.source)) {
        placeOutgoing.add(arc.source);
      }
    }

    this.sourcePlaces = net.places.filter((p) => !placeIncoming.has(p.id)).map((p) => p.id);
    this.sinkPlaces = net.places.filter((p) => !placeOutgoing.has(p.id)).map((p) => p.id);
  }

  /**
   * Replays a list of activity names representing a trace.
   * Leverages the token-game replay algorithm to check conformance fitness.
   */
  public replayTrace(activities: string[]): ReplayResult {
    const marking: Marking = {};

    let produced = 0;
    for (const src of this.sourcePlaces) {
      marking[src] = (marking[src] || 0) + 1;
      produced++;
    }

    let consumed = 0;
    let missing = 0;
    const missingTokensDetail: Record<string, number> = {};
    const firedTransitions: string[] = [];

    for (const activity of activities) {
      const transitionId = this.activityMap[activity];
      if (!transitionId) {
        missing++;
        consumed++;
        continue;
      }

      firedTransitions.push(transitionId);

      const inputs = this.inputArcs.get(transitionId) || [];
      for (const arc of inputs) {
        const placeId = arc.source;
        const weight = arc.weight || 1;
        const currentTokens = marking[placeId] || 0;

        if (currentTokens < weight) {
          const needed = weight - currentTokens;
          missing += needed;
          missingTokensDetail[placeId] = (missingTokensDetail[placeId] || 0) + needed;
          marking[placeId] = weight;
        }

        marking[placeId] -= weight;
        consumed += weight;
      }

      const outputs = this.outputArcs.get(transitionId) || [];
      for (const arc of outputs) {
        const placeId = arc.target;
        const weight = arc.weight || 1;
        marking[placeId] = (marking[placeId] || 0) + weight;
        produced += weight;
      }
    }

    for (const sink of this.sinkPlaces) {
      const currentTokens = marking[sink] || 0;
      if (currentTokens < 1) {
        const needed = 1 - currentTokens;
        missing += needed;
        missingTokensDetail[sink] = (missingTokensDetail[sink] || 0) + needed;
        marking[sink] = 1;
      }
      marking[sink] -= 1;
      consumed += 1;
    }

    const remainingTokensDetail: Record<string, number> = {};
    let remaining = 0;
    for (const placeId of Object.keys(marking)) {
      const count = marking[placeId] || 0;
      if (count > 0) {
        remaining += count;
        remainingTokensDetail[placeId] = count;
      }
    }

    // Ensure all conformance metrics use genuine mathematical alignments (A*)
    const alignmentInitialMarking: Record<string, number> = {};
    for (const src of this.sourcePlaces) {
      alignmentInitialMarking[src] = 1;
    }
    const mappedTrace = activities.map((act) => this.activityMap[act] || act);
    const alignment = computeOptimalAlignment(
      this.net as any,
      mappedTrace,
      alignmentInitialMarking,
      this.sinkPlaces
    );
    const fitness = alignment.fitness;
    const isConforming = alignment.isConforming;

    return {
      fitness: Math.max(0, Math.min(1, fitness)),
      produced,
      consumed,
      missing,
      remaining,
      isConforming,
      firedTransitions,
      missingTokensDetail,
      remainingTokensDetail,
    };
  }

  /**
   * Replays traces from an OCEL 2.0 log for a specific object type.
   * Maps events associated with each object ID, sorts them, and runs replay.
   */
  public replayOCELTraces(log: OCEL2Log, objectType: string): Map<string, ReplayResult> {
    const results = new Map<string, ReplayResult>();
    const objectIds = Object.keys(log['ocel:objects']).filter(
      (id) => log['ocel:objects'][id]['ocel:type'] === objectType
    );

    for (const objId of objectIds) {
      const events = Object.values(log['ocel:events']).filter(
        (e) => e['ocel:omap'] && e['ocel:omap'].includes(objId)
      );

      const sortedEvents = events.sort((a, b) => {
        const timeDiff =
          new Date(a['ocel:timestamp']).getTime() - new Date(b['ocel:timestamp']).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a['ocel:activity'].localeCompare(b['ocel:activity']);
      });

      const activities = sortedEvents.map((e) => e['ocel:activity']);
      const replay = this.replayTrace(activities);
      results.set(objId, replay);
    }

    return results;
  }
}

// ----------------------------------------------------
// 4. Running Statistics (Welford's Algorithm)
// ----------------------------------------------------

export class RunningStats {
  private count = 0;
  private mean = 0;
  private dsquared = 0;

  public update(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.dsquared += delta * delta2;
  }

  public getMean(): number {
    return this.mean;
  }

  public getVariance(): number {
    return this.count > 1 ? this.dsquared / (this.count - 1) : 0;
  }

  public getStdDev(): number {
    return Math.sqrt(this.getVariance());
  }

  public getCount(): number {
    return this.count;
  }
}

// ----------------------------------------------------
// 5. Concept Drift Detector with EWMA
// ----------------------------------------------------

export interface DriftAlert {
  timestamp: string;
  driftType: 'behavioral' | 'performance' | 'conformance';
  metricValue: number;
  ewmaValue: number;
  thresholdValue: number;
  message: string;
}

export interface ConceptDriftDetectorConfig {
  windowSize?: number;
  lambda?: number;
  k?: number;
  minEventsForDetection?: number;
  staticBehaviorThreshold?: number;
  staticPerformanceThreshold?: number;
  staticConformanceThreshold?: number;
  petriNet?: PetriNet;
  activityMap?: Record<string, string>;
}

export class ConceptDriftDetector {
  private config: Required<ConceptDriftDetectorConfig>;
  private window: OCEL2Event[] = [];

  private ewmaBehavior = 0;
  private ewmaPerformance = 0;
  private ewmaConformance = 0;

  private statsBehavior = new RunningStats();
  private statsPerformance = new RunningStats();
  private statsConformance = new RunningStats();

  private replayChecker: TokenReplayChecker;
  private updateCount = 0;

  constructor(config: ConceptDriftDetectorConfig = {}) {
    const net = config.petriNet || createAgentNativePetriNet();
    const map = config.activityMap || DEFAULT_ACTIVITY_TO_TRANSITION_MAP;
    this.config = {
      windowSize: config.windowSize ?? 50,
      lambda: config.lambda ?? 0.2,
      k: config.k ?? 3.0,
      minEventsForDetection: config.minEventsForDetection ?? 20,
      staticBehaviorThreshold: config.staticBehaviorThreshold ?? -1,
      staticPerformanceThreshold: config.staticPerformanceThreshold ?? -1,
      staticConformanceThreshold: config.staticConformanceThreshold ?? -1,
      petriNet: net,
      activityMap: map,
    };
    this.replayChecker = new TokenReplayChecker(net, map);
  }

  /**
   * Ingests an event from the stream and slides the window.
   * Returns any detected drift alerts.
   */
  public addEvent(event: OCEL2Event): DriftAlert[] {
    this.window.push(event);
    if (this.window.length > this.config.windowSize) {
      this.window.shift();
    }

    if (this.window.length < this.config.minEventsForDetection) {
      return [];
    }

    const splitIndex = Math.floor(this.window.length / 2);
    const wRef = this.window.slice(0, splitIndex);
    const wDet = this.window.slice(splitIndex);

    const jaccard = this.computeBehavioralShift(wRef, wDet);
    const perfDelta = this.computePerformanceShift(wRef, wDet);
    const conformanceDelta = this.computeConformanceShift(wRef, wDet);

    this.updateCount++;

    this.statsBehavior.update(jaccard);
    this.statsPerformance.update(perfDelta);
    this.statsConformance.update(conformanceDelta);

    if (this.updateCount === 1) {
      this.ewmaBehavior = jaccard;
      this.ewmaPerformance = perfDelta;
      this.ewmaConformance = conformanceDelta;
    } else {
      const lam = this.config.lambda;
      this.ewmaBehavior = lam * jaccard + (1 - lam) * this.ewmaBehavior;
      this.ewmaPerformance = lam * perfDelta + (1 - lam) * this.ewmaPerformance;
      this.ewmaConformance = lam * conformanceDelta + (1 - lam) * this.ewmaConformance;
    }

    const alerts: DriftAlert[] = [];
    const timestamp = event['ocel:timestamp'];

    const uclBehavior = this.computeUCL(this.statsBehavior);
    const threshBehavior =
      this.config.staticBehaviorThreshold >= 0 ? this.config.staticBehaviorThreshold : uclBehavior;

    if (this.ewmaBehavior > threshBehavior) {
      alerts.push({
        timestamp,
        driftType: 'behavioral',
        metricValue: jaccard,
        ewmaValue: this.ewmaBehavior,
        thresholdValue: threshBehavior,
        message: `Behavioral concept drift detected: Jaccard distance EWMA (${this.ewmaBehavior.toFixed(4)}) exceeds threshold (${threshBehavior.toFixed(4)}). [drift-detector.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/drift-detector.ts)`,
      });
    }

    const uclPerf = this.computeUCL(this.statsPerformance);
    const threshPerf =
      this.config.staticPerformanceThreshold >= 0
        ? this.config.staticPerformanceThreshold
        : uclPerf;

    if (this.ewmaPerformance > threshPerf) {
      alerts.push({
        timestamp,
        driftType: 'performance',
        metricValue: perfDelta,
        ewmaValue: this.ewmaPerformance,
        thresholdValue: threshPerf,
        message: `Performance degradation detected: Duration delta EWMA (${this.ewmaPerformance.toFixed(2)}ms) exceeds threshold (${threshPerf.toFixed(2)}ms). [drift-detector.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/drift-detector.ts)`,
      });
    }

    const uclConformance = this.computeUCL(this.statsConformance);
    const threshConformance =
      this.config.staticConformanceThreshold >= 0
        ? this.config.staticConformanceThreshold
        : uclConformance;

    if (this.ewmaConformance > threshConformance) {
      alerts.push({
        timestamp,
        driftType: 'conformance',
        metricValue: conformanceDelta,
        ewmaValue: this.ewmaConformance,
        thresholdValue: threshConformance,
        message: `Conformance deviation detected: Fitness drop EWMA (${this.ewmaConformance.toFixed(4)}) exceeds threshold (${threshConformance.toFixed(4)}). [drift-detector.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/drift-detector.ts)`,
      });
    }

    return alerts;
  }

  public getSlidingWindow(): OCEL2Event[] {
    return [...this.window];
  }

  public getEwmaValues(): { behavior: number; performance: number; conformance: number } {
    return {
      behavior: this.ewmaBehavior,
      performance: this.ewmaPerformance,
      conformance: this.ewmaConformance,
    };
  }

  public getRunningStats(): {
    behavior: RunningStats;
    performance: RunningStats;
    conformance: RunningStats;
  } {
    return {
      behavior: this.statsBehavior,
      performance: this.statsPerformance,
      conformance: this.statsConformance,
    };
  }

  private computeUCL(stats: RunningStats): number {
    const lam = this.config.lambda;
    const correction = 1 - Math.pow(1 - lam, 2 * this.updateCount);
    const factor = Math.sqrt((lam / (2 - lam)) * correction);
    return stats.getMean() + this.config.k * stats.getStdDev() * factor;
  }

  private computeBehavioralShift(wRef: OCEL2Event[], wDet: OCEL2Event[]): number {
    const objectEvents: Record<string, OCEL2Event[]> = {};
    for (const e of this.window) {
      const omap = e['ocel:omap'] || [];
      for (const objId of omap) {
        if (!objectEvents[objId]) {
          objectEvents[objId] = [];
        }
        objectEvents[objId].push(e);
      }
    }

    const objectIds = Object.keys(objectEvents).sort((a, b) => {
      const minA = Math.min(...objectEvents[a].map((e) => new Date(e['ocel:timestamp']).getTime()));
      const minB = Math.min(...objectEvents[b].map((e) => new Date(e['ocel:timestamp']).getTime()));
      return minA - minB;
    });

    if (objectIds.length < 2) {
      const dfRef = this.extractDFRs(wRef);
      const dfDet = this.extractDFRs(wDet);
      if (dfRef.size === 0 && dfDet.size === 0) {
        return 0;
      }
      const intersection = new Set<string>();
      for (const edge of dfRef) {
        if (dfDet.has(edge)) {
          intersection.add(edge);
        }
      }
      const unionSize = dfRef.size + dfDet.size - intersection.size;
      if (unionSize === 0) return 0;
      return 1 - intersection.size / unionSize;
    }

    const split = Math.floor(objectIds.length / 2);
    const refIds = objectIds.slice(0, split);
    const detIds = objectIds.slice(split);

    const getDFRs = (ids: string[]) => {
      const dfrs = new Set<string>();
      for (const id of ids) {
        const events = objectEvents[id].sort((a, b) => {
          const timeDiff =
            new Date(a['ocel:timestamp']).getTime() - new Date(b['ocel:timestamp']).getTime();
          if (timeDiff !== 0) return timeDiff;
          return a['ocel:activity'].localeCompare(b['ocel:activity']);
        });
        for (let i = 0; i < events.length - 1; i++) {
          dfrs.add(`${events[i]['ocel:activity']}->${events[i + 1]['ocel:activity']}`);
        }
      }
      return dfrs;
    };

    const dfRef = getDFRs(refIds);
    const dfDet = getDFRs(detIds);

    if (dfRef.size === 0 && dfDet.size === 0) {
      return 0;
    }

    const intersection = new Set<string>();
    for (const edge of dfRef) {
      if (dfDet.has(edge)) {
        intersection.add(edge);
      }
    }

    const unionSize = dfRef.size + dfDet.size - intersection.size;
    if (unionSize === 0) return 0;

    return 1 - intersection.size / unionSize;
  }

  private extractDFRs(events: OCEL2Event[]): Set<string> {
    const objectTraces: Record<string, OCEL2Event[]> = {};
    for (const e of events) {
      const omap = e['ocel:omap'] || [];
      for (const objId of omap) {
        if (!objectTraces[objId]) {
          objectTraces[objId] = [];
        }
        objectTraces[objId].push(e);
      }
    }

    const dfrs = new Set<string>();
    for (const objId of Object.keys(objectTraces)) {
      const trace = objectTraces[objId].sort((a, b) => {
        const timeDiff =
          new Date(a['ocel:timestamp']).getTime() - new Date(b['ocel:timestamp']).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a['ocel:activity'].localeCompare(b['ocel:activity']);
      });

      for (let i = 0; i < trace.length - 1; i++) {
        dfrs.add(`${trace[i]['ocel:activity']}->${trace[i + 1]['ocel:activity']}`);
      }
    }
    return dfrs;
  }

  private computePerformanceShift(wRef: OCEL2Event[], wDet: OCEL2Event[]): number {
    const objectEvents: Record<string, OCEL2Event[]> = {};
    for (const e of this.window) {
      const omap = e['ocel:omap'] || [];
      for (const objId of omap) {
        if (!objectEvents[objId]) {
          objectEvents[objId] = [];
        }
        objectEvents[objId].push(e);
      }
    }

    const objectIds = Object.keys(objectEvents).sort((a, b) => {
      const minA = Math.min(...objectEvents[a].map((e) => new Date(e['ocel:timestamp']).getTime()));
      const minB = Math.min(...objectEvents[b].map((e) => new Date(e['ocel:timestamp']).getTime()));
      return minA - minB;
    });

    if (objectIds.length < 2) {
      const avgRef = this.computeAverageDuration(wRef);
      const avgDet = this.computeAverageDuration(wDet);
      return Math.max(0, avgDet - avgRef);
    }

    const split = Math.floor(objectIds.length / 2);
    const refIds = new Set(objectIds.slice(0, split));
    const detIds = new Set(objectIds.slice(split));

    let refSum = 0;
    let refCount = 0;
    let detSum = 0;
    let detCount = 0;

    for (const e of this.window) {
      const duration = e['ocel:vmap']?.duration;
      if (typeof duration !== 'number') continue;

      const omap = e['ocel:omap'] || [];
      let isRef = false;
      let isDet = false;
      for (const objId of omap) {
        if (refIds.has(objId)) isRef = true;
        if (detIds.has(objId)) isDet = true;
      }

      if (isRef) {
        refSum += duration;
        refCount++;
      } else if (isDet) {
        detSum += duration;
        detCount++;
      }
    }

    const avgRef = refCount > 0 ? refSum / refCount : 0;
    const avgDet = detCount > 0 ? detSum / detCount : 0;

    return Math.max(0, avgDet - avgRef);
  }

  private computeAverageDuration(events: OCEL2Event[]): number {
    let sum = 0;
    let count = 0;
    for (const e of events) {
      const duration = e['ocel:vmap']?.duration;
      if (typeof duration === 'number') {
        sum += duration;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  private computeConformanceShift(wRef: OCEL2Event[], wDet: OCEL2Event[]): number {
    const objectEvents: Record<string, OCEL2Event[]> = {};
    for (const e of this.window) {
      const omap = e['ocel:omap'] || [];
      for (const objId of omap) {
        if (!objectEvents[objId]) {
          objectEvents[objId] = [];
        }
        objectEvents[objId].push(e);
      }
    }

    const objectIds = Object.keys(objectEvents).sort((a, b) => {
      const minA = Math.min(...objectEvents[a].map((e) => new Date(e['ocel:timestamp']).getTime()));
      const minB = Math.min(...objectEvents[b].map((e) => new Date(e['ocel:timestamp']).getTime()));
      return minA - minB;
    });

    if (objectIds.length < 2) {
      const fitnessRef = this.computeAverageFitness(wRef);
      const fitnessDet = this.computeAverageFitness(wDet);
      return Math.max(0, fitnessRef - fitnessDet);
    }

    const split = Math.floor(objectIds.length / 2);
    const refIds = objectIds.slice(0, split);
    const detIds = objectIds.slice(split);

    const computeAvgFitness = (ids: string[]) => {
      let sum = 0;
      let count = 0;
      for (const id of ids) {
        const events = objectEvents[id].sort((a, b) => {
          const timeDiff =
            new Date(a['ocel:timestamp']).getTime() - new Date(b['ocel:timestamp']).getTime();
          if (timeDiff !== 0) return timeDiff;
          return a['ocel:activity'].localeCompare(b['ocel:activity']);
        });
        const activities = events.map((e) => e['ocel:activity']);
        const replay = this.replayChecker.replayTrace(activities);
        sum += replay.fitness;
        count++;
      }
      return count > 0 ? sum / count : 1.0;
    };

    const fitnessRef = computeAvgFitness(refIds);
    const fitnessDet = computeAvgFitness(detIds);

    return Math.max(0, fitnessRef - fitnessDet);
  }

  private computeAverageFitness(events: OCEL2Event[]): number {
    const objectTraces: Record<string, string[]> = {};
    for (const e of events) {
      const omap = e['ocel:omap'] || [];
      for (const objId of omap) {
        if (!objectTraces[objId]) {
          objectTraces[objId] = [];
        }
        objectTraces[objId].push(e['ocel:activity']);
      }
    }

    let sum = 0;
    let count = 0;
    for (const objId of Object.keys(objectTraces)) {
      const replay = this.replayChecker.replayTrace(objectTraces[objId]);
      sum += replay.fitness;
      count++;
    }

    return count > 0 ? sum / count : 1.0;
  }
}
