import {
  AGENT_NATIVE_PETRI_NET,
  PetriNetReplayer,
  TemporalSafetyChecker,
  LogFuzzer,
  OCEL2Serializer,
  ReplayMarking,
} from '../safety-constraints';

describe('Pcp 2030 Process Mining Safety Constraints', () => {
  const replayer = new PetriNetReplayer(AGENT_NATIVE_PETRI_NET);

  describe('OCEL 2.0 Parser and Serializer', () => {
    it('should successfully serialize and deserialize conforming logs', () => {
      const log = LogFuzzer.generateConformingLog('cmd_101', 'act_gpt4');
      const json = OCEL2Serializer.serialize(log);
      expect(typeof json).toBe('string');

      const parsed = OCEL2Serializer.deserialize(json);
      expect(parsed.events.length).toBe(11);
      expect(parsed.objects.length).toBe(3);
      expect(parsed.eventTypes.length).toBe(23);
      expect(parsed.objectTypes.length).toBe(3);

      const cmdObj = parsed.objects.find((o) => o.id === 'cmd_101');
      expect(cmdObj).toBeDefined();
      expect(cmdObj?.type).toBe('command');
    });

    it('should fail to deserialize invalid structures', () => {
      const invalidJson = JSON.stringify({ eventTypes: [] }); // missing other required collections
      expect(() => OCEL2Serializer.deserialize(invalidJson)).toThrow(/Invalid OCEL 2.0 layout/);
    });
  });

  describe('Token-Game Replay Conformance Checker', () => {
    it('should replay a conforming trace with 100% fitness', () => {
      const log = LogFuzzer.generateConformingLog('cmd_201', 'act_operator');
      const sequence = log.events.map((e) => e.type);

      // Start with initial marking of p_received having no tokens, as T_RECEIVE_COMMAND generates it.
      // Environment marking contains no blocked actor.
      const initialMarking: ReplayMarking = {};
      const result = replayer.replay('cmd_201', sequence, initialMarking);

      expect(result.isConforming).toBe(true);
      expect(result.missing).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.fitness).toBe(1.0);
      expect(result.finalMarking['p_completed']).toBe(1);
    });

    it('should detect a ZKP bypass deviation and compute low fitness', () => {
      const log = LogFuzzer.generateZkpBypassViolationLog('cmd_202', 'act_rogue');
      const sequence = log.events.map((e) => e.type);

      const initialMarking: ReplayMarking = {};
      const result = replayer.replay('cmd_202', sequence, initialMarking);

      // Replayer will detect missing tokens at T_START_EXECUTION because trajectory validation states weren't reached.
      expect(result.isConforming).toBe(false);
      expect(result.missing).toBeGreaterThan(0);
      expect(result.fitness).toBeLessThan(1.0);
      expect(result.finalMarking['p_zkp_failed']).toBe(1); // stranded token
    });

    it('should successfully replay a conforming blocked actor intercept trace', () => {
      const log = LogFuzzer.generateBlockedActorConformingLog('cmd_203', 'act_blocked_agent');
      const sequence = log.events.map((e) => e.type);

      // Actor is blocked, so p_actor_blocked starts with 1 token in the initial marking.
      const initialMarking: ReplayMarking = { p_actor_blocked: 1 };
      const result = replayer.replay('cmd_203', sequence, initialMarking);

      expect(result.isConforming).toBe(true);
      expect(result.missing).toBe(0);
      // actor blocked loopback token is preserved, but since it is excluded from remaining tokens, fitness is 1
      expect(result.remaining).toBe(0);
      expect(result.fitness).toBe(1.0);
      expect(result.finalMarking['p_completed']).toBe(1);
      expect(result.finalMarking['p_actor_blocked']).toBe(1);
    });
  });

  describe('Temporal Logic Safety Property Checker', () => {
    it('should return no violations on a fully conforming log', () => {
      const log = LogFuzzer.generateConformingLog('cmd_301', 'act_agent');
      const violations = TemporalSafetyChecker.verifySafety(log);
      expect(violations.length).toBe(0);
    });

    it('should detect VERIFICATION_SAFETY violation when ZKP fails but execution occurs', () => {
      const log = LogFuzzer.generateZkpBypassViolationLog('cmd_302', 'act_agent');
      const violations = TemporalSafetyChecker.verifySafety(log);

      expect(violations.length).toBeGreaterThan(0);
      const verificationViolation = violations.find((v) => v.rule === 'VERIFICATION_SAFETY');
      expect(verificationViolation).toBeDefined();
      expect(verificationViolation?.description).toContain(
        'experienced a ZKP verification failure'
      );
      // Verify absolute markdown link is present in the description
      expect(verificationViolation?.description).toContain(
        '[safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts)'
      );
    });

    it('should detect BLOCKED_ACTOR_SAFETY violation when blocked actor commands are executed', () => {
      const log = LogFuzzer.generateBlockedActorViolationLog('cmd_303', 'act_blocked_agent');
      const violations = TemporalSafetyChecker.verifySafety(log);

      expect(violations.length).toBeGreaterThan(0);
      const blockedViolation = violations.find((v) => v.rule === 'BLOCKED_ACTOR_SAFETY');
      expect(blockedViolation).toBeDefined();
      expect(blockedViolation?.description).toContain(
        'Blocked actor act_blocked_agent executed command cmd_303'
      );
      expect(blockedViolation?.description).toContain(
        '[safety-constraints.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/safety-constraints.ts)'
      );
    });

    it('should detect BLOCKED_ACTOR_SAFETY violation when command on blocked actor finishes without intercept/refusal', () => {
      // Modify a conforming log to belong to a blocked actor without intercept events
      const log = LogFuzzer.generateConformingLog('cmd_304', 'act_blocked_no_intercept');
      const actorObj = log.objects.find((o) => o.id === 'act_blocked_no_intercept');
      if (actorObj) {
        const blockedAttr = actorObj.attributes.find((a) => a.name === 'blocked');
        if (blockedAttr) blockedAttr.value = true; // Force block
      }

      const violations = TemporalSafetyChecker.verifySafety(log);
      expect(violations.length).toBeGreaterThan(0);
      const blockedViolation = violations.find((v) => v.rule === 'BLOCKED_ACTOR_SAFETY');
      expect(blockedViolation).toBeDefined();
    });

    it('should detect QUARANTINE_INVARIANT violation when execution crashes but is not quarantined', () => {
      const log = LogFuzzer.generateMissingQuarantineViolationLog('cmd_305', 'act_agent');
      const violations = TemporalSafetyChecker.verifySafety(log);

      expect(violations.length).toBeGreaterThan(0);
      const quarantineViolation = violations.find((v) => v.rule === 'QUARANTINE_INVARIANT');
      expect(quarantineViolation).toBeDefined();
      expect(quarantineViolation?.description).toContain(
        'Execution crashed for command cmd_305, but no quarantine'
      );
    });

    it('should detect LIVENESS_ORDER violation if execution begins before verification or membrane check', () => {
      // Create a log where execution begins immediately before verification
      const log = LogFuzzer.generateConformingLog('cmd_306', 'act_agent');
      // Relocate the execution start event before ZKP success in the array
      const startExecutionIdx = log.events.findIndex((e) => e.type === 'T_START_EXECUTION');
      const startZkpIdx = log.events.findIndex((e) => e.type === 'T_ZKP_SUCCESS');

      if (startExecutionIdx !== -1 && startZkpIdx !== -1) {
        // Swap execution start timestamp to be earlier than ZKP success
        const execTime = log.events[startExecutionIdx].time;
        log.events[startExecutionIdx].time = log.events[startZkpIdx].time;
        log.events[startZkpIdx].time = execTime;
      }

      const violations = TemporalSafetyChecker.verifySafety(log);
      expect(violations.length).toBeGreaterThan(0);
      const orderViolation = violations.find((v) => v.rule === 'LIVENESS_ORDER');
      expect(orderViolation).toBeDefined();
    });
  });

  describe('Fuzz Testing Log Streams', () => {
    it('should verify fuzzed stream classifications against expected safety outcomes', () => {
      const totalFuzzCases = 50;
      let detectedViolations = 0;

      for (let i = 0; i < totalFuzzCases; i++) {
        const cmdId = `fuzz_cmd_${i}`;
        const actorId = `fuzz_actor_${i}`;
        const coin = Math.random();

        let log;
        let expectedViolation = false;

        if (coin < 0.25) {
          log = LogFuzzer.generateConformingLog(cmdId, actorId);
        } else if (coin < 0.5) {
          log = LogFuzzer.generateZkpBypassViolationLog(cmdId, actorId);
          expectedViolation = true;
        } else if (coin < 0.75) {
          log = LogFuzzer.generateBlockedActorViolationLog(cmdId, actorId);
          expectedViolation = true;
        } else {
          log = LogFuzzer.generateMissingQuarantineViolationLog(cmdId, actorId);
          expectedViolation = true;
        }

        const violations = TemporalSafetyChecker.verifySafety(log);
        if (violations.length > 0) {
          detectedViolations++;
        }

        expect(violations.length > 0).toBe(expectedViolation);
      }

      expect(detectedViolations).toBeGreaterThan(0);
    });
  });
});
