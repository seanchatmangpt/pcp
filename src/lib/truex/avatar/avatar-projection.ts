/**
 * @fileoverview Truex Avatar-Relative Projection Mapping Models & Invariants
 * 
 * Implements f(GraphDelta, Authority, Relevance, Policy) -> AvatarProjection.
 * This file consolidates the operational projection membrane traps and avatar-relative
 * visibility/capability mappings for the Truex system.
 */

export type AvatarRole = 'guest' | 'member' | 'volunteer' | 'teamLead' | 'pastor' | 'admin' | 'operator';

export interface AvatarProjection {
  role: AvatarRole;
  visible: boolean;
  surface: string;
  allowedActions: string[];
  payload: any;
}

export const AVATAR_ROLES: AvatarRole[] = ['guest', 'member', 'volunteer', 'teamLead', 'pastor', 'admin', 'operator'];

/**
 * Autonomic Projection Matrix.
 * Maps operational tensions (hook IDs) to avatar-relative visibility, capability, and telemetry surfaces.
 */
export const PROJECTION_MATRIX: Record<string, (data: any, role: AvatarRole) => AvatarProjection> = {
  // Use Case 1: The Volunteer Staffing Tension
  volunteer_shortage: (data, role) => {
    switch (role) {
      case 'guest':
        return {
          role,
          visible: false,
          surface: 'hidden',
          allowedActions: [],
          payload: null,
        };
      case 'member':
        return {
          role,
          visible: true,
          surface: 'help invitation',
          allowedActions: ['sign_up_interest'],
          payload: { message: 'Join us in welcoming others! High need for volunteers this Sunday.' },
        };
      case 'volunteer':
        return {
          role,
          visible: true,
          surface: 'shift prompt',
          allowedActions: ['accept_shift', 'decline_shift'],
          payload: { message: 'We need you! Open slots are available.', openSlots: data.openSlots },
        };
      case 'teamLead':
        return {
          role,
          visible: true,
          surface: 'candidate list',
          allowedActions: ['assign_volunteer', 'contact_volunteer'],
          payload: { candidates: data.candidates || [] },
        };
      case 'pastor':
        return {
          role,
          visible: true,
          surface: 'risk summary',
          allowedActions: ['acknowledge_risk'],
          payload: { 
            riskLevel: data.shortageRatio > 0.6 ? 'High' : data.shortageRatio > 0.3 ? 'Medium' : 'Low', 
            shortageRatio: data.shortageRatio 
          },
        };
      case 'admin':
        return {
          role,
          visible: true,
          surface: 'receipt/audit',
          allowedActions: ['audit_runs', 'view_event_log'],
          payload: { runId: data.runId, history: data.history || [] },
        };
      case 'operator':
        return {
          role,
          visible: true,
          surface: 'replay/topology',
          allowedActions: ['trigger_replay', 'check_telemetry'],
          payload: { topology: data.topology || {}, stateHash: data.stateHash },
        };
    }
  },

  // Use Case 2: Sermon Publishing with Policy Violation
  sermon_publish_failed: (data, role) => {
    switch (role) {
      case 'guest':
      case 'member':
      case 'volunteer':
      case 'teamLead':
        return {
          role,
          visible: false,
          surface: 'hidden',
          allowedActions: [],
          payload: null,
        };
      case 'pastor':
        return {
          role,
          visible: true,
          surface: 'policy violation alert',
          allowedActions: ['edit_sermon'],
          payload: {
            message: 'Your sermon could not be published because the video link is from an unapproved domain.',
            mediaUrl: data.mediaUrl,
            reason: data.reason || 'Unapproved video domain',
          },
        };
      case 'admin':
        return {
          role,
          visible: true,
          surface: 'domain exception approval',
          allowedActions: ['approve_domain_exception'],
          payload: {
            message: 'SermonPublish refused: Domain validation failed.',
            receiptId: data.receiptId,
            reason: data.reason || 'Unapproved video domain',
          },
        };
      case 'operator':
        return {
          role,
          visible: true,
          surface: 'compensating rollback view',
          allowedActions: ['replay_construct_delta'],
          payload: {
            message: "TransitionFamilyRefused: Illegal transition from 'drafted' to 'published'. Rollback executed.",
            rollbackReport: data.rollbackReport || {},
            latency: data.latency,
            spanTrace: data.spanTrace,
          },
        };
    }
  },

  // Use Case 3: Concept Drift Detection
  concept_drift_detected: (data, role) => {
    switch (role) {
      case 'guest':
      case 'member':
      case 'volunteer':
      case 'teamLead':
        return {
          role,
          visible: false,
          surface: 'hidden',
          allowedActions: [],
          payload: null,
        };
      case 'pastor':
        return {
          role,
          visible: true,
          surface: 'pattern shift notification',
          allowedActions: ['publish_announcement'],
          payload: {
            message: 'Congregation prayer patterns have shifted toward direct counseling needs this month.',
            module: data.module || 'Care',
          },
        };
      case 'admin':
        return {
          role,
          visible: true,
          surface: 'drift allocation control',
          allowedActions: ['adjust_staff_allocation'],
          payload: {
            message: 'Drift Alert: Workflow deviation detected in Care module.',
            jaccardDistance: data.jaccardDistance,
          },
        };
      case 'operator':
        return {
          role,
          visible: true,
          surface: 'telemetry trace logs',
          allowedActions: ['telco_trace_ocel_logs'],
          payload: {
            message: 'DriftDetector WASM routine emitted anomaly event.',
            ewmaMetric: data.ewmaMetric,
            wasmElapsedMs: data.wasmElapsedMs,
          },
        };
    }
  },

  // Use Case 4: Livestream Incident / Degradation
  livestream_degradation: (data, role) => {
    switch (role) {
      case 'guest':
        return {
          role,
          visible: false,
          surface: 'hidden',
          allowedActions: [],
          payload: null,
        };
      case 'member':
        return {
          role,
          visible: data.streamStatus !== 'healthy',
          surface: 'stream banner',
          allowedActions: data.streamStatus !== 'healthy' ? ['switch_audio_only'] : [],
          payload: {
            message: 'We are experiencing connection issues with the video feed. Audio-only options are available.',
            status: data.streamStatus,
          },
        };
      case 'volunteer':
        return {
          role,
          visible: true,
          surface: 'support status',
          allowedActions: ['report_stream_issue'],
          payload: {
            message: `Livestream is currently ${data.streamStatus}.`,
            status: data.streamStatus,
          },
        };
      case 'teamLead':
        return {
          role,
          visible: true,
          surface: 'incident coordinator dashboard',
          allowedActions: ['escalate_incident', 'resolve_incident'],
          payload: {
            status: data.streamStatus,
            incidentCount: data.incidentCount,
            escalated: data.escalated,
          },
        };
      case 'pastor':
        return {
          role,
          visible: true,
          surface: 'service telemetry overview',
          allowedActions: [],
          payload: {
            message: `Service quality check: Livestream has status ${data.streamStatus}.`,
            status: data.streamStatus,
          },
        };
      case 'admin':
        return {
          role,
          visible: true,
          surface: 'infrastructure console',
          allowedActions: ['audit_runs', 'force_failover'],
          payload: {
            status: data.streamStatus,
            details: data,
          },
        };
      case 'operator':
        return {
          role,
          visible: true,
          surface: 'ops direct telemetry',
          allowedActions: ['escalate_incident', 'resolve_incident', 'trigger_replay'],
          payload: {
            status: data.streamStatus,
            bitrateKbps: data.bitrateKbps,
            packetLossRatio: data.packetLossRatio,
            operatorAlerted: data.operatorAlerted,
            escalated: data.escalated,
          },
        };
    }
  },
};

// Alias mappings for hook compatibility
PROJECTION_MATRIX['content_validation_failed'] = PROJECTION_MATRIX['sermon_publish_failed'];
PROJECTION_MATRIX['concept_drift'] = PROJECTION_MATRIX['concept_drift_detected'];
PROJECTION_MATRIX['livestream_incident'] = PROJECTION_MATRIX['livestream_degradation'];
PROJECTION_MATRIX['tech_incident'] = PROJECTION_MATRIX['livestream_degradation'];

/**
 * Projects a single hook output to a specific avatar role.
 */
export function projectHookOutput(hookId: string, data: any, role: AvatarRole): AvatarProjection {
  const projector = PROJECTION_MATRIX[hookId];
  if (!projector) {
    return {
      role,
      visible: true,
      surface: 'default',
      allowedActions: [],
      payload: data,
    };
  }
  return projector(data, role);
}

/**
 * Projects a single hook output to all avatar roles simultaneously.
 */
export function projectAll(hookId: string, data: any): Record<AvatarRole, AvatarProjection> {
  const result: any = {};
  for (const role of AVATAR_ROLES) {
    result[role] = projectHookOutput(hookId, data, role);
  }
  return result;
}

/**
 * Degradation Invariant: Gracefully degrades options and payload under high load.
 */
export function adjustProjectionForLoad(projection: AvatarProjection, loadFactor: number): AvatarProjection {
  if (loadFactor > 0.85) {
    return {
      ...projection,
      allowedActions: projection.allowedActions.slice(0, 1),
      payload: { ...projection.payload, loadMuted: true },
    };
  }
  return projection;
}

/**
 * Privacy Invariant: Suppresses specific fields for an avatar.
 */
export function suppressFieldsForRole(projection: AvatarProjection, suppressedFields: string[]): AvatarProjection {
  if (!projection.payload) return projection;
  const cleanedPayload = { ...projection.payload };
  for (const field of suppressedFields) {
    delete cleanedPayload[field];
  }
  return {
    ...projection,
    payload: cleanedPayload,
  };
}

/**
 * Escalation Invariant: Validates role escalation permissions.
 */
export function canEscalate(fromRole: AvatarRole, toRole: AvatarRole): boolean {
  const fromIndex = AVATAR_ROLES.indexOf(fromRole);
  const toIndex = AVATAR_ROLES.indexOf(toRole);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex > fromIndex;
}
