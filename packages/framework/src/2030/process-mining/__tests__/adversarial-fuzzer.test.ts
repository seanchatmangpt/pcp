import {
  checkConformance,
  replayTrace,
  generateFuzzedOcelLog,
  generateFuzzedOcelLogTs,
  AGENT_PETRI_NET,
} from '../adversarial-fuzzer';

describe('Adversarial Process Mining Fuzzer & Conformance Checker', () => {
  describe('Generated Fuzzed OCEL 2.0 Log Integrity', () => {
    it('should generate a valid OCEL 2.0 log containing all scenarios', () => {
      const log = generateFuzzedOcelLog();

      expect(log).toBeDefined();
      expect(log.objects).toBeDefined();
      expect(log.events).toBeDefined();

      // Check for common shared objects
      expect(log.objects['agent_pcp']).toEqual(
        expect.objectContaining({
          type: 'Agent',
          attributes: expect.objectContaining({
            model: 'Pcp-2030-ultimate',
          }),
        })
      );
      expect(log.objects['membrane_standard']).toEqual(
        expect.objectContaining({
          type: 'Membrane',
          attributes: expect.objectContaining({
            mode: 'strict',
          }),
        })
      );

      // Verify all scenarios are represented in objects
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

    it('should generate a valid OCEL 2.0 TS log containing all scenarios', () => {
      const logTs = generateFuzzedOcelLogTs();
      expect(logTs).toBeDefined();
      expect(logTs.objects).toBeDefined();
      expect(logTs.events).toBeDefined();
      expect(logTs.e2o).toBeDefined();

      const pcpAgentObj = logTs.objects.find((o) => o.id === 'agent_pcp');
      expect(pcpAgentObj).toBeDefined();
      expect(pcpAgentObj?.object_type).toBe('Agent');
    });
  });

  describe('Conformance Checker Replay Engine', () => {
    it('conforms on happy_path_dispatch with fitness 1.0', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_verify_zkp_success',
        't_membrane_request',
        't_membrane_pass',
        't_execute',
        't_complete',
      ];
      const result = replayTrace('case_1', 'happy_path_dispatch', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.deviations).toHaveLength(0);
      expect(result.missingTokens).toBe(0);
      expect(result.remainingTokens).toBe(0);
    });
  });
});
