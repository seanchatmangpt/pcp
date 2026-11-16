import { IntelligenceCapability, InputContract, OutputContract } from './types';
import { sha256, canonicalStringify } from '../../crypto/receipts';

/**
 * 1. Truex Receipt Verifier
 */
export const TruexReceiptVerifier: IntelligenceCapability = {
  id: 'truex-receipt-verifier',
  name: 'Truex OCEL 2.0 Receipt Verifier',
  description:
    'Cryptographically audits and verifies OCEL 2.0 trace logs and admission signatures.',
  inputContract: {
    properties: {
      session_id: { type: 'string', description: 'Unique session identifier', required: true },
      expected_path_hash: {
        type: 'string',
        description: 'Expected path hash signature',
        required: true,
      },
      ocel2_batch_hash: {
        type: 'string',
        description: 'Authoritative OCEL 2.0 batch hash',
        required: true,
      },
      receipt_hash: {
        type: 'string',
        description: 'Claimed cryptographic signature of the receipt',
        required: true,
      },
      ocel2: { type: 'object', description: 'OCEL 2.0 JSON payload', required: true },
      admission_status: {
        type: 'string',
        description: 'Admission decision (e.g. accepted | refused)',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      batchValid: {
        type: 'boolean',
        description: 'Whether the canonical event log matches the expected batch hash',
      },
      receiptValid: { type: 'boolean', description: 'Whether the receipt signature is authentic' },
      verified: { type: 'boolean', description: 'Complete receipt audit verification result' },
      admission_status: { type: 'string', description: 'Admission decision status' },
      receipt_hash: { type: 'string', description: 'Cryptographic signature of the receipt' },
    },
  },
  async run(input: any) {
    const logs: string[] = ['[Truex] Initializing receipt cryptographic audit...'];
    try {
      const {
        session_id,
        expected_path_hash,
        ocel2_batch_hash,
        receipt_hash,
        ocel2,
        admission_status,
      } = input;
      if (!session_id || !expected_path_hash || !ocel2_batch_hash || !receipt_hash || !ocel2) {
        throw new Error('Missing required input attributes for Truex verifier.');
      }

      // Step 1: Canonicalize and hash OCEL
      const canonicalOcel2 = canonicalStringify(ocel2);
      const computedBatchHash = sha256(canonicalOcel2);
      const batchValid = computedBatchHash === ocel2_batch_hash;

      logs.push(`[Truex] Computed batch hash: ${computedBatchHash}`);
      logs.push(`[Truex] Expected batch hash: ${ocel2_batch_hash}`);
      logs.push(`[Truex] Batch hash match: ${batchValid ? 'YES' : 'NO'}`);

      // Step 2: Verify receipt signature
      const receiptSeed = `${session_id}:${computedBatchHash}:${expected_path_hash}`;
      const computedReceiptHash = sha256(receiptSeed);
      const receiptValid = computedReceiptHash === receipt_hash;

      logs.push(`[Truex] Computed receipt hash: ${computedReceiptHash}`);
      logs.push(`[Truex] Expected receipt hash: ${receipt_hash}`);
      logs.push(`[Truex] Receipt signature match: ${receiptValid ? 'YES' : 'NO'}`);

      const verified = batchValid && receiptValid;
      logs.push(`[Truex] Audit verdict: ${verified ? 'VERIFIED' : 'FAILED/FORGED'}`);

      return {
        success: true,
        result: {
          batchValid,
          receiptValid,
          verified,
          admission_status: admission_status || 'accepted',
          receipt_hash,
        },
        logs,
      };
    } catch (e: any) {
      logs.push(`[Truex Error] Audit aborted: ${e.message}`);
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 2. JTBD Conformance Auditor (Van der Aalst Doctrine)
 */
export const JtbdConformanceAuditor: IntelligenceCapability = {
  id: 'jtbd-conformance-auditor',
  name: 'JTBD Conformance Auditor',
  description:
    'Audits trace activities against declared transition workflows to compute fitness and process fitness verdicts.',
  inputContract: {
    properties: {
      declaredWorkflow: {
        type: 'array',
        description: 'Array of expected activity names in order',
        required: true,
      },
      actualEvents: {
        type: 'array',
        description: 'Array of actual observed events or activity strings',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      fitness: {
        type: 'number',
        description: 'How well the observed trace fits the declared workflow',
      },
      precision: { type: 'number', description: 'Degree of over-generalization' },
      simplicity: { type: 'number', description: 'Log complexity indicator' },
      verdict: {
        type: 'string',
        description: 'Van der Aalst verdict: TRUTHFUL | VARIANCE | DECEPTIVE',
      },
    },
  },
  async run(input: any) {
    const logs: string[] = ['[JTBD Auditor] Beginning conformance audit...'];
    try {
      const { declaredWorkflow, actualEvents } = input;
      if (
        !declaredWorkflow ||
        !actualEvents ||
        !Array.isArray(declaredWorkflow) ||
        !Array.isArray(actualEvents)
      ) {
        throw new Error('Invalid input types. Requires declaredWorkflow and actualEvents arrays.');
      }

      // Convert arrays to set transitions
      const declaredEdges = new Set<string>();
      for (let i = 0; i < declaredWorkflow.length - 1; i++) {
        declaredEdges.add(`${declaredWorkflow[i]}->${declaredWorkflow[i + 1]}`);
      }

      const actualEdges = new Set<string>();
      for (let i = 0; i < actualEvents.length - 1; i++) {
        actualEdges.add(`${actualEvents[i]}->${actualEvents[i + 1]}`);
      }

      // Calculate intersection and differences (deviations)
      let matches = 0;
      let deviations = 0;
      actualEdges.forEach((edge) => {
        if (declaredEdges.has(edge)) {
          matches++;
        } else {
          deviations++;
          logs.push(`[Deviation] Found undeclared transition: ${edge}`);
        }
      });

      const totalDeclared = declaredEdges.size || 1;
      const totalActual = actualEdges.size || 1;

      const fitness = matches / totalDeclared;
      const precision = matches / totalActual;
      const simplicity = 1 / (1 + deviations);

      let verdict = 'DECEPTIVE';
      if (fitness >= 0.9) {
        verdict = 'TRUTHFUL';
      } else if (fitness >= 0.6) {
        verdict = 'VARIANCE';
      }

      logs.push(
        `[JTBD Auditor] Conformance Metrics - Fitness: ${fitness.toFixed(2)}, Precision: ${precision.toFixed(2)}, Simplicity: ${simplicity.toFixed(2)}`
      );
      logs.push(`[JTBD Auditor] Conformance Verdict: ${verdict}`);

      return {
        success: true,
        result: { fitness, precision, simplicity, verdict },
        logs,
      };
    } catch (e: any) {
      logs.push(`[JTBD Auditor Error] ${e.message}`);
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 3. Concept Drift Detector
 */
export const ConceptDriftDetector: IntelligenceCapability = {
  id: 'concept-drift-detector',
  name: 'Concept Drift Detector',
  description:
    'Monitors sliding activity windows to check Jaccard distances and smooth alerts using EWMA.',
  inputContract: {
    properties: {
      activities: { type: 'array', description: 'Stream of activity events', required: true },
      windowSize: { type: 'number', description: 'Size of window for comparison', required: true },
      threshold: {
        type: 'number',
        description: 'Alert threshold value (0.0 to 1.0)',
        required: true,
      },
      smoothingLambda: { type: 'number', description: 'EWMA smoothing parameter (0.0 to 1.0)' },
    },
  },
  outputContract: {
    properties: {
      alertsCount: { type: 'number', description: 'Total number of drift alerts raised' },
      snapshots: { type: 'array', description: 'History of Jaccard distances and EWMA metrics' },
      stable: { type: 'boolean', description: 'Whether the process appears stable without drift' },
    },
  },
  async run(input: any) {
    const logs: string[] = ['[Concept Drift] Initializing drift detection stream...'];
    try {
      const { activities, windowSize, threshold } = input;
      const lambda = input.smoothingLambda ?? 0.2;

      if (!activities || !windowSize || !threshold || !Array.isArray(activities)) {
        throw new Error('Missing activities, windowSize, or threshold settings.');
      }

      const snapshots: any[] = [];
      let alertsCount = 0;
      let smoothed = 0.0;

      // Group activities into windows
      const numWindows = Math.floor(activities.length / windowSize);
      logs.push(
        `[Concept Drift] Total events: ${activities.length}. Split into ${numWindows} windows.`
      );

      for (let i = 0; i < numWindows - 1; i++) {
        const winA = new Set(activities.slice(i * windowSize, (i + 1) * windowSize));
        const winB = new Set(activities.slice((i + 1) * windowSize, (i + 2) * windowSize));

        // Jaccard Distance calculation
        const intersection = new Set([...winA].filter((x) => winB.has(x)));
        const union = new Set([...winA, ...winB]);
        const intersectSize = intersection.size;
        const unionSize = union.size || 1;

        const jaccardDist = 1.0 - intersectSize / unionSize;

        // EWMA smoothing
        if (i === 0) {
          smoothed = jaccardDist;
        } else {
          smoothed = lambda * jaccardDist + (1.0 - lambda) * smoothed;
        }

        const alert = smoothed > threshold;
        if (alert) {
          alertsCount++;
          logs.push(
            `[Concept Drift Alert] Window ${i + 1} crossed threshold: EWMA=${smoothed.toFixed(3)} (Threshold=${threshold})`
          );
        }

        snapshots.push({
          windowIndex: i + 1,
          rawDistance: jaccardDist,
          smoothedDistance: smoothed,
          alert,
        });
      }

      const stable = alertsCount === 0;
      logs.push(
        `[Concept Drift] Finished. Total alerts raised: ${alertsCount}. Process stable: ${stable}`
      );

      return {
        success: true,
        result: { alertsCount, snapshots, stable },
        logs,
      };
    } catch (e: any) {
      logs.push(`[Concept Drift Error] ${e.message}`);
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 4. RL Orchestrator Monitor
 */
export const RlOrchestratorMonitor: IntelligenceCapability = {
  id: 'rl-orchestrator-monitor',
  name: 'RL Orchestrator Monitor',
  description: 'Simulates policy improvement over reinforcement learning execution cycles.',
  inputContract: {
    properties: {
      cyclesCount: {
        type: 'number',
        description: 'Number of simulation execution cycles',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      initialReward: { type: 'number', description: 'Mean reward in initial cycles' },
      finalReward: { type: 'number', description: 'Mean reward in last cycles' },
      policyImproving: {
        type: 'boolean',
        description: 'Whether learning convergence trend is positive',
      },
    },
  },
  async run(input: any) {
    const logs: string[] = ['[RL Monitor] Initializing orchestrator cycle simulation...'];
    try {
      const { cyclesCount } = input;
      if (!cyclesCount || typeof cyclesCount !== 'number') {
        throw new Error('CyclesCount must be specified as a number.');
      }

      const rewards: number[] = [];
      for (let i = 0; i < cyclesCount; i++) {
        // Mild non-stationarity: simulate gradual performance enhancement (improving metrics)
        const progressFactor = i / cyclesCount;
        const spc_alerts = Math.random() > 0.1 + progressFactor * 0.4 ? 0 : 1; // alerts decrease
        const rework_ratio = 0.2 - progressFactor * 0.15; // rework decreases
        const guard_pass = Math.random() > 0.05;

        // Reward calculation formula
        const reward =
          (1.0 - spc_alerts) * 0.4 + (1.0 - rework_ratio) * 0.4 + (guard_pass ? 0.2 : 0);
        rewards.push(reward);

        if (i % 10 === 0 || i === cyclesCount - 1) {
          logs.push(
            `  Cycle ${i}: alerts=${spc_alerts}, rework=${rework_ratio.toFixed(2)}, reward=${reward.toFixed(2)}`
          );
        }
      }

      const initialReward =
        rewards.slice(0, Math.min(10, rewards.length)).reduce((a, b) => a + b, 0) /
        Math.min(10, rewards.length);
      const finalReward =
        rewards.slice(-Math.min(10, rewards.length)).reduce((a, b) => a + b, 0) /
        Math.min(10, rewards.length);
      const policyImproving = finalReward > initialReward;

      logs.push(
        `[RL Monitor] Convergence check: initial reward=${initialReward.toFixed(3)}, final reward=${finalReward.toFixed(3)}`
      );
      logs.push(`[RL Monitor] Policy improving verdict: ${policyImproving ? 'YES' : 'NO'}`);

      return {
        success: true,
        result: { initialReward, finalReward, policyImproving },
        logs,
      };
    } catch (e: any) {
      logs.push(`[RL Monitor Error] ${e.message}`);
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 5. Compliance Safety Guard (OCPQ-style Temporal Guard)
 */
export const ComplianceSafetyGuard: IntelligenceCapability = {
  id: 'compliance-safety-guard',
  name: 'Compliance Safety Guard',
  description: 'Audits multi-object safety constraints and temporal compliance rules.',
  inputContract: {
    properties: {
      traceCommands: {
        type: 'array',
        description: 'Sequence of execution command envelopes',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      compliant: {
        type: 'boolean',
        description: 'Whether the sequence complies with temporal constraints',
      },
      violations: { type: 'array', description: 'List of detected violation messages' },
    },
  },
  async run(input: any) {
    const logs: string[] = ['[Safety Guard] Checking OCPQ safety rules...'];
    try {
      const { traceCommands } = input;
      if (!traceCommands || !Array.isArray(traceCommands)) {
        throw new Error('Invalid trace. Requires an array of command envelopes.');
      }

      const violations: string[] = [];

      // Let's implement the core safety rule:
      // "If a command was rejected, no further commands for the same actor may be executed in the trace"
      const actorRejections = new Set<string>();

      for (const cmd of traceCommands) {
        const actorKey = `${cmd.actorKind}:${cmd.actorId}`;

        if (actorRejections.has(actorKey)) {
          const errMsg = `Violation: Command '${cmd.command}' executed on Actor '${actorKey}' after a rejection was recorded.`;
          violations.push(errMsg);
          logs.push(`[Violation] ${errMsg}`);
        }

        if (
          cmd.status === 'rejected_remote' ||
          cmd.status === 'rejected_local' ||
          cmd.status === 'refused'
        ) {
          actorRejections.add(actorKey);
          logs.push(`[Safety Guard] Rejection recorded for Actor ${actorKey}`);
        }
      }

      const compliant = violations.length === 0;
      logs.push(
        `[Safety Guard] Audit completed. Compliant: ${compliant}. Violations: ${violations.length}`
      );

      return {
        success: true,
        result: { compliant, violations },
        logs,
      };
    } catch (e: any) {
      logs.push(`[Safety Guard Error] ${e.message}`);
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 6. Habit Prompt Generator (PROMPT)
 */
export const HabitPromptGenerator: IntelligenceCapability = {
  id: 'habit-prompt-generator',
  name: 'Habit Prompt Generator',
  description: 'Generates daily habit stack prompts based on missed devotional check-in signals.',
  inputContract: {
    properties: {
      userId: { type: 'string', description: 'The unique user identifier', required: true },
      missedStreaks: {
        type: 'number',
        description: 'Number of consecutive missed streak days',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      interventions: { type: 'array', description: 'Generated public ontology actions list' },
    },
  },
  async run(input: any) {
    const logs = ['[Habit Prompt] Analyzing user habits...'];
    try {
      const { userId, missedStreaks } = input;
      if (!userId || missedStreaks === undefined) {
        throw new Error('UserId and missedStreaks must be specified.');
      }

      const interventions: any[] = [];
      if (missedStreaks > 2) {
        const intId = `urn:zoe:intervention:prompt_${Math.random().toString(36).substr(2, 9)}`;
        logs.push(
          `[Habit Prompt] Missed streak threshold reached. Emitting PROMPT intervention: ${intId}`
        );

        interventions.push({
          id: intId,
          verb: 'PROMPT',
          rdfQuads: [
            {
              subject: intId,
              predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              object: 'http://schema.org/Action',
            },
            {
              subject: intId,
              predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              object: 'http://www.w3.org/ns/activitystreams#Announce',
            },
            { subject: intId, predicate: 'http://schema.org/agent', object: 'urn:zoe:agent:app' },
            {
              subject: intId,
              predicate: 'http://schema.org/recipient',
              object: `urn:zoe:member:${userId}`,
            },
            {
              subject: intId,
              predicate: 'http://schema.org/object',
              object: 'urn:zoe:devotional:daily_prayer',
            },
            {
              subject: intId,
              predicate: 'http://www.w3.org/ns/prov#wasDerivedFrom',
              object: 'urn:zoe:signal:missed_checkin_streak',
            },
          ],
        });
      } else {
        logs.push('[Habit Prompt] User is compliant with streaks. No prompt required.');
      }

      return { success: true, result: { interventions }, logs };
    } catch (e: any) {
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 7. Volunteer Fit Suggester (RECOMMEND)
 */
export const VolunteerFitSuggester: IntelligenceCapability = {
  id: 'volunteer-fit-suggester',
  name: 'Volunteer Fit Suggester',
  description:
    'Suggests high-fitness volunteer assignments matching stated spiritual gifts and attendance patterns.',
  inputContract: {
    properties: {
      userId: { type: 'string', description: 'The unique user identifier', required: true },
      giftTags: { type: 'array', description: 'Array of stated spiritual gifts', required: true },
      eventAttendedCount: {
        type: 'number',
        description: 'Stated event attendance count',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      interventions: {
        type: 'array',
        description: 'Generated public ontology recommendation list',
      },
    },
  },
  async run(input: any) {
    const logs = ['[Volunteer Fit] Analysing stated gifts and service history...'];
    try {
      const { userId, giftTags, eventAttendedCount } = input;
      if (!userId || !giftTags || eventAttendedCount === undefined) {
        throw new Error('UserId, giftTags and eventAttendedCount must be specified.');
      }

      const interventions: any[] = [];
      if (giftTags.includes('Hospitality') && eventAttendedCount > 2) {
        const intId = `urn:zoe:intervention:recommend_${Math.random().toString(36).substr(2, 9)}`;
        logs.push(
          `[Volunteer Fit] Found high hospitality correlation. Recommending role: ${intId}`
        );

        interventions.push({
          id: intId,
          verb: 'RECOMMEND',
          rdfQuads: [
            {
              subject: intId,
              predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              object: 'http://schema.org/Action',
            },
            {
              subject: intId,
              predicate: 'http://schema.org/recipient',
              object: `urn:zoe:member:${userId}`,
            },
            {
              subject: intId,
              predicate: 'http://schema.org/object',
              object: 'urn:zoe:role:welcome_team_host',
            },
            {
              subject: intId,
              predicate: 'http://www.w3.org/ns/prov#wasDerivedFrom',
              object: 'urn:zoe:evidence:gifts_hospitality',
            },
          ],
        });
      }

      return { success: true, result: { interventions }, logs };
    } catch (e: any) {
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 8. Spiritual Rhythm Tracker (REMIND)
 */
export const SpiritualRhythmTracker: IntelligenceCapability = {
  id: 'spiritual-rhythm-tracker',
  name: 'Spiritual Rhythm Tracker',
  description:
    'Triggers scripture quest reminders when media is watched but no follow-up action is recorded.',
  inputContract: {
    properties: {
      userId: { type: 'string', description: 'The unique user identifier', required: true },
      sermonId: { type: 'string', description: 'The unique sermon identifier', required: true },
      hasNextAction: {
        type: 'boolean',
        description: 'Whether a next discipleship action is scheduled',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      interventions: { type: 'array', description: 'Generated public ontology reminder list' },
    },
  },
  async run(input: any) {
    const logs = ['[Rhythm Tracker] Inspecting sermon follow-up state...'];
    try {
      const { userId, sermonId, hasNextAction } = input;
      if (!userId || !sermonId || hasNextAction === undefined) {
        throw new Error('UserId, sermonId, and hasNextAction must be specified.');
      }

      const interventions: any[] = [];
      if (!hasNextAction) {
        const intId = `urn:zoe:intervention:remind_${Math.random().toString(36).substr(2, 9)}`;
        logs.push(`[Rhythm Tracker] No next action recorded. Emitting quest reminder: ${intId}`);

        interventions.push({
          id: intId,
          verb: 'REMIND',
          rdfQuads: [
            {
              subject: intId,
              predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              object: 'http://schema.org/ScheduleAction',
            },
            {
              subject: intId,
              predicate: 'http://schema.org/recipient',
              object: `urn:zoe:member:${userId}`,
            },
            {
              subject: intId,
              predicate: 'http://schema.org/object',
              object: 'urn:zoe:quest:weekly_discussion',
            },
            {
              subject: intId,
              predicate: 'http://www.w3.org/ns/prov#wasDerivedFrom',
              object: `urn:zoe:sermon:${sermonId}`,
            },
          ],
        });
      }

      return { success: true, result: { interventions }, logs };
    } catch (e: any) {
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 9. On Campus Navigator (REORDER)
 */
export const OnCampusNavigator: IntelligenceCapability = {
  id: 'on-campus-navigator',
  name: 'On Campus Navigator',
  description:
    'Reorders campus room listings dynamically when geofence/check-in presence is detected.',
  inputContract: {
    properties: {
      userId: { type: 'string', description: 'The unique user identifier', required: true },
      campusId: { type: 'string', description: 'The unique campus identifier', required: true },
      checkedIn: { type: 'boolean', description: 'Presence check-in flag status', required: true },
    },
  },
  outputContract: {
    properties: {
      interventions: { type: 'array', description: 'Generated public ontology reorder list' },
    },
  },
  async run(input: any) {
    const logs = ['[Campus Navigator] Reading geo-presence location...'];
    try {
      const { userId, campusId, checkedIn } = input;
      if (!userId || !campusId || checkedIn === undefined) {
        throw new Error('UserId, campusId and checkedIn must be specified.');
      }

      const interventions: any[] = [];
      if (checkedIn) {
        const intId = `urn:zoe:intervention:reorder_${Math.random().toString(36).substr(2, 9)}`;
        logs.push(
          `[Campus Navigator] Presence verified. Reordering local rooms layout list: ${intId}`
        );

        interventions.push({
          id: intId,
          verb: 'REORDER',
          rdfQuads: [
            {
              subject: intId,
              predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              object: 'http://schema.org/ItemList',
            },
            {
              subject: intId,
              predicate: 'http://schema.org/recipient',
              object: `urn:zoe:member:${userId}`,
            },
            {
              subject: intId,
              predicate: 'http://schema.org/object',
              object: 'urn:zoe:place:classroom_kidz',
            },
            { subject: intId, predicate: 'http://schema.org/position', object: '1' },
          ],
        });
      }

      return { success: true, result: { interventions }, logs };
    } catch (e: any) {
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 10. Care Risk Escalator (ESCALATE)
 */
export const CareRiskEscalator: IntelligenceCapability = {
  id: 'care-risk-escalator',
  name: 'Care Risk Escalator',
  description:
    'Escalates support requests to pastors and care cohorts when multiple group attendances are missed.',
  inputContract: {
    properties: {
      userId: { type: 'string', description: 'The unique user identifier', required: true },
      missedGroupsCount: {
        type: 'number',
        description: 'Consecutive missed small group counts',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      interventions: { type: 'array', description: 'Generated public ontology escalation actions' },
    },
  },
  async run(input: any) {
    const logs = ['[Care Escalator] Evaluating isolation indicators...'];
    try {
      const { userId, missedGroupsCount } = input;
      if (!userId || missedGroupsCount === undefined) {
        throw new Error('UserId and missedGroupsCount must be specified.');
      }

      const interventions: any[] = [];
      if (missedGroupsCount > 2) {
        const intId = `urn:zoe:intervention:escalate_${Math.random().toString(36).substr(2, 9)}`;
        logs.push(
          `[Care Escalator] Missed group attendance count exceeded limit. Escalating: ${intId}`
        );

        interventions.push({
          id: intId,
          verb: 'ESCALATE',
          rdfQuads: [
            {
              subject: intId,
              predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              object: 'http://schema.org/InformAction',
            },
            {
              subject: intId,
              predicate: 'http://schema.org/recipient',
              object: 'urn:zoe:cohort:care_team_pastors',
            },
            {
              subject: intId,
              predicate: 'http://schema.org/object',
              object: `urn:zoe:member:${userId}`,
            },
            {
              subject: intId,
              predicate: 'http://www.w3.org/ns/prov#wasDerivedFrom',
              object: 'urn:zoe:signal:missed_groups_isolation',
            },
          ],
        });
      }

      return { success: true, result: { interventions }, logs };
    } catch (e: any) {
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * 11. Engagement Fatigue Controller (SUPPRESS)
 */
export const EngagementFatigueController: IntelligenceCapability = {
  id: 'engagement-fatigue-controller',
  name: 'Engagement Fatigue Controller',
  description: 'Suppresses system push alerts when prolonged fatigue opens patterns are flagged.',
  inputContract: {
    properties: {
      userId: { type: 'string', description: 'The unique user identifier', required: true },
      notOpenedStreak: {
        type: 'number',
        description: 'Days since last opened app session',
        required: true,
      },
    },
  },
  outputContract: {
    properties: {
      interventions: { type: 'array', description: 'Generated public ontology prohibitions list' },
    },
  },
  async run(input: any) {
    const logs = ['[Fatigue Controller] Checking app session frequencies...'];
    try {
      const { userId, notOpenedStreak } = input;
      if (!userId || notOpenedStreak === undefined) {
        throw new Error('UserId and notOpenedStreak must be specified.');
      }

      const interventions: any[] = [];
      if (notOpenedStreak > 5) {
        const intId = `urn:zoe:intervention:suppress_${Math.random().toString(36).substr(2, 9)}`;
        logs.push(`[Fatigue Controller] Fatigue indicators reached. Suppressing pushes: ${intId}`);

        interventions.push({
          id: intId,
          verb: 'SUPPRESS',
          rdfQuads: [
            {
              subject: intId,
              predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              object: 'http://www.w3.org/ns/odrl/2/Prohibition',
            },
            {
              subject: intId,
              predicate: 'http://www.w3.org/ns/odrl/2/action',
              object: 'urn:zoe:action:push_notification',
            },
            {
              subject: intId,
              predicate: 'http://schema.org/recipient',
              object: `urn:zoe:member:${userId}`,
            },
            {
              subject: intId,
              predicate: 'http://www.w3.org/ns/prov#wasDerivedFrom',
              object: 'urn:zoe:signal:fatigue_not_opened',
            },
          ],
        });
      }

      return { success: true, result: { interventions }, logs };
    } catch (e: any) {
      return { success: false, result: null, logs, error: e.message };
    }
  },
};

/**
 * Global registry catalog containing all process intelligence capabilities
 */
export const IntelligenceRegistry = new Map<string, IntelligenceCapability>([
  [TruexReceiptVerifier.id, TruexReceiptVerifier],
  [JtbdConformanceAuditor.id, JtbdConformanceAuditor],
  [ConceptDriftDetector.id, ConceptDriftDetector],
  [RlOrchestratorMonitor.id, RlOrchestratorMonitor],
  [ComplianceSafetyGuard.id, ComplianceSafetyGuard],
  [HabitPromptGenerator.id, HabitPromptGenerator],
  [VolunteerFitSuggester.id, VolunteerFitSuggester],
  [SpiritualRhythmTracker.id, SpiritualRhythmTracker],
  [OnCampusNavigator.id, OnCampusNavigator],
  [CareRiskEscalator.id, CareRiskEscalator],
  [EngagementFatigueController.id, EngagementFatigueController],
]);
