import { OcelLog, OcelEvent, OcelObject } from '@/src/lib/truex/evidence/ocel';

/**
 * Definition of a Petri Net structure for process mining conformance checking.
 * For theoretical context on token-game replay, see [adversarial-fuzzer.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/adversarial-fuzzer.ts).
 */
export interface PetriNet {
  places: string[];
  transitions: PetriNetTransition[];
}

export interface PetriNetTransition {
  id: string;
  label: string;
  inputs: string[];
  outputs: string[];
}

/**
 * The formal Petri Net schema modeling Pcp Agent Native Interface operations.
 * It governs both State Inspection and Command Dispatch paths.
 * Refer to [interface.ts](file:///Users/sac/pcpapp/src/framework/2030/agent-native/interface.ts) for execution context.
 */
export const AGENT_PETRI_NET: PetriNet = {
  places: [
    'p_start',
    'p_queued',
    'p_zkp_pending',
    'p_zkp_verified',
    'p_membrane_pending',
    'p_membrane_approved',
    'p_executing',
    'p_completed',
    'p_aborted',
  ],
  transitions: [
    { id: 't_receive', label: 'Receive Request', inputs: ['p_start'], outputs: ['p_queued'] },
    { id: 't_enqueue', label: 'Enqueue Request', inputs: ['p_queued'], outputs: ['p_zkp_pending'] },
    {
      id: 't_verify_zkp_success',
      label: 'ZKP Verification Success',
      inputs: ['p_zkp_pending'],
      outputs: ['p_zkp_verified'],
    },
    {
      id: 't_verify_zkp_fail',
      label: 'ZKP Verification Fail',
      inputs: ['p_zkp_pending'],
      outputs: ['p_aborted'],
    },
    {
      id: 't_skip_zkp',
      label: 'ZKP Verification Skipped',
      inputs: ['p_zkp_pending'],
      outputs: ['p_zkp_verified'],
    },
    {
      id: 't_skip_membrane',
      label: 'Skip Membrane Check',
      inputs: ['p_zkp_verified'],
      outputs: ['p_executing'],
    },
    {
      id: 't_membrane_request',
      label: 'Membrane Check Request',
      inputs: ['p_zkp_verified'],
      outputs: ['p_membrane_pending'],
    },
    {
      id: 't_membrane_pass',
      label: 'Membrane Check Pass',
      inputs: ['p_membrane_pending'],
      outputs: ['p_membrane_approved'],
    },
    {
      id: 't_membrane_fail',
      label: 'Membrane Check Fail',
      inputs: ['p_membrane_pending'],
      outputs: ['p_aborted'],
    },
    {
      id: 't_execute',
      label: 'Execute Action',
      inputs: ['p_membrane_approved'],
      outputs: ['p_executing'],
    },
    {
      id: 't_complete',
      label: 'Complete Execution',
      inputs: ['p_executing'],
      outputs: ['p_completed'],
    },
  ],
};

export interface Deviation {
  type: 'MISSING_TOKEN' | 'REMAINING_TOKEN' | 'UNEXPECTED_TRANSITION' | 'INCOMPLETE_LEFTOVER';
  transitionId?: string;
  placeId?: string;
  message: string;
}

export interface CaseConformanceResult {
  caseId: string;
  scenario: string;
  trace: string[];
  fitness: number;
  isConforming: boolean;
  missingTokens: number;
  remainingTokens: number;
  consumedTokens: number;
  producedTokens: number;
  deviations: Deviation[];
  finalMarking: Record<string, number>;
}

export interface ConformanceReport {
  isConforming: boolean;
  cases: Record<string, CaseConformanceResult>;
}

/**
 * Token-game replay conformance checker.
 * Evaluates traces extracted from OCEL logs against the formal Petri Net.
 * Calculates fitness according to the Aalst metric: f = 0.5 * (1 - m/c) + 0.5 * (1 - r/p).
 * See [adversarial-fuzzer.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/adversarial-fuzzer.ts) for details.
 */
export function checkConformance(
  log: OcelLog,
  petriNet: PetriNet = AGENT_PETRI_NET
): ConformanceReport {
  const traces = extractTraces(log);
  const cases: Record<string, CaseConformanceResult> = {};
  let overallConforming = true;

  for (const [caseId, traceInfo] of Object.entries(traces)) {
    const { scenario, activities } = traceInfo;
    const result = replayTrace(caseId, scenario, activities, petriNet);
    cases[caseId] = result;
    if (!result.isConforming) {
      overallConforming = false;
    }
  }

  return {
    isConforming: overallConforming,
    cases,
  };
}

/**
 * Replays a single trace on the Petri Net using the Token Game.
 */
export function replayTrace(
  caseId: string,
  scenario: string,
  trace: string[],
  petriNet: PetriNet
): CaseConformanceResult {
  const { places, transitions } = petriNet;
  const marking: Record<string, number> = {};
  for (const p of places) {
    marking[p] = 0;
  }

  // Set initial marking: 1 token in the start place
  marking['p_start'] = 1;

  let produced = 1;
  let consumed = 0;
  let missing = 0;
  const deviations: Deviation[] = [];

  for (const transitionId of trace) {
    const trans = transitions.find((t) => t.id === transitionId);
    if (!trans) {
      deviations.push({
        type: 'UNEXPECTED_TRANSITION',
        transitionId,
        message: `Encountered unexpected or forged transition: ${transitionId}. See schema definition in [adversarial-fuzzer.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/adversarial-fuzzer.ts).`,
      });
      continue;
    }

    // Check inputs
    for (const inputPlace of trans.inputs) {
      if (marking[inputPlace] < 1) {
        const needed = 1 - marking[inputPlace];
        missing += needed;
        produced += needed;
        marking[inputPlace] += needed;
        deviations.push({
          type: 'MISSING_TOKEN',
          transitionId,
          placeId: inputPlace,
          message: `Token missing in place ${inputPlace} when trying to fire transition ${transitionId}. Detected bypass or out-of-order execution. Details in [adversarial-fuzzer.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/adversarial-fuzzer.ts).`,
        });
      }
      marking[inputPlace] -= 1;
      consumed += 1;
    }

    // Produce outputs
    for (const outputPlace of trans.outputs) {
      marking[outputPlace] += 1;
      produced += 1;
    }
  }

  // End of trace check
  // Check final places: we expect exactly 1 token in either 'p_completed' or 'p_aborted'
  const finalPlaces = ['p_completed', 'p_aborted'];
  let foundFinalToken = false;
  for (const fp of finalPlaces) {
    if (marking[fp] >= 1) {
      marking[fp] -= 1;
      consumed += 1;
      foundFinalToken = true;
      break;
    }
  }

  if (!foundFinalToken) {
    missing += 1;
    produced += 1;
    consumed += 1;
    deviations.push({
      type: 'MISSING_TOKEN',
      placeId: 'p_completed',
      message: `Trace terminated without reaching a final place (p_completed or p_aborted). Detected abrupt termination. Reference [adversarial-fuzzer.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/adversarial-fuzzer.ts).`,
    });
  }

  // Remaining tokens check
  let remaining = 0;
  for (const p of places) {
    if (marking[p] > 0) {
      remaining += marking[p];
      deviations.push({
        type: 'REMAINING_TOKEN',
        placeId: p,
        message: `Token remaining in place ${p} after execution completed. Indicative of bypass, out-of-order execution, or leftover states. Reference [adversarial-fuzzer.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/adversarial-fuzzer.ts).`,
      });
    }
  }

  // Calculate fitness
  const fitness = 0.5 * (1 - missing / consumed) + 0.5 * (1 - remaining / produced);
  const isConforming = deviations.length === 0 && fitness === 1.0;

  return {
    caseId,
    scenario,
    trace,
    fitness,
    isConforming,
    missingTokens: missing,
    remainingTokens: remaining,
    consumedTokens: consumed,
    producedTokens: produced,
    deviations,
    finalMarking: { ...marking },
  };
}

/**
 * Reconstructs traces from an OCEL 2.0 log.
 * Case objects are identified by objects with type 'Command' or 'Request'.
 * Events linked to those case objects are ordered by timestamp to form the execution trace.
 * Refer to [ocel.ts](file:///Users/sac/pcpapp/src/lib/truex/evidence/ocel.ts) for log definitions.
 */
export function extractTraces(
  log: OcelLog
): Record<string, { scenario: string; activities: string[] }> {
  const caseObjects = Object.values(log.objects).filter(
    (obj) => obj.type === 'Command' || obj.type === 'Request'
  );

  const traces: Record<string, { scenario: string; activities: string[] }> = {};

  for (const caseObj of caseObjects) {
    const caseId = caseObj.id;
    const scenario = caseObj.attributes.scenario || 'unknown';

    // Find all events associated with this case object ID
    const relatedEvents = log.events.filter((evt) => evt.omap.includes(caseId));

    // Sort events by timestamp to preserve execution sequence
    relatedEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const activities = relatedEvents.map((evt) => evt.activity);

    traces[caseId] = {
      scenario,
      activities,
    };
  }

  return traces;
}

/**
 * Fuzzing scenarios definition.
 * Details the sequence of transitions generated by the simulator.
 */
export const FUZZ_SCENARIOS: Record<string, string[]> = {
  happy_path_dispatch: [
    't_receive',
    't_enqueue',
    't_verify_zkp_success',
    't_membrane_request',
    't_membrane_pass',
    't_execute',
    't_complete',
  ],
  happy_path_inspect: [
    't_receive',
    't_enqueue',
    't_verify_zkp_success',
    't_skip_membrane',
    't_complete',
  ],
  happy_path_skip_zkp: [
    't_receive',
    't_enqueue',
    't_skip_zkp',
    't_membrane_request',
    't_membrane_pass',
    't_execute',
    't_complete',
  ],
  zkp_failure: ['t_receive', 't_enqueue', 't_verify_zkp_fail'],
  membrane_failure: [
    't_receive',
    't_enqueue',
    't_verify_zkp_success',
    't_membrane_request',
    't_membrane_fail',
  ],
  bypass_attempt: ['t_receive', 't_enqueue', 't_execute', 't_complete'],
  out_of_order: ['t_receive', 't_execute', 't_enqueue', 't_verify_zkp_success', 't_complete'],
  forged_transition: ['t_receive', 't_enqueue', 't_forged_hack', 't_complete'],
  double_firing: [
    't_receive',
    't_enqueue',
    't_verify_zkp_success',
    't_membrane_request',
    't_membrane_pass',
    't_execute',
    't_execute',
    't_complete',
  ],
  abrupt_termination: ['t_receive', 't_enqueue'],
  bypass_membrane_direct_complete: ['t_receive', 't_enqueue', 't_verify_zkp_success', 't_complete'],
};

/**
 * Simulator that generates adversarial and valid OCEL 2.0 compliant log streams.
 * Simulates normal executions as well as forged, out-of-order, and bypassed transitions.
 * Evaluated in [adversarial-fuzzer.test.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/__tests__/adversarial-fuzzer.test.ts).
 */
export function generateFuzzedOcelLog(): OcelLog {
  const objects: Record<string, OcelObject> = {};
  const events: OcelEvent[] = [];

  // Register common shared objects
  objects['agent_pcp'] = {
    id: 'agent_pcp',
    type: 'Agent',
    attributes: {
      model: 'Pcp-2030-ultimate',
      capabilities: ['inspectState', 'dispatch'],
    },
  };

  objects['membrane_standard'] = {
    id: 'membrane_standard',
    type: 'Membrane',
    attributes: {
      mode: 'strict',
      enforceZkp: true,
    },
  };

  let baseTime = new Date('2030-01-01T00:00:00.000Z');
  let eventCounter = 0;

  for (const [scenario, activities] of Object.entries(FUZZ_SCENARIOS)) {
    const caseId = `case_${scenario}_${Math.random().toString(36).substring(2, 7)}`;

    // Register case object
    objects[caseId] = {
      id: caseId,
      type: 'Command',
      attributes: {
        scenario,
        action: scenario.includes('inspect') ? 'inspect' : 'update_state',
        zkp_enforced: !scenario.includes('skip_zkp'),
      },
    };

    // Generate events for this case
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      // Increment baseTime by 10ms for each event to preserve absolute order
      baseTime = new Date(baseTime.getTime() + 10);
      eventCounter++;

      events.push({
        id: `evt_${eventCounter}_${activity}_${caseId}`,
        activity,
        timestamp: baseTime.toISOString(),
        omap: [caseId, 'agent_pcp', 'membrane_standard'],
        vmap: {
          stepIndex: i,
          actor: 'agent_pcp',
          payload: {
            commandId: caseId,
            timestampMs: baseTime.getTime(),
          },
        },
      });
    }
  }

  return { objects, events };
}
