import {
  AGENT_NATIVE_PETRI_NET as CONFORMANCE_PETRI_NET,
  AGENT_NATIVE_INITIAL_MARKING as CONFORMANCE_INITIAL_MARKING,
  AGENT_NATIVE_FINAL_PLACES as CONFORMANCE_FINAL_PLACES,
  replayTrace as conformanceReplayTrace,
  Ocel2LogBuilder,
  parseOcel2Log,
  fuzzTrace,
  fuzzOcelLog,
} from '../conformance';

import {
  AGENT_NATIVE_PETRI_NET as SAFETY_PETRI_NET,
  PetriNetReplayer,
  TemporalSafetyChecker,
  LogFuzzer,
  OCEL2Serializer,
  ReplayMarking,
} from '../safety-constraints';

// Define structural interfaces to validate Petri Nets
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

/**
 * Validates the structural integrity and bipartiteness of a Petri Net.
 * Ensures there are no Place-to-Place or Transition-to-Transition connections.
 * Ensures all sources and targets exist and are uniquely identified.
 *
 * Ref: [conformance.test.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/__tests__/conformance.test.ts)
 */
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

describe('Pcp 2030 Process Mining Conformance and Safety Suite', () => {
  describe('1. Petri Net Schema Structure and Validation', () => {
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
        arcs: [{ source: 'p_1', target: 'p_2' }], // Place to Place
      };
      const result = validatePetriNetStructure(malformedNet);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('violating bipartiteness'))).toBe(true);
    });

    it('should catch bipartiteness violation (Transition-to-Transition connection)', () => {
      const malformedNet: PetriNetSchema = {
        places: [{ id: 'p_1' }],
        transitions: [{ id: 't_1' }, { id: 't_2' }],
        arcs: [{ source: 't_1', target: 't_2' }], // Transition to Transition
      };
      const result = validatePetriNetStructure(malformedNet);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('violating bipartiteness'))).toBe(true);
    });

    it('should reject arcs with invalid or non-existent nodes', () => {
      const malformedNet: PetriNetSchema = {
        places: [{ id: 'p_1' }],
        transitions: [{ id: 't_1' }],
        arcs: [{ source: 'p_invalid', target: 't_1' }],
      };
      const result = validatePetriNetStructure(malformedNet);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('does not exist'))).toBe(true);
    });
  });

  describe('2. Token Replay Fitness Computation', () => {
    describe('Using conformance.ts engine', () => {
      it('computes fitness = 1.0 for a happy path trace', () => {
        const trace = ['t_receive', 't_verify_zkp', 't_membrane_run', 't_complete'];
        const result = conformanceReplayTrace(
          CONFORMANCE_PETRI_NET,
          trace,
          CONFORMANCE_INITIAL_MARKING,
          CONFORMANCE_FINAL_PLACES
        );
        expect(result.fitness).toBe(1.0);
        expect(result.isConforming).toBe(true);
        expect(result.missingTokens).toBe(0);
        expect(result.remainingTokens).toBe(0);
      });

      it('computes fitness = 1.0 for a ZKP failure path trace', () => {
        const trace = ['t_receive', 't_fail_received'];
        const result = conformanceReplayTrace(
          CONFORMANCE_PETRI_NET,
          trace,
          CONFORMANCE_INITIAL_MARKING,
          CONFORMANCE_FINAL_PLACES
        );
        expect(result.fitness).toBe(1.0);
        expect(result.isConforming).toBe(true);
        expect(result.missingTokens).toBe(0);
        expect(result.remainingTokens).toBe(0);
      });

      it('computes lower fitness for an incomplete/stranded trace', () => {
        const trace = ['t_receive', 't_verify_zkp'];
        const result = conformanceReplayTrace(
          CONFORMANCE_PETRI_NET,
          trace,
          CONFORMANCE_INITIAL_MARKING,
          CONFORMANCE_FINAL_PLACES
        );
        expect(result.fitness).toBeLessThan(1.0);
        expect(result.isConforming).toBe(false);
        // Expect a missing token violation for not reaching a final place
        expect(result.missingTokens).toBeGreaterThan(0);
      });
    });

    describe('Using safety-constraints.ts PetriNetReplayer', () => {
      const replayer = new PetriNetReplayer(SAFETY_PETRI_NET);

      it('replays conforming log with 100% fitness', () => {
        const log = LogFuzzer.generateConformingLog('cmd_val', 'act_ok');
        const sequence = log.events.map((e) => e.type);
        const result = replayer.replay('cmd_val', sequence, {});
        expect(result.fitness).toBe(1.0);
        expect(result.isConforming).toBe(true);
        expect(result.missing).toBe(0);
        expect(result.remaining).toBe(0);
      });

      it('replays a blocked actor conforming log with 100% fitness', () => {
        const log = LogFuzzer.generateBlockedActorConformingLog('cmd_blocked', 'act_blocked');
        const sequence = log.events.map((e) => e.type);
        const result = replayer.replay('cmd_blocked', sequence, { p_actor_blocked: 1 });
        expect(result.fitness).toBe(1.0);
        expect(result.isConforming).toBe(true);
        expect(result.missing).toBe(0);
        expect(result.remaining).toBe(0);
      });
    });
  });

  describe('3. OCEL 2.0 Parser, Emitter and Compliant Logs', () => {
    it('successfully serializes and parses conforming OCEL logs via conformance.ts', () => {
      const builder = new Ocel2LogBuilder();
      builder.addObject('a_1', 'agent', { name: 'Pcp' });
      builder.logEvent('e_1', 't_receive', new Date(), ['a_1'], { success: true });

      const log = builder.getLog();
      expect(log['ocel:objects']['a_1']).toBeDefined();
      expect(log['ocel:events']['e_1']).toBeDefined();

      const serialized = builder.serialize();
      const parsed = parseOcel2Log(serialized);
      expect(parsed['ocel:events']['e_1']).toBeDefined();
    });

    it('successfully serializes and parses logs via safety-constraints.ts', () => {
      const log = LogFuzzer.generateConformingLog('cmd_1', 'act_1');
      const json = OCEL2Serializer.serialize(log);
      expect(typeof json).toBe('string');

      const parsed = OCEL2Serializer.deserialize(json);
      expect(parsed.events.length).toBe(11);
      expect(parsed.objects.length).toBe(3);
    });

    it('rejects malformed OCEL 2.0 logs during parsing', () => {
      expect(() => parseOcel2Log('invalid-json')).toThrow();
      expect(() => parseOcel2Log('{}')).toThrow(
        'OCEL 2.0 log is missing or has an invalid "ocel:events" field'
      );
      expect(() => OCEL2Serializer.deserialize('{}')).toThrow('Invalid OCEL 2.0 layout');
    });
  });

  describe('4. Fuzzed Log Deviations and Fuzzer Mutation Auditing', () => {
    it('mutates sequences via fuzzTrace', () => {
      const originalTrace = ['t_receive', 't_verify_zkp', 't_membrane_run'];

      const skipped = fuzzTrace(originalTrace, 'skip');
      expect(skipped.length).toBe(2);

      const duplicated = fuzzTrace(originalTrace, 'duplicate');
      expect(duplicated.length).toBe(4);

      const inserted = fuzzTrace(originalTrace, 'insert');
      expect(inserted.includes('t_unauthorized_hijack')).toBe(true);

      const swapped = fuzzTrace(originalTrace, 'swap');
      expect(swapped).not.toEqual(originalTrace);
    });

    it('fuzzes logs via fuzzOcelLog and detects deviations', () => {
      const builder = new Ocel2LogBuilder();
      builder.addObject('cmd_fuzz', 'command', {});
      builder.addObject('agent_fuzz', 'agent', {});
      builder.logEvent('e1', 't_receive', new Date(), ['cmd_fuzz', 'agent_fuzz'], {});
      builder.logEvent('e2', 't_verify_zkp', new Date(), ['cmd_fuzz', 'agent_fuzz'], {});
      builder.logEvent('e3', 't_complete', new Date(), ['cmd_fuzz', 'agent_fuzz'], {});

      const cleanLog = builder.getLog();
      const fuzzedLog = fuzzOcelLog(cleanLog, 'command', 'skip');

      // The fuzzed log will have modified event sequence
      expect(fuzzedLog).not.toEqual(cleanLog);
    });
  });

  describe('5. Safety Constraint Auditing and Violations', () => {
    it('verifies that a conforming log does not raise safety violations', () => {
      const log = LogFuzzer.generateConformingLog('cmd_safe', 'act_safe');
      const violations = TemporalSafetyChecker.verifySafety(log);
      expect(violations).toHaveLength(0);
    });

    it('detects VERIFICATION_SAFETY violations and checks absolute markdown links', () => {
      const log = LogFuzzer.generateZkpBypassViolationLog('cmd_bypass', 'act_bypass');
      const violations = TemporalSafetyChecker.verifySafety(log);

      expect(violations.length).toBeGreaterThan(0);
      const zkpViolation = violations.find((v) => v.rule === 'VERIFICATION_SAFETY');
      expect(zkpViolation).toBeDefined();

      // Ensure that the violation description contains absolute markdown link to safety-constraints.ts
      expect(zkpViolation?.description).toContain(
        '[safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts)'
      );
    });

    it('detects BLOCKED_ACTOR_SAFETY violations and checks absolute markdown links', () => {
      const log = LogFuzzer.generateBlockedActorViolationLog('cmd_blocked', 'act_blocked');
      const violations = TemporalSafetyChecker.verifySafety(log);

      expect(violations.length).toBeGreaterThan(0);
      const blockedViolation = violations.find((v) => v.rule === 'BLOCKED_ACTOR_SAFETY');
      expect(blockedViolation).toBeDefined();
      expect(blockedViolation?.description).toContain(
        '[safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts)'
      );
    });

    it('detects QUARANTINE_INVARIANT violations and checks absolute markdown links', () => {
      const log = LogFuzzer.generateMissingQuarantineViolationLog('cmd_crash', 'act_crashed');
      const violations = TemporalSafetyChecker.verifySafety(log);

      expect(violations.length).toBeGreaterThan(0);
      const quarantineViolation = violations.find((v) => v.rule === 'QUARANTINE_INVARIANT');
      expect(quarantineViolation).toBeDefined();
      expect(quarantineViolation?.description).toContain(
        '[safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts)'
      );
    });
  });
});
