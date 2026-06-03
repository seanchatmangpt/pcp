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

    it('conforms on happy_path_inspect with fitness 1.0', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_verify_zkp_success',
        't_skip_membrane',
        't_complete',
      ];
      const result = replayTrace('case_2', 'happy_path_inspect', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.deviations).toHaveLength(0);
    });

    it('conforms on happy_path_skip_zkp with fitness 1.0', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_skip_zkp',
        't_membrane_request',
        't_membrane_pass',
        't_execute',
        't_complete',
      ];
      const result = replayTrace('case_3', 'happy_path_skip_zkp', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.deviations).toHaveLength(0);
    });

    it('conforms on handled zkp_failure with fitness 1.0', () => {
      const trace = ['t_receive', 't_enqueue', 't_verify_zkp_fail'];
      const result = replayTrace('case_4', 'zkp_failure', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.deviations).toHaveLength(0);
      expect(result.finalMarking['p_aborted']).toBe(0); // final place is consumed
    });

    it('conforms on handled membrane_failure with fitness 1.0', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_verify_zkp_success',
        't_membrane_request',
        't_membrane_fail',
      ];
      const result = replayTrace('case_5', 'membrane_failure', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.deviations).toHaveLength(0);
    });

    it('detects ZKP & Membrane Bypass (bypass_attempt) deviation', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_execute', // bypasses zkp validation and membrane approval
        't_complete',
      ];
      const result = replayTrace('case_6', 'bypass_attempt', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);

      const missingMembraneToken = result.deviations.find(
        (d) => d.type === 'MISSING_TOKEN' && d.placeId === 'p_membrane_approved'
      );
      expect(missingMembraneToken).toBeDefined();

      const remainingZkpToken = result.deviations.find(
        (d) => d.type === 'REMAINING_TOKEN' && d.placeId === 'p_zkp_pending'
      );
      expect(remainingZkpToken).toBeDefined();
    });

    it('detects out-of-order execution deviation', () => {
      const trace = [
        't_receive',
        't_execute', // executes before enqueueing and zkp verification
        't_enqueue',
        't_verify_zkp_success',
        't_complete',
      ];
      const result = replayTrace('case_7', 'out_of_order', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);
      expect(result.deviations.some((d) => d.type === 'MISSING_TOKEN')).toBe(true);
      expect(result.deviations.some((d) => d.type === 'REMAINING_TOKEN')).toBe(true);
    });

    it('detects forged transitions', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_forged_hack', // forged transition
        't_complete',
      ];
      const result = replayTrace('case_8', 'forged_transition', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);

      const unexpectedDev = result.deviations.find(
        (d) => d.type === 'UNEXPECTED_TRANSITION' && d.transitionId === 't_forged_hack'
      );
      expect(unexpectedDev).toBeDefined();
    });

    it('detects double-firing / replay attacks', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_verify_zkp_success',
        't_membrane_request',
        't_membrane_pass',
        't_execute',
        't_execute', // fired twice
        't_complete',
      ];
      const result = replayTrace('case_9', 'double_firing', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);

      const missingTokenDev = result.deviations.find(
        (d) => d.type === 'MISSING_TOKEN' && d.placeId === 'p_membrane_approved'
      );
      expect(missingTokenDev).toBeDefined();

      const remainingTokenDev = result.deviations.find(
        (d) => d.type === 'REMAINING_TOKEN' && d.placeId === 'p_executing'
      );
      expect(remainingTokenDev).toBeDefined();
    });

    it('detects abrupt termination', () => {
      const trace = ['t_receive', 't_enqueue'];
      const result = replayTrace('case_10', 'abrupt_termination', trace, AGENT_PETRI_NET);

      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);

      const incompleteDev = result.deviations.find(
        (d) => d.type === 'MISSING_TOKEN' && d.placeId === 'p_completed'
      );
      expect(incompleteDev).toBeDefined();

      const remainingDev = result.deviations.find(
        (d) => d.type === 'REMAINING_TOKEN' && d.placeId === 'p_zkp_pending'
      );
      expect(remainingDev).toBeDefined();
    });

    it('detects membrane bypass with direct complete', () => {
      const trace = [
        't_receive',
        't_enqueue',
        't_verify_zkp_success',
        't_complete', // bypasses membrane and execution entirely
      ];
      const result = replayTrace(
        'case_11',
        'bypass_membrane_direct_complete',
        trace,
        AGENT_PETRI_NET
      );

      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);

      const missingExecToken = result.deviations.find(
        (d) => d.type === 'MISSING_TOKEN' && d.placeId === 'p_executing'
      );
      expect(missingExecToken).toBeDefined();

      const remainingZkpToken = result.deviations.find(
        (d) => d.type === 'REMAINING_TOKEN' && d.placeId === 'p_zkp_verified'
      );
      expect(remainingZkpToken).toBeDefined();
    });
  });

  describe('End-to-End Conformance Verification on Fuzzed Log Stream', () => {
    it('should parse the fuzzed stream and flag all adversarial deviations correctly', () => {
      const fuzzedLog = generateFuzzedOcelLog();
      const report = checkConformance(fuzzedLog);

      expect(report.isConforming).toBe(false); // At least one case is adversarial

      const cases = Object.values(report.cases);

      // Verify conforming happy path scenarios
      const happyPathDispatch = cases.find((c) => c.scenario === 'happy_path_dispatch');
      expect(happyPathDispatch?.isConforming).toBe(true);
      expect(happyPathDispatch?.fitness).toBe(1.0);

      const happyPathInspect = cases.find((c) => c.scenario === 'happy_path_inspect');
      expect(happyPathInspect?.isConforming).toBe(true);
      expect(happyPathInspect?.fitness).toBe(1.0);

      const happyPathSkipZkp = cases.find((c) => c.scenario === 'happy_path_skip_zkp');
      expect(happyPathSkipZkp?.isConforming).toBe(true);
      expect(happyPathSkipZkp?.fitness).toBe(1.0);

      const zkpFailure = cases.find((c) => c.scenario === 'zkp_failure');
      expect(zkpFailure?.isConforming).toBe(true);
      expect(zkpFailure?.fitness).toBe(1.0);

      const membraneFailure = cases.find((c) => c.scenario === 'membrane_failure');
      expect(membraneFailure?.isConforming).toBe(true);
      expect(membraneFailure?.fitness).toBe(1.0);

      // Verify non-conforming adversarial scenarios
      const bypassAttempt = cases.find((c) => c.scenario === 'bypass_attempt');
      expect(bypassAttempt?.isConforming).toBe(false);
      expect(bypassAttempt?.fitness).toBeLessThan(1.0);

      const outOfOrder = cases.find((c) => c.scenario === 'out_of_order');
      expect(outOfOrder?.isConforming).toBe(false);
      expect(outOfOrder?.fitness).toBeLessThan(1.0);

      const forgedTransition = cases.find((c) => c.scenario === 'forged_transition');
      expect(forgedTransition?.isConforming).toBe(false);
      expect(forgedTransition?.fitness).toBeLessThan(1.0);

      const doubleFiring = cases.find((c) => c.scenario === 'double_firing');
      expect(doubleFiring?.isConforming).toBe(false);
      expect(doubleFiring?.fitness).toBeLessThan(1.0);

      const abruptTermination = cases.find((c) => c.scenario === 'abrupt_termination');
      expect(abruptTermination?.isConforming).toBe(false);
      expect(abruptTermination?.fitness).toBeLessThan(1.0);

      const bypassMembrane = cases.find((c) => c.scenario === 'bypass_membrane_direct_complete');
      expect(bypassMembrane?.isConforming).toBe(false);
      expect(bypassMembrane?.fitness).toBeLessThan(1.0);
    });
  });
});
