/**
 * @fileoverview OCEL 2.0 Log Generator, Parser, and Conformance Checker.
 * Under "Dr. Wil van der Aalst AGI" process mining doctrine.
 *
 * References:
 * - [Agent Native Interface Spec](file:///Users/sac/pcpapp/docs/vision2030/modules/agent-native.md)
 * - [Process Mining Module](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)
 */

import { SemanticCommand } from '../agent-native/types';
import { MembraneConfig, MembraneReceipt } from '../../membrane/types';
import { PqSignature } from '../identity/types';

// ==========================================
// 1. OCEL 2.0 Type Definitions
// ==========================================

export interface OcelObject {
  type: string;
  attributes: Record<string, any>;
}

export interface OcelEvent {
  id: string;
  activity: string;
  timestamp: string;
  omap: string[]; // Object map (related object IDs)
  vmap: Record<string, any>; // Value map (event attributes)
}

export interface OcelLog {
  objects: Record<string, OcelObject>;
  events: OcelEvent[];
}

// ==========================================
// 2. Petri Net Transition Schema (Formal)
// ==========================================

export interface PetriNetTransitionSchema {
  inputs: string[];
  outputs: string[];
}

/**
 * Formal Petri Net transitions for Agent native operations.
 * Defines normal execution paths, ZKP skips, and quarantine scenarios.
 */
export const AGENT_PETRI_NET: Record<string, PetriNetTransitionSchema> = {
  t_receive_command: {
    inputs: ['p_start'],
    outputs: ['p_command_received'],
  },
  t_verify_zkp: {
    inputs: ['p_command_received'],
    outputs: ['p_zkp_verified'],
  },
  t_skip_zkp: {
    inputs: ['p_command_received'],
    outputs: ['p_zkp_verified'],
  },
  t_enter_membrane: {
    inputs: ['p_zkp_verified'],
    outputs: ['p_membrane_entered'],
  },
  t_execute_action: {
    inputs: ['p_membrane_entered'],
    outputs: ['p_action_executed'],
  },
  t_sign_receipt: {
    inputs: ['p_action_executed'],
    outputs: ['p_end'],
  },
  t_quarantine_cmd: {
    inputs: ['p_command_received'],
    outputs: ['p_quarantined'],
  },
  t_quarantine_zkp: {
    inputs: ['p_zkp_verified'],
    outputs: ['p_quarantined'],
  },
  t_quarantine_membrane: {
    inputs: ['p_membrane_entered'],
    outputs: ['p_quarantined'],
  },
  t_sign_quarantined: {
    inputs: ['p_quarantined'],
    outputs: ['p_end'],
  },
};

// ==========================================
// 3. Agent Execution Trace Input Structure
// ==========================================

export interface AgentExecutionTrace {
  command: SemanticCommand;
  membraneId: string;
  membraneConfig: MembraneConfig;
  zkpEnforced: boolean;
  zkpVerified: boolean;
  zkpError?: string;
  executionSuccess: boolean;
  verdict: 'allow' | 'deny' | 'fork' | 'observe';
  receipt?: MembraneReceipt;
  signature?: PqSignature;
  actionResult?: any;
  error?: string;
  timestamp: string; // ISO 8601
}

// ==========================================
// 4. Log Generator (OCEL 2.0 Compliant)
// ==========================================

export function generateLog(traces: AgentExecutionTrace[]): OcelLog {
  const objects: Record<string, OcelObject> = {};
  const events: OcelEvent[] = [];

  for (const trace of traces) {
    const cmdId = trace.command.id;
    const membId = trace.membraneId;
    const recId = trace.receipt?.id || `receipt_${cmdId}`;
    const sigId = trace.signature ? `sig_${cmdId}` : undefined;

    // 1. Map Command Object
    if (!objects[cmdId]) {
      objects[cmdId] = {
        type: 'Command',
        attributes: {
          action: trace.command.action,
          params: trace.command.params,
          zkpClaimId: trace.command.zkp?.claimId || 'n/a',
          agentModel: trace.command.agentMetadata?.model || 'unknown',
          agentCapabilities: trace.command.agentMetadata?.capabilities || [],
          specLink:
            '[Agent Native Spec](file:///Users/sac/pcpapp/docs/vision2030/modules/agent-native.md)',
        },
      };
    }

    // 2. Map Membrane Object
    if (!objects[membId]) {
      objects[membId] = {
        type: 'Membrane',
        attributes: {
          mode: trace.membraneConfig.mode,
          tenantId: trace.membraneConfig.tenantId || 'default',
          enforceZkp: trace.zkpEnforced,
          specLink:
            '[Membrane Spec](file:///Users/sac/pcpapp/docs/vision2030/modules/agent-native.md)',
        },
      };
    }

    // 3. Map Receipt Object
    if (!objects[recId]) {
      objects[recId] = {
        type: 'Receipt',
        attributes: {
          verdict: trace.verdict,
          success: trace.executionSuccess,
          deltaHash: trace.receipt?.deltaHash || 'n/a',
          previousHash: trace.receipt?.previousHash || 'n/a',
          error: trace.error || trace.receipt?.error || 'none',
          specLink:
            '[Receipt Spec](file:///Users/sac/pcpapp/docs/vision2030/modules/agent-native.md)',
        },
      };
    }

    // 4. Map Signature Object
    if (sigId && !objects[sigId] && trace.signature) {
      objects[sigId] = {
        type: 'Signature',
        attributes: {
          algorithm: trace.signature.algorithm,
          publicKey: trace.signature.publicKey,
          data: trace.signature.data,
          specLink:
            '[Signature Spec](file:///Users/sac/pcpapp/docs/vision2030/modules/agent-native.md)',
        },
      };
    }

    const baseTime = new Date(trace.timestamp).getTime();

    // Event 1: CommandReceived
    events.push({
      id: `evt_recv_${cmdId}`,
      activity: 't_receive_command',
      timestamp: new Date(baseTime).toISOString(),
      omap: [cmdId, membId],
      vmap: {
        refLink:
          '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
      },
    });

    // Event 2: ZKP Verification
    const zkpActivity = trace.zkpEnforced ? 't_verify_zkp' : 't_skip_zkp';
    events.push({
      id: `evt_zkp_${cmdId}`,
      activity: zkpActivity,
      timestamp: new Date(baseTime + 1).toISOString(),
      omap: sigId ? [cmdId, sigId] : [cmdId],
      vmap: {
        verified: trace.zkpVerified,
        error: trace.zkpError || null,
        refLink:
          '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
      },
    });

    // Handle early failures (ZKP failed)
    if (trace.zkpEnforced && !trace.zkpVerified) {
      events.push({
        id: `evt_quar_${cmdId}`,
        activity: 't_quarantine_zkp',
        timestamp: new Date(baseTime + 2).toISOString(),
        omap: [cmdId],
        vmap: {
          reason: trace.zkpError || 'ZKP Verification failed',
          refLink:
            '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
        },
      });

      events.push({
        id: `evt_sign_quar_${cmdId}`,
        activity: 't_sign_quarantined',
        timestamp: new Date(baseTime + 3).toISOString(),
        omap: [cmdId, recId],
        vmap: {
          refLink:
            '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
        },
      });
      continue;
    }

    // Event 3: Membrane Admission
    events.push({
      id: `evt_memb_${cmdId}`,
      activity: 't_enter_membrane',
      timestamp: new Date(baseTime + 2).toISOString(),
      omap: [cmdId, membId],
      vmap: {
        verdict: trace.verdict,
        refLink:
          '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
      },
    });

    // Handle early failure (Membrane denied)
    if (trace.verdict === 'deny') {
      events.push({
        id: `evt_quar_${cmdId}`,
        activity: 't_quarantine_membrane',
        timestamp: new Date(baseTime + 3).toISOString(),
        omap: [cmdId, membId],
        vmap: {
          reason: 'Denied by membrane',
          refLink:
            '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
        },
      });

      events.push({
        id: `evt_sign_quar_${cmdId}`,
        activity: 't_sign_quarantined',
        timestamp: new Date(baseTime + 4).toISOString(),
        omap: [cmdId, recId],
        vmap: {
          refLink:
            '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
        },
      });
      continue;
    }

    // Event 4: Action Execution / Quarantine
    if (trace.executionSuccess) {
      events.push({
        id: `evt_exec_${cmdId}`,
        activity: 't_execute_action',
        timestamp: new Date(baseTime + 3).toISOString(),
        omap: [cmdId],
        vmap: {
          success: true,
          error: null,
          refLink:
            '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
        },
      });

      // Event 5: Receipt Signing (Normal success)
      events.push({
        id: `evt_sign_${cmdId}`,
        activity: 't_sign_receipt',
        timestamp: new Date(baseTime + 4).toISOString(),
        omap: [cmdId, recId],
        vmap: {
          refLink:
            '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
        },
      });
    } else {
      // Handle failure (Action execution threw/failed)
      events.push({
        id: `evt_quar_${cmdId}`,
        activity: 't_quarantine_membrane',
        timestamp: new Date(baseTime + 3).toISOString(),
        omap: [cmdId],
        vmap: {
          reason: trace.error || 'Execution failed',
          refLink:
            '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
        },
      });

      events.push({
        id: `evt_sign_quar_${cmdId}`,
        activity: 't_sign_quarantined',
        timestamp: new Date(baseTime + 4).toISOString(),
        omap: [cmdId, recId],
        vmap: {
          refLink:
            '[Process Mining Spec](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts)',
        },
      });
    }
  }

  return { objects, events };
}

// ==========================================
// 5. Log Parser
// ==========================================

export function parseOcelLog(log: OcelLog): AgentExecutionTrace[] {
  const traces: AgentExecutionTrace[] = [];
  const commandIds = Object.keys(log.objects).filter((id) => log.objects[id].type === 'Command');

  for (const cmdId of commandIds) {
    const cmdObj = log.objects[cmdId];
    const cmdEvents = log.events
      .filter((e) => e.omap.includes(cmdId))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (cmdEvents.length === 0) continue;

    // Find linked Membrane ID
    let membraneId = 'unknown-membrane';
    const recvEvent = cmdEvents.find((e) => e.activity === 't_receive_command');
    if (recvEvent) {
      const foundMembId = recvEvent.omap.find(
        (id) => id !== cmdId && log.objects[id]?.type === 'Membrane'
      );
      if (foundMembId) membraneId = foundMembId;
    }
    const membObj = log.objects[membraneId];

    // Find linked Receipt ID and Signature ID
    let receiptId = `receipt_${cmdId}`;
    let signatureId: string | undefined = undefined;

    for (const evt of cmdEvents) {
      const foundRecId = evt.omap.find((id) => id !== cmdId && log.objects[id]?.type === 'Receipt');
      if (foundRecId) receiptId = foundRecId;
      const foundSigId = evt.omap.find(
        (id) => id !== cmdId && log.objects[id]?.type === 'Signature'
      );
      if (foundSigId) signatureId = foundSigId;
    }

    const recObj = log.objects[receiptId];
    const sigObj = signatureId ? log.objects[signatureId] : undefined;

    // Reconstruct fields from events
    const verifyEvt = cmdEvents.find(
      (e) => e.activity === 't_verify_zkp' || e.activity === 't_skip_zkp'
    );
    const zkpEnforced = verifyEvt ? verifyEvt.activity === 't_verify_zkp' : true;
    const zkpVerified = verifyEvt ? !!verifyEvt.vmap.verified : false;
    const zkpError = verifyEvt?.vmap.error || undefined;

    const membEvt = cmdEvents.find((e) => e.activity === 't_enter_membrane');
    const verdict = membEvt ? membEvt.vmap.verdict : zkpVerified ? 'allow' : 'deny';

    const execEvt = cmdEvents.find((e) => e.activity === 't_execute_action');
    const hasQuarantine = cmdEvents.some(
      (e) => e.activity.startsWith('t_quarantine') || e.activity === 't_sign_quarantined'
    );
    const executionSuccess = execEvt
      ? !!execEvt.vmap.success
      : verdict === 'allow' && !hasQuarantine;
    const error =
      execEvt?.vmap.error ||
      cmdEvents.find((e) => e.activity === 't_quarantine_membrane')?.vmap.reason ||
      undefined;

    const timestamp = recvEvent ? recvEvent.timestamp : cmdEvents[0].timestamp;

    // Reconstruct SemanticCommand
    const command: SemanticCommand = {
      id: cmdId,
      action: cmdObj.attributes.action || 'unknown',
      params: cmdObj.attributes.params || {},
      zkp: {
        claimId: cmdObj.attributes.zkpClaimId || '',
        proofData: '',
        publicSignals: [],
        enclaveSignature: sigObj?.attributes.data || '',
      },
      agentMetadata: {
        id: 'reconstructed',
        model: cmdObj.attributes.agentModel || 'unknown',
        capabilities: cmdObj.attributes.agentCapabilities || [],
      },
    };

    // Reconstruct MembraneConfig
    const membraneConfig: MembraneConfig = {
      mode: membObj?.attributes.mode || 'strict',
      tenantId: membObj?.attributes.tenantId || 'default',
    };

    // Reconstruct MembraneReceipt
    let receipt: MembraneReceipt | undefined = undefined;
    if (recObj) {
      receipt = {
        id: receiptId,
        commandId: cmdId,
        capabilityId: `agent-action:${command.action}`,
        timestamp,
        verdict: recObj.attributes.verdict || verdict,
        success:
          recObj.attributes.success !== undefined ? recObj.attributes.success : executionSuccess,
        deltaHash: recObj.attributes.deltaHash || 'n/a',
        previousHash: recObj.attributes.previousHash || 'n/a',
        error: recObj.attributes.error !== 'none' ? recObj.attributes.error : undefined,
      };
    }

    // Reconstruct PqSignature
    let signature: PqSignature | undefined = undefined;
    if (sigObj) {
      signature = {
        algorithm: sigObj.attributes.algorithm,
        publicKey: sigObj.attributes.publicKey,
        data: sigObj.attributes.data,
      };
    }

    traces.push({
      command,
      membraneId,
      membraneConfig,
      zkpEnforced,
      zkpVerified,
      zkpError,
      executionSuccess,
      verdict,
      receipt,
      signature,
      error,
      timestamp,
    });
  }

  return traces;
}

// ==========================================
// 6. Conformance Checker
// ==========================================

export interface CaseConformanceResult {
  caseId: string;
  fitness: number;
  isConformant: boolean;
  deviations: string[];
  tokens: {
    produced: number;
    consumed: number;
    missing: number;
    remaining: number;
  };
}

export interface ConformanceReport {
  cases: Record<string, CaseConformanceResult>;
  overallFitness: number;
  isConformant: boolean;
}

/**
 * Validates token-game replay conformance on the provided OCEL 2.0 log.
 * Diagnoses deviations and reports fitness.
 */
export function checkConformance(log: OcelLog): ConformanceReport {
  const report: Record<string, CaseConformanceResult> = {};
  const commandIds = Object.keys(log.objects).filter((id) => log.objects[id].type === 'Command');

  let totalCases = 0;
  let conformantCases = 0;
  let fitnessSum = 0;

  for (const cmdId of commandIds) {
    const cmdEvents = log.events
      .filter((e) => e.omap.includes(cmdId))
      .sort((a, b) => {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        // fallback to ID ordering to ensure stable replay
        return a.id.localeCompare(b.id);
      });

    const marking: Record<string, number> = { p_start: 1 };
    let produced = 1;
    let consumed = 0;
    let missing = 0;
    let remaining = 0;
    const deviations: string[] = [];

    for (const event of cmdEvents) {
      const activity = event.activity;
      const transition = AGENT_PETRI_NET[activity];

      if (!transition) {
        deviations.push(
          `[Conformance Alert](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts): Unknown activity/transition '${activity}'`
        );
        continue;
      }

      // Check input places for tokens
      for (const inputPlace of transition.inputs) {
        if (!marking[inputPlace] || marking[inputPlace] <= 0) {
          deviations.push(
            `[Conformance Alert](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts): Missing token in place '${inputPlace}' for transition '${activity}'`
          );
          missing++;
          marking[inputPlace] = (marking[inputPlace] || 0) + 1; // forced firing
        }
      }

      // Consume tokens
      for (const inputPlace of transition.inputs) {
        marking[inputPlace]--;
        consumed++;
      }

      // Produce tokens
      for (const outputPlace of transition.outputs) {
        marking[outputPlace] = (marking[outputPlace] || 0) + 1;
        produced++;
      }
    }

    // Check final marking: expect 1 token in 'p_end'
    if (!marking['p_end'] || marking['p_end'] <= 0) {
      deviations.push(
        `[Conformance Alert](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts): Missing token in final place 'p_end'`
      );
      missing++;
    } else if (marking['p_end'] > 1) {
      remaining += marking['p_end'] - 1;
    }

    // Check leftover tokens in other places
    for (const place of Object.keys(marking)) {
      if (place !== 'p_end' && marking[place] > 0) {
        deviations.push(
          `[Conformance Alert](file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts): Leftover token in place '${place}' after execution`
        );
        remaining += marking[place];
      }
    }

    // Calculate fitness
    const fitness =
      (consumed > 0 ? 0.5 * (1 - missing / consumed) : 0) +
      (produced > 0 ? 0.5 * (1 - remaining / produced) : 0);

    const isConformant = deviations.length === 0 && fitness === 1.0;

    report[cmdId] = {
      caseId: cmdId,
      fitness,
      isConformant,
      deviations,
      tokens: { produced, consumed, missing, remaining },
    };

    totalCases++;
    if (isConformant) conformantCases++;
    fitnessSum += fitness;
  }

  const overallFitness = totalCases > 0 ? fitnessSum / totalCases : 1.0;
  const isConformant = totalCases > 0 ? conformantCases === totalCases : true;

  return {
    cases: report,
    overallFitness,
    isConformant,
  };
}

// ==========================================
// 7. Fuzz Test Helper / Mutator
// ==========================================

export type MutationType = 'skip_event' | 'swap_events' | 'duplicate_event' | 'invalid_transition';

/**
 * Fuzz test stream generator: injects specific process anomalies into the OCEL log to test the robustness of detection.
 */
export function fuzzLog(log: OcelLog, mutationType: MutationType, targetCaseId?: string): OcelLog {
  // Deep clone log
  const fuzzed: OcelLog = {
    objects: JSON.parse(JSON.stringify(log.objects)),
    events: JSON.parse(JSON.stringify(log.events)),
  };

  const commandIds = Object.keys(fuzzed.objects).filter(
    (id) => fuzzed.objects[id].type === 'Command'
  );
  if (commandIds.length === 0) return fuzzed;

  // Pick a target case
  const caseId = targetCaseId || commandIds[Math.floor(Math.random() * commandIds.length)];

  // Get index list of events for this case
  const eventIndices: number[] = [];
  for (let i = 0; i < fuzzed.events.length; i++) {
    if (fuzzed.events[i].omap.includes(caseId)) {
      eventIndices.push(i);
    }
  }

  if (eventIndices.length === 0) return fuzzed;

  switch (mutationType) {
    case 'skip_event': {
      // Remove a random event of the case
      const randIdx = eventIndices[Math.floor(Math.random() * eventIndices.length)];
      fuzzed.events.splice(randIdx, 1);
      break;
    }
    case 'swap_events': {
      if (eventIndices.length < 2) break;
      // Swap activities/vmaps of two consecutive events for the case
      const randCaseIdx = Math.floor(Math.random() * (eventIndices.length - 1));
      const globalIdx1 = eventIndices[randCaseIdx];
      const globalIdx2 = eventIndices[randCaseIdx + 1];

      const tempActivity = fuzzed.events[globalIdx1].activity;
      const tempVmap = fuzzed.events[globalIdx1].vmap;

      fuzzed.events[globalIdx1].activity = fuzzed.events[globalIdx2].activity;
      fuzzed.events[globalIdx1].vmap = fuzzed.events[globalIdx2].vmap;

      fuzzed.events[globalIdx2].activity = tempActivity;
      fuzzed.events[globalIdx2].vmap = tempVmap;
      break;
    }
    case 'duplicate_event': {
      const randIdx = eventIndices[Math.floor(Math.random() * eventIndices.length)];
      const sourceEvent = fuzzed.events[randIdx];
      const duplicate: OcelEvent = {
        ...JSON.parse(JSON.stringify(sourceEvent)),
        id: `${sourceEvent.id}_dup_${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date(new Date(sourceEvent.timestamp).getTime() + 1).toISOString(),
      };
      fuzzed.events.splice(randIdx + 1, 0, duplicate);
      break;
    }
    case 'invalid_transition': {
      const randIdx = eventIndices[Math.floor(Math.random() * eventIndices.length)];
      fuzzed.events[randIdx].activity = 't_invalid_corrupted_action';
      break;
    }
  }

  return fuzzed;
}
