/**
 * Pcp 2030 Process Mining Safety Constraints Engine
 *
 * Implements the "Dr. Wil van der Aalst AGI" doctrine for Pcp:
 * 1. Defines formal Petri Net transition schemas for Agent native operations.
 * 2. Emits and parses OCEL 2.0 compliant logs representing execution.
 * 3. Constructs token-game replay conformance checkers.
 * 4. Fuzz tests log streams to verify the detection of deviations.
 *
 * Complete implementation details: [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts)
 */

export interface PetriNetPlace {
  id: string;
  label: string;
}

export interface PetriNetTransition {
  id: string;
  label: string;
}

export interface PetriNetArc {
  source: string;
  target: string;
}

export interface PetriNetSchema {
  places: PetriNetPlace[];
  transitions: PetriNetTransition[];
  arcs: PetriNetArc[];
}

/**
 * Formal Petri Net Schema for Pcp Agent Native Operations.
 *
 * Places:
 * - p_received: Command has been received by the gateway.
 * - p_zkp_verifying: Command is currently undergoing zero-knowledge validation.
 * - p_zkp_passed: Zero-knowledge validation succeeded.
 * - p_zkp_failed: Zero-knowledge validation failed.
 * - p_membrane_checking: Membrane interceptors are evaluating admissibility.
 * - p_membrane_allowed: Membrane interceptor allowed execution.
 * - p_membrane_denied: Membrane interceptor denied execution.
 * - p_trajectory_checking: State trajectory constraints are being validated.
 * - p_trajectory_valid: Trajectory constraints passed.
 * - p_trajectory_invalid: Trajectory constraints violated.
 * - p_executing: Command capability execution block is active.
 * - p_execution_success: Execution completed without fault.
 * - p_execution_failed: Execution crashed or threw an error.
 * - p_quarantined: Execution payload quarantined for audit/forensics.
 * - p_receipted: Success receipt appended to log.
 * - p_refused: Refusal receipt generated and appended to log.
 * - p_completed: Command lifecycle final settlement reached.
 * - p_actor_blocked: Token state indicating the actor is blocked (persistent).
 */
export const AGENT_NATIVE_PETRI_NET: PetriNetSchema = {
  places: [
    { id: 'p_received', label: 'Command Received' },
    { id: 'p_zkp_verifying', label: 'ZKP Verifying' },
    { id: 'p_zkp_passed', label: 'ZKP Passed' },
    { id: 'p_zkp_failed', label: 'ZKP Failed' },
    { id: 'p_membrane_checking', label: 'Membrane Checking' },
    { id: 'p_membrane_allowed', label: 'Membrane Allowed' },
    { id: 'p_membrane_denied', label: 'Membrane Denied' },
    { id: 'p_trajectory_checking', label: 'Trajectory Checking' },
    { id: 'p_trajectory_valid', label: 'Trajectory Valid' },
    { id: 'p_trajectory_invalid', label: 'Trajectory Invalid' },
    { id: 'p_executing', label: 'Executing' },
    { id: 'p_execution_success', label: 'Execution Success' },
    { id: 'p_execution_failed', label: 'Execution Failed' },
    { id: 'p_quarantined', label: 'Quarantined' },
    { id: 'p_receipted', label: 'Receipted' },
    { id: 'p_refused', label: 'Refused' },
    { id: 'p_completed', label: 'Completed' },
    { id: 'p_actor_blocked', label: 'Actor Blocked' },
  ],
  transitions: [
    { id: 'T_RECEIVE_COMMAND', label: 'Receive Command' },
    { id: 'T_START_ZKP', label: 'Start ZKP Verification' },
    { id: 'T_ZKP_SUCCESS', label: 'ZKP Verification Succeeded' },
    { id: 'T_ZKP_FAIL', label: 'ZKP Verification Failed' },
    { id: 'T_START_MEMBRANE', label: 'Start Membrane Evaluation' },
    { id: 'T_MEMBRANE_ALLOW', label: 'Membrane Allowed Execution' },
    { id: 'T_MEMBRANE_DENY', label: 'Membrane Denied Execution' },
    { id: 'T_BLOCKED_ACTOR_INTERCEPT', label: 'Intercept Command for Blocked Actor' },
    { id: 'T_START_TRAJECTORY', label: 'Start Trajectory Validation' },
    { id: 'T_TRAJECTORY_PASS', label: 'Trajectory Validation Passed' },
    { id: 'T_TRAJECTORY_FAIL', label: 'Trajectory Validation Failed' },
    { id: 'T_START_EXECUTION', label: 'Start Payload Execution' },
    { id: 'T_EXECUTION_PASS', label: 'Execution Succeeded' },
    { id: 'T_EXECUTION_FAIL', label: 'Execution Failed' },
    { id: 'T_QUARANTINE_TRAJECTORY', label: 'Quarantine due to Trajectory violation' },
    { id: 'T_QUARANTINE_CRASH', label: 'Quarantine due to Execution crash' },
    { id: 'T_EMIT_SUCCESS_RECEIPT', label: 'Emit Success Receipt' },
    { id: 'T_EMIT_REFUSAL_ZKP', label: 'Emit Refusal Receipt for ZKP Failure' },
    { id: 'T_EMIT_REFUSAL_MEMBRANE', label: 'Emit Refusal Receipt for Membrane Deny' },
    { id: 'T_EMIT_REFUSAL_TRAJECTORY', label: 'Emit Refusal Receipt for Trajectory violation' },
    { id: 'T_EMIT_REFUSAL_CRASH', label: 'Emit Refusal Receipt for Execution Crash' },
    { id: 'T_FINALISE_SUCCESS', label: 'Finalise Successful Lifecycle' },
    { id: 'T_FINALISE_REFUSAL', label: 'Finalise Refused Lifecycle' },
  ],
  arcs: [
    // Lifecycle setup
    { source: 'T_RECEIVE_COMMAND', target: 'p_received' },

    // ZKP verification
    { source: 'p_received', target: 'T_START_ZKP' },
    { source: 'T_START_ZKP', target: 'p_zkp_verifying' },
    { source: 'p_zkp_verifying', target: 'T_ZKP_SUCCESS' },
    { source: 'p_zkp_verifying', target: 'T_ZKP_FAIL' },
    { source: 'T_ZKP_SUCCESS', target: 'p_zkp_passed' },
    { source: 'T_ZKP_FAIL', target: 'p_zkp_failed' },

    // Membrane evaluation
    { source: 'p_zkp_passed', target: 'T_START_MEMBRANE' },
    { source: 'T_START_MEMBRANE', target: 'p_membrane_checking' },
    { source: 'p_membrane_checking', target: 'T_MEMBRANE_ALLOW' },
    { source: 'p_membrane_checking', target: 'T_MEMBRANE_DENY' },
    { source: 'T_MEMBRANE_ALLOW', target: 'p_membrane_allowed' },
    { source: 'T_MEMBRANE_DENY', target: 'p_membrane_denied' },

    // Interception path if actor is blocked
    { source: 'p_received', target: 'T_BLOCKED_ACTOR_INTERCEPT' },
    { source: 'p_actor_blocked', target: 'T_BLOCKED_ACTOR_INTERCEPT' },
    { source: 'T_BLOCKED_ACTOR_INTERCEPT', target: 'p_membrane_denied' },
    { source: 'T_BLOCKED_ACTOR_INTERCEPT', target: 'p_actor_blocked' }, // Loopback to maintain environment token

    // Trajectory checks
    { source: 'p_membrane_allowed', target: 'T_START_TRAJECTORY' },
    { source: 'T_START_TRAJECTORY', target: 'p_trajectory_checking' },
    { source: 'p_trajectory_checking', target: 'T_TRAJECTORY_PASS' },
    { source: 'p_trajectory_checking', target: 'T_TRAJECTORY_FAIL' },
    { source: 'T_TRAJECTORY_PASS', target: 'p_trajectory_valid' },
    { source: 'T_TRAJECTORY_FAIL', target: 'p_trajectory_invalid' },

    // Execution checks
    { source: 'p_trajectory_valid', target: 'T_START_EXECUTION' },
    { source: 'T_START_EXECUTION', target: 'p_executing' },
    { source: 'p_executing', target: 'T_EXECUTION_PASS' },
    { source: 'p_executing', target: 'T_EXECUTION_FAIL' },
    { source: 'T_EXECUTION_PASS', target: 'p_execution_success' },
    { source: 'T_EXECUTION_FAIL', target: 'p_execution_failed' },

    // Quarantine mechanics
    { source: 'p_trajectory_invalid', target: 'T_QUARANTINE_TRAJECTORY' },
    { source: 'T_QUARANTINE_TRAJECTORY', target: 'p_quarantined' },
    { source: 'p_execution_failed', target: 'T_QUARANTINE_CRASH' },
    { source: 'T_QUARANTINE_CRASH', target: 'p_quarantined' },

    // Receipts emitting
    { source: 'p_execution_success', target: 'T_EMIT_SUCCESS_RECEIPT' },
    { source: 'T_EMIT_SUCCESS_RECEIPT', target: 'p_receipted' },

    { source: 'p_zkp_failed', target: 'T_EMIT_REFUSAL_ZKP' },
    { source: 'T_EMIT_REFUSAL_ZKP', target: 'p_refused' },

    { source: 'p_membrane_denied', target: 'T_EMIT_REFUSAL_MEMBRANE' },
    { source: 'T_EMIT_REFUSAL_MEMBRANE', target: 'p_refused' },

    { source: 'p_quarantined', target: 'T_EMIT_REFUSAL_TRAJECTORY' },
    { source: 'T_EMIT_REFUSAL_TRAJECTORY', target: 'p_refused' },

    { source: 'p_quarantined', target: 'T_EMIT_REFUSAL_CRASH' },
    { source: 'T_EMIT_REFUSAL_CRASH', target: 'p_refused' },

    // Finalisation
    { source: 'p_receipted', target: 'T_FINALISE_SUCCESS' },
    { source: 'T_FINALISE_SUCCESS', target: 'p_completed' },

    { source: 'p_refused', target: 'T_FINALISE_REFUSAL' },
    { source: 'T_FINALISE_REFUSAL', target: 'p_completed' },
  ],
};

// ==========================================
// 1. OCEL 2.0 TYPES & BUILDER DEFINITIONS
// ==========================================

export interface OCELAttributeType {
  name: string;
  type: 'string' | 'time' | 'integer' | 'float' | 'boolean';
}

export interface OcelEventType {
  name: string;
  attributes: OCELAttributeType[];
}

export interface OcelObjectType {
  name: string;
  attributes: OCELAttributeType[];
}

export interface OcelEventAttribute {
  name: string;
  value: any;
}

export interface OcelEventRelationship {
  objectId: string;
  qualifier: string;
}

export interface OcelEvent {
  id: string;
  type: string;
  time: string; // ISO 8601 format
  attributes: OcelEventAttribute[];
  relationships: OcelEventRelationship[];
}

export interface OcelObjectAttribute {
  name: string;
  time: string; // ISO 8601 format
  value: any;
}

export interface OcelObject {
  id: string;
  type: string;
  attributes: OcelObjectAttribute[];
}

export interface OCEL2Log {
  eventTypes: OcelEventType[];
  objectTypes: OcelObjectType[];
  events: OcelEvent[];
  objects: OcelObject[];
}

/**
 * Builder class to generate valid OCEL 2.0 compliance event logs.
 */
export class OCEL2Builder {
  private log: OCEL2Log;

  constructor() {
    this.log = {
      eventTypes: [
        { name: 'T_RECEIVE_COMMAND', attributes: [{ name: 'commandId', type: 'string' }] },
        { name: 'T_START_ZKP', attributes: [{ name: 'commandId', type: 'string' }] },
        { name: 'T_ZKP_SUCCESS', attributes: [{ name: 'commandId', type: 'string' }] },
        {
          name: 'T_ZKP_FAIL',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        { name: 'T_START_MEMBRANE', attributes: [{ name: 'commandId', type: 'string' }] },
        { name: 'T_MEMBRANE_ALLOW', attributes: [{ name: 'commandId', type: 'string' }] },
        {
          name: 'T_MEMBRANE_DENY',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        {
          name: 'T_BLOCKED_ACTOR_INTERCEPT',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'actorId', type: 'string' },
          ],
        },
        { name: 'T_START_TRAJECTORY', attributes: [{ name: 'commandId', type: 'string' }] },
        { name: 'T_TRAJECTORY_PASS', attributes: [{ name: 'commandId', type: 'string' }] },
        {
          name: 'T_TRAJECTORY_FAIL',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        { name: 'T_START_EXECUTION', attributes: [{ name: 'commandId', type: 'string' }] },
        { name: 'T_EXECUTION_PASS', attributes: [{ name: 'commandId', type: 'string' }] },
        {
          name: 'T_EXECUTION_FAIL',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        {
          name: 'T_QUARANTINE_TRAJECTORY',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        {
          name: 'T_QUARANTINE_CRASH',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        {
          name: 'T_EMIT_SUCCESS_RECEIPT',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'receiptId', type: 'string' },
          ],
        },
        {
          name: 'T_EMIT_REFUSAL_ZKP',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'receiptId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        {
          name: 'T_EMIT_REFUSAL_MEMBRANE',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'receiptId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        {
          name: 'T_EMIT_REFUSAL_TRAJECTORY',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'receiptId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        {
          name: 'T_EMIT_REFUSAL_CRASH',
          attributes: [
            { name: 'commandId', type: 'string' },
            { name: 'receiptId', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
        { name: 'T_FINALISE_SUCCESS', attributes: [{ name: 'commandId', type: 'string' }] },
        { name: 'T_FINALISE_REFUSAL', attributes: [{ name: 'commandId', type: 'string' }] },
      ],
      objectTypes: [
        {
          name: 'command',
          attributes: [
            { name: 'action', type: 'string' },
            { name: 'params', type: 'string' },
          ],
        },
        {
          name: 'actor',
          attributes: [
            { name: 'blocked', type: 'boolean' },
            { name: 'model', type: 'string' },
          ],
        },
        {
          name: 'receipt',
          attributes: [
            { name: 'success', type: 'boolean' },
            { name: 'verdict', type: 'string' },
            { name: 'error', type: 'string' },
          ],
        },
      ],
      events: [],
      objects: [],
    };
  }

  public addCommandObject(id: string, action: string, params: Record<string, any>): this {
    this.log.objects.push({
      id,
      type: 'command',
      attributes: [
        { name: 'action', time: new Date().toISOString(), value: action },
        { name: 'params', time: new Date().toISOString(), value: JSON.stringify(params) },
      ],
    });
    return this;
  }

  public addActorObject(id: string, blocked: boolean, model: string): this {
    this.log.objects.push({
      id,
      type: 'actor',
      attributes: [
        { name: 'blocked', time: new Date().toISOString(), value: blocked },
        { name: 'model', time: new Date().toISOString(), value: model },
      ],
    });
    return this;
  }

  public addReceiptObject(id: string, success: boolean, verdict: string, error = ''): this {
    this.log.objects.push({
      id,
      type: 'receipt',
      attributes: [
        { name: 'success', time: new Date().toISOString(), value: success },
        { name: 'verdict', time: new Date().toISOString(), value: verdict },
        { name: 'error', time: new Date().toISOString(), value: error },
      ],
    });
    return this;
  }

  public addEvent(
    id: string,
    type: string,
    time: string,
    attributes: OcelEventAttribute[],
    relationships: OcelEventRelationship[]
  ): this {
    this.log.events.push({
      id,
      type,
      time,
      attributes,
      relationships,
    });
    return this;
  }

  public getLog(): OCEL2Log {
    return this.log;
  }
}

export class OCEL2Serializer {
  public static serialize(log: OCEL2Log): string {
    return JSON.stringify(log, null, 2);
  }

  public static deserialize(jsonStr: string): OCEL2Log {
    const log = JSON.parse(jsonStr) as OCEL2Log;
    if (!log.eventTypes || !log.objectTypes || !log.events || !log.objects) {
      throw new Error('Invalid OCEL 2.0 layout. Make sure top-level collections exist.');
    }
    return log;
  }
}

// ==========================================
// 2. TOKEN-GAME REPLAY CONFORMANCE CHECKER
// ==========================================

export interface ReplayMarking {
  [placeId: string]: number;
}

export interface ReplayStepResult {
  transitionId: string;
  enabled: boolean;
  missingTokens: string[];
  markingBefore: ReplayMarking;
  markingAfter: ReplayMarking;
}

export interface TraceReplayResult {
  traceId: string;
  isConforming: boolean;
  steps: ReplayStepResult[];
  produced: number;
  consumed: number;
  missing: number;
  remaining: number;
  fitness: number;
  finalMarking: ReplayMarking;
}

export class PetriNetReplayer {
  private schema: PetriNetSchema;

  constructor(schema: PetriNetSchema) {
    this.schema = schema;
  }

  /**
   * Replays a transition sequence on the Petri Net schema starting with an initial marking.
   * Forces execution by injecting missing tokens when needed to compute conformance fitness.
   */
  public replay(
    traceId: string,
    transitionSequence: string[],
    initialMarking: ReplayMarking
  ): TraceReplayResult {
    const currentMarking: ReplayMarking = { ...initialMarking };

    let totalProduced = 0;
    let totalConsumed = 0;
    let totalMissing = 0;

    for (const key in initialMarking) {
      totalProduced += initialMarking[key];
    }

    const steps: ReplayStepResult[] = [];

    for (const transId of transitionSequence) {
      const trans = this.schema.transitions.find((t) => t.id === transId);
      if (!trans) {
        throw new Error(`Transition ${transId} does not exist in the Petri Net schema.`);
      }

      const markingBefore = { ...currentMarking };
      const inputPlaces = this.schema.arcs.filter((a) => a.target === transId).map((a) => a.source);
      const outputPlaces = this.schema.arcs
        .filter((a) => a.source === transId)
        .map((a) => a.target);

      const missingTokens: string[] = [];

      // Check input places for required tokens
      for (const place of inputPlaces) {
        const required = 1;
        const current = currentMarking[place] || 0;
        if (current < required) {
          const delta = required - current;
          missingTokens.push(place);
          totalMissing += delta;
          currentMarking[place] = (currentMarking[place] || 0) + delta;
          totalProduced += delta;
        }
      }

      const enabled = missingTokens.length === 0;

      // Consume tokens
      for (const place of inputPlaces) {
        currentMarking[place] = (currentMarking[place] || 0) - 1;
        totalConsumed += 1;
      }

      // Produce tokens
      for (const place of outputPlaces) {
        currentMarking[place] = (currentMarking[place] || 0) + 1;
        totalProduced += 1;
      }

      steps.push({
        transitionId: transId,
        enabled,
        missingTokens,
        markingBefore,
        markingAfter: { ...currentMarking },
      });
    }

    // Remaining tokens computation
    let remainingTokens = 0;
    for (const placeId in currentMarking) {
      // p_actor_blocked is a persistent state place; it shouldn't trigger remaining token violations.
      if (placeId === 'p_actor_blocked') {
        continue;
      }

      if (placeId === 'p_completed') {
        remainingTokens += Math.max(0, currentMarking[placeId] - 1);
      } else {
        remainingTokens += currentMarking[placeId];
      }
    }

    const hasExpectedFinal = (currentMarking['p_completed'] || 0) === 1;
    const isConforming = totalMissing === 0 && remainingTokens === 0 && hasExpectedFinal;

    const m_div_c = totalConsumed > 0 ? totalMissing / totalConsumed : 0;
    const r_div_p = totalProduced > 0 ? remainingTokens / totalProduced : 0;
    const fitness = 0.5 * (1 - m_div_c) + 0.5 * (1 - r_div_p);

    return {
      traceId,
      isConforming,
      steps,
      produced: totalProduced,
      consumed: totalConsumed,
      missing: totalMissing,
      remaining: remainingTokens,
      fitness: Math.max(0, Math.min(1, fitness)),
      finalMarking: currentMarking,
    };
  }
}

// ==========================================
// 3. TEMPORAL LOGIC SAFETY PROPERTY CHECKER
// ==========================================

export interface SafetyViolation {
  rule: string;
  description: string;
  commandId?: string;
  actorId?: string;
  eventId?: string;
}

export class TemporalSafetyChecker {
  /**
   * Analyzes an OCEL 2.0 log to detect violations of critical safety rules.
   *
   * Main checks:
   * 1. VERIFICATION_SAFETY: verifying that a command cannot transition to receipts if verification failed.
   * 2. BLOCKED_ACTOR_SAFETY: verifying that a command on a blocked actor is blocked.
   * 3. LIVENESS_ORDER: ensures execution steps are not triggered before verification and membrane clearance.
   * 4. QUARANTINE_INVARIANT: ensures that failures (trajectory or execution) always result in isolation.
   *
   * Uses absolute links to the safety-constraints file:
   * [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts)
   */
  public static verifySafety(log: OCEL2Log): SafetyViolation[] {
    const violations: SafetyViolation[] = [];

    // Identify all command objects in the log
    const commands = log.objects.filter((obj) => obj.type === 'command');

    for (const cmd of commands) {
      const cmdId = cmd.id;

      // Extract all events referencing this command, sorted by time
      const cmdEvents = log.events
        .filter((event) => event.relationships.some((rel) => rel.objectId === cmdId))
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      if (cmdEvents.length === 0) {
        continue;
      }

      // Detect associated actorId from relationships
      let actorId: string | undefined;
      for (const e of cmdEvents) {
        const actRel = e.relationships.find(
          (rel) => rel.qualifier === 'actor' || rel.qualifier === 'initiator'
        );
        if (actRel) {
          actorId = actRel.objectId;
          break;
        }
      }

      // Check if actor is blocked
      let isActorBlocked = false;
      if (actorId) {
        const actorObj = log.objects.find((obj) => obj.id === actorId);
        if (actorObj) {
          const blockedAttr = actorObj.attributes.find((attr) => attr.name === 'blocked');
          if (blockedAttr && blockedAttr.value === true) {
            isActorBlocked = true;
          }
        }
      }

      // 1. Check VERIFICATION_SAFETY
      const hasZkpFail = cmdEvents.some((e) => e.type === 'T_ZKP_FAIL');
      if (hasZkpFail) {
        const invalidSuccess = cmdEvents.find(
          (e) =>
            e.type === 'T_EXECUTION_PASS' ||
            e.type === 'T_EMIT_SUCCESS_RECEIPT' ||
            e.type === 'T_START_EXECUTION'
        );
        if (invalidSuccess) {
          violations.push({
            rule: 'VERIFICATION_SAFETY',
            description: `Safety Violation: Command ${cmdId} experienced a ZKP verification failure, but went on to initiate execution/receipting at event ${invalidSuccess.id}. Verification failures must prevent execution. Refer to [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts) for logic specs.`,
            commandId: cmdId,
            actorId,
            eventId: invalidSuccess.id,
          });
        }
      }

      // 2. Check BLOCKED_ACTOR_SAFETY
      if (isActorBlocked) {
        const invalidExec = cmdEvents.find(
          (e) =>
            e.type === 'T_START_EXECUTION' ||
            e.type === 'T_EXECUTION_PASS' ||
            e.type === 'T_EMIT_SUCCESS_RECEIPT'
        );
        if (invalidExec) {
          violations.push({
            rule: 'BLOCKED_ACTOR_SAFETY',
            description: `Safety Violation: Blocked actor ${actorId} executed command ${cmdId} through event ${invalidExec.id}. Operations from blocked actors must be immediately denied and never execute. Refer to [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts).`,
            commandId: cmdId,
            actorId,
            eventId: invalidExec.id,
          });
        }

        const isIntercepted = cmdEvents.some(
          (e) =>
            e.type === 'T_BLOCKED_ACTOR_INTERCEPT' ||
            e.type === 'T_MEMBRANE_DENY' ||
            e.type === 'T_EMIT_REFUSAL_MEMBRANE'
        );
        if (!isIntercepted) {
          violations.push({
            rule: 'BLOCKED_ACTOR_SAFETY',
            description: `Safety Violation: Command ${cmdId} on blocked actor ${actorId} terminated without being flagged or intercepted by blocked actor rules. See [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts).`,
            commandId: cmdId,
            actorId,
          });
        }
      }

      // 3. Check LIVENESS_ORDER
      const execStartIdx = cmdEvents.findIndex((e) => e.type === 'T_START_EXECUTION');
      if (execStartIdx !== -1) {
        const zkpPassIdx = cmdEvents.findIndex((e) => e.type === 'T_ZKP_SUCCESS');
        const membraneAllowIdx = cmdEvents.findIndex((e) => e.type === 'T_MEMBRANE_ALLOW');

        if (zkpPassIdx === -1 || zkpPassIdx > execStartIdx) {
          violations.push({
            rule: 'LIVENESS_ORDER',
            description: `Safety Violation: Command ${cmdId} executed before verifying ZKP. Execution must be preceded by verification. See [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts).`,
            commandId: cmdId,
            actorId,
            eventId: cmdEvents[execStartIdx].id,
          });
        }

        if (membraneAllowIdx === -1 || membraneAllowIdx > execStartIdx) {
          violations.push({
            rule: 'LIVENESS_ORDER',
            description: `Safety Violation: Command ${cmdId} executed before membrane allowed it. Execution must follow membrane clearance. See [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts).`,
            commandId: cmdId,
            actorId,
            eventId: cmdEvents[execStartIdx].id,
          });
        }
      }

      // 4. Check QUARANTINE_INVARIANT
      const hasTrajectoryFail = cmdEvents.some((e) => e.type === 'T_TRAJECTORY_FAIL');
      if (hasTrajectoryFail) {
        const hasQuarantine = cmdEvents.some((e) => e.type === 'T_QUARANTINE_TRAJECTORY');
        if (!hasQuarantine) {
          violations.push({
            rule: 'QUARANTINE_INVARIANT',
            description: `Safety Violation: Trajectory check failed for command ${cmdId}, but the command payload was not quarantined. Refer to [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts).`,
            commandId: cmdId,
            actorId,
          });
        }
      }

      const hasCrash = cmdEvents.some((e) => e.type === 'T_EXECUTION_FAIL');
      if (hasCrash) {
        const hasQuarantine = cmdEvents.some((e) => e.type === 'T_QUARANTINE_CRASH');
        if (!hasQuarantine) {
          violations.push({
            rule: 'QUARANTINE_INVARIANT',
            description: `Safety Violation: Execution crashed for command ${cmdId}, but no quarantine event was logged. Refer to [safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts).`,
            commandId: cmdId,
            actorId,
          });
        }
      }
    }

    return violations;
  }
}

// ==========================================
// 4. LOG FUZZING ENGINE
// ==========================================

export class LogFuzzer {
  /**
   * Generates a fully conforming execution trace.
   */
  public static generateConformingLog(
    cmdId: string,
    actorId: string,
    action = 'update_state'
  ): OCEL2Log {
    const builder = new OCEL2Builder();
    builder.addCommandObject(cmdId, action, { path: 'settings.theme', value: 'light' });
    builder.addActorObject(actorId, false, 'gpt-4');
    builder.addReceiptObject(`rec_${cmdId}`, true, 'allow');

    const baseTime = new Date('2026-05-31T19:00:00Z');
    const timeAt = (sec: number) => new Date(baseTime.getTime() + sec * 1000).toISOString();

    builder.addEvent(
      `e_${cmdId}_1`,
      'T_RECEIVE_COMMAND',
      timeAt(1),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_2`,
      'T_START_ZKP',
      timeAt(2),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_3`,
      'T_ZKP_SUCCESS',
      timeAt(3),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_4`,
      'T_START_MEMBRANE',
      timeAt(4),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_5`,
      'T_MEMBRANE_ALLOW',
      timeAt(5),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_6`,
      'T_START_TRAJECTORY',
      timeAt(6),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_7`,
      'T_TRAJECTORY_PASS',
      timeAt(7),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_8`,
      'T_START_EXECUTION',
      timeAt(8),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_9`,
      'T_EXECUTION_PASS',
      timeAt(9),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_10`,
      'T_EMIT_SUCCESS_RECEIPT',
      timeAt(10),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
        { objectId: `rec_${cmdId}`, qualifier: 'receipt' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_11`,
      'T_FINALISE_SUCCESS',
      timeAt(11),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );

    return builder.getLog();
  }

  /**
   * Generates a trace with VERIFICATION_SAFETY violation.
   * ZKP fails but execution succeeds and emits a success receipt.
   */
  public static generateZkpBypassViolationLog(cmdId: string, actorId: string): OCEL2Log {
    const builder = new OCEL2Builder();
    builder.addCommandObject(cmdId, 'update_state', { path: 'settings.theme', value: 'light' });
    builder.addActorObject(actorId, false, 'gpt-4');
    builder.addReceiptObject(`rec_${cmdId}`, true, 'allow');

    const baseTime = new Date('2026-05-31T19:00:00Z');
    const timeAt = (sec: number) => new Date(baseTime.getTime() + sec * 1000).toISOString();

    builder.addEvent(
      `e_${cmdId}_1`,
      'T_RECEIVE_COMMAND',
      timeAt(1),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_2`,
      'T_START_ZKP',
      timeAt(2),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_3`,
      'T_ZKP_FAIL',
      timeAt(3),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    // Bypasses membrane and trajectory checks, executing directly
    builder.addEvent(
      `e_${cmdId}_4`,
      'T_START_EXECUTION',
      timeAt(4),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_5`,
      'T_EXECUTION_PASS',
      timeAt(5),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_6`,
      'T_EMIT_SUCCESS_RECEIPT',
      timeAt(6),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
        { objectId: `rec_${cmdId}`, qualifier: 'receipt' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_7`,
      'T_FINALISE_SUCCESS',
      timeAt(7),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );

    return builder.getLog();
  }

  /**
   * Generates a trace with BLOCKED_ACTOR_SAFETY violation.
   * Actor is blocked but executes successfully.
   */
  public static generateBlockedActorViolationLog(cmdId: string, actorId: string): OCEL2Log {
    const builder = new OCEL2Builder();
    builder.addCommandObject(cmdId, 'update_state', { path: 'settings.theme', value: 'light' });
    builder.addActorObject(actorId, true, 'gpt-4'); // BLOCKED
    builder.addReceiptObject(`rec_${cmdId}`, true, 'allow');

    const baseTime = new Date('2026-05-31T19:00:00Z');
    const timeAt = (sec: number) => new Date(baseTime.getTime() + sec * 1000).toISOString();

    builder.addEvent(
      `e_${cmdId}_1`,
      'T_RECEIVE_COMMAND',
      timeAt(1),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_2`,
      'T_START_ZKP',
      timeAt(2),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_3`,
      'T_ZKP_SUCCESS',
      timeAt(3),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_4`,
      'T_START_MEMBRANE',
      timeAt(4),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_5`,
      'T_MEMBRANE_ALLOW',
      timeAt(5),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_6`,
      'T_START_EXECUTION',
      timeAt(6),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_7`,
      'T_EXECUTION_PASS',
      timeAt(7),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_8`,
      'T_EMIT_SUCCESS_RECEIPT',
      timeAt(8),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
        { objectId: `rec_${cmdId}`, qualifier: 'receipt' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_9`,
      'T_FINALISE_SUCCESS',
      timeAt(9),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );

    return builder.getLog();
  }

  /**
   * Generates a trace with QUARANTINE_INVARIANT violation.
   * Execution crashes (T_EXECUTION_FAIL) but command doesn't go to quarantine.
   */
  public static generateMissingQuarantineViolationLog(cmdId: string, actorId: string): OCEL2Log {
    const builder = new OCEL2Builder();
    builder.addCommandObject(cmdId, 'update_state', { path: 'settings.theme', value: 'light' });
    builder.addActorObject(actorId, false, 'gpt-4');
    builder.addReceiptObject(`rec_${cmdId}`, false, 'deny');

    const baseTime = new Date('2026-05-31T19:00:00Z');
    const timeAt = (sec: number) => new Date(baseTime.getTime() + sec * 1000).toISOString();

    builder.addEvent(
      `e_${cmdId}_1`,
      'T_RECEIVE_COMMAND',
      timeAt(1),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_2`,
      'T_START_ZKP',
      timeAt(2),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_3`,
      'T_ZKP_SUCCESS',
      timeAt(3),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_4`,
      'T_START_MEMBRANE',
      timeAt(4),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_5`,
      'T_MEMBRANE_ALLOW',
      timeAt(5),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_6`,
      'T_START_TRAJECTORY',
      timeAt(6),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_7`,
      'T_TRAJECTORY_PASS',
      timeAt(7),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_8`,
      'T_START_EXECUTION',
      timeAt(8),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_9`,
      'T_EXECUTION_FAIL',
      timeAt(9),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    // Skips T_QUARANTINE_CRASH
    builder.addEvent(
      `e_${cmdId}_10`,
      'T_EMIT_REFUSAL_CRASH',
      timeAt(10),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
        { objectId: `rec_${cmdId}`, qualifier: 'receipt' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_11`,
      'T_FINALISE_REFUSAL',
      timeAt(11),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );

    return builder.getLog();
  }

  /**
   * Generates a conforming blocked actor log.
   */
  public static generateBlockedActorConformingLog(cmdId: string, actorId: string): OCEL2Log {
    const builder = new OCEL2Builder();
    builder.addCommandObject(cmdId, 'update_state', { path: 'settings.theme', value: 'light' });
    builder.addActorObject(actorId, true, 'gpt-4'); // BLOCKED
    builder.addReceiptObject(`rec_${cmdId}`, false, 'deny');

    const baseTime = new Date('2026-05-31T19:00:00Z');
    const timeAt = (sec: number) => new Date(baseTime.getTime() + sec * 1000).toISOString();

    builder.addEvent(
      `e_${cmdId}_1`,
      'T_RECEIVE_COMMAND',
      timeAt(1),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_2`,
      'T_BLOCKED_ACTOR_INTERCEPT',
      timeAt(2),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_3`,
      'T_EMIT_REFUSAL_MEMBRANE',
      timeAt(3),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
        { objectId: `rec_${cmdId}`, qualifier: 'receipt' },
      ]
    );
    builder.addEvent(
      `e_${cmdId}_4`,
      'T_FINALISE_REFUSAL',
      timeAt(4),
      [],
      [
        { objectId: cmdId, qualifier: 'command' },
        { objectId: actorId, qualifier: 'actor' },
      ]
    );

    return builder.getLog();
  }
}
