import {
  checkConformance as checkAdversarialConformance,
  replayTrace as replayAdversarialTrace,
  generateFuzzedOcelLog,
  generateFuzzedOcelLogTs,
  AGENT_PETRI_NET as ADVERSARIAL_PETRI_NET,
} from '../adversarial-fuzzer';

import {
  AGENT_NATIVE_PETRI_NET as CONFORMANCE_PETRI_NET,
} from '../conformance';

import {
  createAgentNativePetriNet,
  TokenReplayChecker,
} from '../drift-detector';

import {
  generateLog,
  parseOcelLog,
  AgentExecutionTrace,
  AGENT_PETRI_NET as LOGGER_PETRI_NET,
} from '../ocel2-logger';
import { SemanticCommand } from '../../agent-native/types';

import {
  PLACES,
  TRANSITIONS,
  Transition,
  markingToVector,
  vectorToMarking,
  getIncidenceMatrix,
  TokenReplayEngine,
} from '../petri-net';

import {
  AgentNativePetriNet,
  ConformanceChecker,
  OcelFuzzer,
} from '../profiler';

import {
  AGENT_NATIVE_PETRI_NET as SAFETY_PETRI_NET,
  PetriNetReplayer,
  LogFuzzer,
  OCEL2Serializer,
  ReplayMarking,
} from '../safety-constraints';

// Petri Net Validation Interfaces
interface PetriNetPlace {
  id: string;
  label?: string;
  name?: string;
}

interface PetriNetTransition {
  id: string;
  label?: string;
  name?: string;
}

interface PetriNetArc {
  source: string;
  target: string;
  weight?: number;
}

interface PetriNetSchema {
  places: PetriNetPlace[];
  transitions: PetriNetTransition[];
  arcs: PetriNetArc[];
}

function validatePetriNetStructure(net: PetriNetSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const placeIds = new Set(net.places.map((p) => p.id));
  const transitionIds = new Set(net.transitions.map((t) => t.id));

  // Check unique IDs
  if (placeIds.size !== net.places.length) {
    errors.push('Duplicate place IDs detected.');
  }
  if (transitionIds.size !== net.transitions.length) {
    errors.push('Duplicate transition IDs detected.');
  }

  // Check bipartiteness and existence of source/target
  for (let i = 0; i < net.arcs.length; i++) {
    const arc = net.arcs[i];
    const sourceIsPlace = placeIds.has(arc.source);
    const sourceIsTransition = transitionIds.has(arc.source);
    const targetIsPlace = placeIds.has(arc.target);
    const targetIsTransition = transitionIds.has(arc.target);

    if (!sourceIsPlace && !sourceIsTransition) {
      errors.push(`Arc index ${i} source '${arc.source}' does not exist.`);
    }
    if (!targetIsPlace && !targetIsTransition) {
      errors.push(`Arc index ${i} target '${arc.target}' does not exist.`);
    }
    if (sourceIsPlace && targetIsPlace) {
      errors.push(
        `Arc index ${i} connects Place '${arc.source}' directly to Place '${arc.target}', violating bipartiteness.`
      );
    }
    if (sourceIsTransition && targetIsTransition) {
      errors.push(
        `Arc index ${i} connects Transition '${arc.source}' directly to Transition '${arc.target}', violating bipartiteness.`
      );
    }
    if (arc.weight !== undefined && arc.weight <= 0) {
      errors.push(`Arc index ${i} weight must be positive, got ${arc.weight}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Consolidated Pcp 2030 Process Mining Integration Suite', () => {
  // 1. Petri Net Schema and Structure Validation
  describe('Petri Net Structure & Incidence Equations', () => {
    it('defines correct pre-sets and post-sets for ocel2-logger transition net', () => {
      expect(LOGGER_PETRI_NET.t_receive_command).toEqual({
        inputs: ['p_start'],
        outputs: ['p_command_received'],
      });
      expect(LOGGER_PETRI_NET.t_verify_zkp).toEqual({
        inputs: ['p_command_received'],
        outputs: ['p_zkp_verified'],
      });
      expect(LOGGER_PETRI_NET.t_sign_receipt).toEqual({
        inputs: ['p_action_executed'],
        outputs: ['p_end'],
      });
    });

    it('should successfully validate the CONFORMANCE_PETRI_NET structure', () => {
      const result = validatePetriNetStructure(CONFORMANCE_PETRI_NET);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should successfully validate the SAFETY_PETRI_NET structure', () => {
      const result = validatePetriNetStructure(SAFETY_PETRI_NET);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch bipartiteness violation (Place-to-Place connection)', () => {
      const malformedNet: PetriNetSchema = {
        places: [{ id: 'p_1' }, { id: 'p_2' }],
        transitions: [{ id: 't_1' }],
        arcs: [{ source: 'p_1', target: 'p_2' }],
      };
      const result = validatePetriNetStructure(malformedNet);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('violating bipartiteness'))).toBe(true);
    });

    test('should define formal Petri Net places and transitions correctly in low-level PetriNet', () => {
      expect(PLACES).toEqual(['Queue', 'Verifying', 'Attesting', 'Signing', 'Receipts', 'Verified']);
      expect(TRANSITIONS).toEqual(['enqueue', 'verifyZkp', 'signEnclave', 'signPq', 'bindReceipt']);
    });

    test('should calculate the incidence matrix C = WPlus - WMinus correctly', () => {
      const C = getIncidenceMatrix();
      expect(C.length).toBe(6);
      expect(C[0].length).toBe(5);
      expect(C[0][0]).toBe(1);
      expect(C[0][1]).toBe(-1);
      expect(C[3][4]).toBe(-2);
    });

    test('should convert between markings and vectors correctly', () => {
      const marking = {
        Queue: 1,
        Verifying: 2,
        Attesting: 3,
        Signing: 4,
        Receipts: 5,
        Verified: 6,
      };
      const vector = markingToVector(marking);
      expect(vector).toEqual([1, 2, 3, 4, 5, 6]);

      const reconstructed = vectorToMarking(vector);
      expect(reconstructed).toEqual(marking);
    });
  });

  // 2. Token Replay & Conformance Engines
  describe('Conformance Checker Replay Engines', () => {
    it('conforms on happy_path_dispatch with fitness 1.0 using adversarial replayer', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_verify_zkp_success',
        't_membrane_request',
        't_membrane_pass',
        't_execute',
        't_complete',
      ];
      const result = replayAdversarialTrace('case_1', 'happy_path_dispatch', trace, ADVERSARIAL_PETRI_NET);

      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.deviations).toHaveLength(0);
      expect(result.missingTokens).toBe(0);
      expect(result.remainingTokens).toBe(0);
    });

    it('computes fitness of 1.0 for a perfect normal trace using drift TokenReplayChecker', () => {
      const net = createAgentNativePetriNet();
      const checker = new TokenReplayChecker(net);
      const trace = [
        'register',
        'authenticate',
        'auth_success',
        'dispatch',
        'execute_success',
        'close',
        'teardown',
      ];
      const result = checker.replayTrace(trace);

      expect(result.fitness).toBe(1.0);
      expect(result.isConforming).toBe(true);
      expect(result.missing).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('computes fitness of 1.0 for looping trace using drift TokenReplayChecker', () => {
      const net = createAgentNativePetriNet();
      const checker = new TokenReplayChecker(net);
      const trace = [
        'register',
        'authenticate',
        'auth_success',
        'dispatch',
        'execute_success',
        'close',
        'authenticate',
        'auth_success',
        'dispatch',
        'execute_success',
        'close',
        'teardown',
      ];
      const result = checker.replayTrace(trace);

      expect(result.fitness).toBe(1.0);
      expect(result.isConforming).toBe(true);
    });

    it('penalizes fitness for missing/remaining tokens on non-conforming trace using drift TokenReplayChecker', () => {
      const net = createAgentNativePetriNet();
      const checker = new TokenReplayChecker(net);
      const trace = ['register', 'dispatch', 'teardown'];
      const result = checker.replayTrace(trace);

      expect(result.fitness).toBeLessThan(1.0);
      expect(result.isConforming).toBe(false);
      expect(result.missing).toBeGreaterThan(0);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.missingTokensDetail['p_authenticated']).toBe(1);
      expect(result.remainingTokensDetail['p_executing']).toBe(1);
    });

    it('should pass cleanly for a standard successful command execution trace using low-level PetriNet TokenReplayEngine', () => {
      const engine = new TokenReplayEngine();
      const trace: Transition[] = ['enqueue', 'verifyZkp', 'signEnclave', 'signPq', 'bindReceipt'];
      const result = engine.replayTrace(trace);
      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.missing).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should pass cleanly for a state inspection bypass trace using low-level PetriNet TokenReplayEngine', () => {
      const engine = new TokenReplayEngine();
      const trace: Transition[] = ['enqueue', 'verifyZkp'];
      const result = engine.replayTrace(
        trace,
        { Queue: 0, Verifying: 0, Attesting: 0, Signing: 0, Receipts: 0, Verified: 0 },
        { Queue: 0, Verifying: 1, Attesting: 1, Signing: 0, Receipts: 0, Verified: 0 }
      );
      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
    });

    it('should detect deviations and calculate low fitness when ZKP check is skipped', () => {
      const engine = new TokenReplayEngine();
      const trace: Transition[] = ['enqueue', 'signEnclave', 'signPq', 'bindReceipt'];
      const result = engine.replayTrace(trace);
      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);
      expect(result.missing).toBeGreaterThan(0);
    });

    it('should pass conforming traces with fitness 1.0 using profiler ConformanceChecker', () => {
      const checker = new ConformanceChecker(AgentNativePetriNet);
      const baseTime = Date.now();

      const successEvents = OcelFuzzer.generateConformingTrace('req-success', 'success', baseTime);
      const successTrace = successEvents.map((e) => e.type);
      const resultSuccess = checker.replayTrace(successTrace, 'p_completed');
      expect(resultSuccess.isConforming).toBe(true);
      expect(resultSuccess.fitness).toBe(1.0);

      const deniedEvents = OcelFuzzer.generateConformingTrace('req-denied', 'denied', baseTime);
      const deniedTrace = deniedEvents.map((e) => e.type);
      const resultDenied = checker.replayTrace(deniedTrace, 'p_denied');
      expect(resultDenied.isConforming).toBe(true);
      expect(resultDenied.fitness).toBe(1.0);
    });

    it('should fail and detect deviations when steps are skipped or swapped in profiler ConformanceChecker', () => {
      const checker = new ConformanceChecker(AgentNativePetriNet);
      const baseTime = Date.now();

      const successEvents = OcelFuzzer.generateConformingTrace('req-fuzz-skip', 'success', baseTime);
      const skippedEvents = successEvents.filter((e) => e.type !== 't_verify_pass');
      const traceSkip = skippedEvents.map((e) => e.type);

      const resultSkip = checker.replayTrace(traceSkip, 'p_completed');
      expect(resultSkip.isConforming).toBe(false);
      expect(resultSkip.fitness).toBeLessThan(1.0);

      const swappedEvents = OcelFuzzer.injectDeviation(successEvents, 'swap_order');
      const traceSwap = swappedEvents.map((e) => e.type);

      const resultSwap = checker.replayTrace(traceSwap, 'p_completed');
      expect(resultSwap.isConforming).toBe(false);
      expect(resultSwap.fitness).toBeLessThan(1.0);
    });

    it('should replay a conforming safety trace with 100% fitness', () => {
      const replayer = new PetriNetReplayer(SAFETY_PETRI_NET);
      const log = LogFuzzer.generateConformingLog('cmd_201', 'act_operator');
      const sequence = log.events.map((e) => e.type);
      const initialMarking: ReplayMarking = {};
      const result = replayer.replay('cmd_201', sequence, initialMarking);

      expect(result.isConforming).toBe(true);
      expect(result.missing).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.fitness).toBe(1.0);
      expect(result.finalMarking['p_completed']).toBe(1);
    });
  });

  // 3. OCEL 2.0 Log Integrity, Generation, and Serialization
  describe('OCEL 2.0 Logs & Serialization', () => {
    it('generates a fuzzed log with scenarios represented correctly', () => {
      const log = generateFuzzedOcelLog();
      expect(log).toBeDefined();
      expect(log.objects).toBeDefined();
      expect(log.events).toBeDefined();

      const scenarios = [
        'happy_path_dispatch',
        'happy_path_inspect',
        'happy_path_skip_zkp',
        'zkp_failure',
        'membrane_failure',
        'bypass_attempt',
        'out_of_order',
        'forged_transition',
        'double_firing',
        'abrupt_termination',
        'bypass_membrane_direct_complete',
      ];

      for (const scenario of scenarios) {
        const matchingObject = Object.values(log.objects).find(
          (obj) => obj.type === 'Command' && obj.attributes.scenario === scenario
        );
        expect(matchingObject).toBeDefined();
      }
    });

    it('generates a fuzzed log ts containing agent objects', () => {
      const logTs = generateFuzzedOcelLogTs();
      expect(logTs).toBeDefined();
      expect(logTs.objects).toBeDefined();
      expect(logTs.events).toBeDefined();

      const pcpAgentObj = logTs.objects.find((o: any) => o.id === 'agent_pcp');
      expect(pcpAgentObj).toBeDefined();
    });

    it('successfully serializes and deserializes safety logs', () => {
      const log = LogFuzzer.generateConformingLog('cmd_101', 'act_gpt4');
      const json = OCEL2Serializer.serialize(log);
      expect(typeof json).toBe('string');

      const parsed = OCEL2Serializer.deserialize(json);
      expect(parsed.events.length).toBe(11);
      expect(parsed.objects.length).toBe(3);
    });

    it('should fail to deserialize invalid safety log structures', () => {
      const invalidJson = JSON.stringify({ eventTypes: [] });
      expect(() => OCEL2Serializer.deserialize(invalidJson)).toThrow(/Invalid OCEL 2.0 layout/);
    });

    it('successfully maps execution trace to ocel2-logger log objects', () => {
      const mockTimestamp = '2026-05-31T19:11:35.000Z';
      const baseCommand: SemanticCommand = {
        id: 'cmd_success_1',
        action: 'ping',
        params: { test: true },
        zkp: {
          claimId: 'claim_success_1',
          proofData: 'proof-data',
          publicSignals: ['1'],
          enclaveSignature: 'valid-sig-data',
        },
        agentMetadata: {
          id: 'agent_999',
          model: 'gpt-4o-mini',
          capabilities: ['ping', 'update_state'],
        },
      };

      const successTrace: AgentExecutionTrace = {
        command: baseCommand,
        membraneId: 'memb_prod_1',
        membraneConfig: {
          mode: 'strict',
          tenantId: 'tenant_alpha',
        },
        zkpEnforced: true,
        zkpVerified: true,
        executionSuccess: true,
        verdict: 'allow',
        receipt: {
          id: 'receipt_success_1',
          commandId: 'cmd_success_1',
          capabilityId: 'agent-action:ping',
          timestamp: mockTimestamp,
          verdict: 'allow',
          success: true,
          deltaHash: 'delta_hash_123',
          previousHash: 'prev_hash_456',
        },
        signature: {
          algorithm: 'Dilithium2',
          publicKey: 'pk_data_dilithium',
          data: 'valid-sig-data',
        },
        timestamp: mockTimestamp,
      };

      const log = generateLog([successTrace]);

      expect(log.objects[successTrace.command.id]).toBeDefined();
      expect(log.objects[successTrace.membraneId]).toBeDefined();
      expect(log.events.length).toBe(5);

      const parsed = parseOcelLog(log);
      expect(parsed.length).toBe(1);
      expect(parsed[0].command.id).toBe(successTrace.command.id);
    });
  });
});
