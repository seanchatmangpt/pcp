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
  });
});
