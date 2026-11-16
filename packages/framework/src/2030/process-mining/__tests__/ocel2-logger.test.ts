import {
  generateLog,
  parseOcelLog,
  checkConformance,
  fuzzLog,
  AgentExecutionTrace,
  AGENT_PETRI_NET,
  OcelLog,
} from '../ocel2-logger';
import { SemanticCommand } from '../../agent-native/types';

describe('OCEL 2.0 Process Mining & Conformance Checker', () => {
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

  const zkpSkippedTrace: AgentExecutionTrace = {
    command: {
      ...baseCommand,
      id: 'cmd_zkp_skipped',
    },
    membraneId: 'memb_prod_1',
    membraneConfig: {
      mode: 'strict',
      tenantId: 'tenant_alpha',
    },
    zkpEnforced: false,
    zkpVerified: false,
    executionSuccess: true,
    verdict: 'allow',
    receipt: {
      id: 'receipt_zkp_skipped',
      commandId: 'cmd_zkp_skipped',
      capabilityId: 'agent-action:ping',
      timestamp: mockTimestamp,
      verdict: 'allow',
      success: true,
      deltaHash: 'delta_hash_789',
      previousHash: 'delta_hash_123',
    },
    timestamp: mockTimestamp,
  };

  const zkpFailedTrace: AgentExecutionTrace = {
    command: {
      ...baseCommand,
      id: 'cmd_zkp_fail',
      zkp: {
        ...baseCommand.zkp,
        claimId: 'claim_failed_1',
      },
    },
    membraneId: 'memb_prod_1',
    membraneConfig: {
      mode: 'strict',
      tenantId: 'tenant_alpha',
    },
    zkpEnforced: true,
    zkpVerified: false,
    zkpError: 'Invalid proof parameter',
    executionSuccess: false,
    verdict: 'deny',
    timestamp: mockTimestamp,
  };

  const membraneDeniedTrace: AgentExecutionTrace = {
    command: {
      ...baseCommand,
      id: 'cmd_memb_deny',
    },
    membraneId: 'memb_prod_1',
    membraneConfig: {
      mode: 'strict',
      tenantId: 'tenant_alpha',
    },
    zkpEnforced: true,
    zkpVerified: true,
    executionSuccess: false,
    verdict: 'deny',
    timestamp: mockTimestamp,
  };

  const actionFailedTrace: AgentExecutionTrace = {
    command: {
      ...baseCommand,
      id: 'cmd_action_fail',
    },
    membraneId: 'memb_prod_1',
    membraneConfig: {
      mode: 'strict',
      tenantId: 'tenant_alpha',
    },
    zkpEnforced: true,
    zkpVerified: true,
    executionSuccess: false,
    verdict: 'allow',
    error: 'Action timed out',
    timestamp: mockTimestamp,
  };

  describe('Petri Net Schema', () => {
    it('defines correct pre-sets and post-sets for agent execution transitions', () => {
      expect(AGENT_PETRI_NET.t_receive_command).toEqual({
        inputs: ['p_start'],
        outputs: ['p_command_received'],
      });
      expect(AGENT_PETRI_NET.t_verify_zkp).toEqual({
        inputs: ['p_command_received'],
        outputs: ['p_zkp_verified'],
      });
      expect(AGENT_PETRI_NET.t_sign_receipt).toEqual({
        inputs: ['p_action_executed'],
        outputs: ['p_end'],
      });
    });
  });

  describe('OCEL 2.0 Log Generator & Parser', () => {
    it('successfully maps successful execution trace into objects and events', () => {
      const log = generateLog([successTrace]);

      // Verify Objects
      expect(log.objects[successTrace.command.id]).toBeDefined();
      expect(log.objects[successTrace.command.id].type).toBe('Command');
      expect(log.objects[successTrace.membraneId]).toBeDefined();
      expect(log.objects[successTrace.membraneId].type).toBe('Membrane');

      const receiptId = successTrace.receipt?.id || '';
      expect(log.objects[receiptId]).toBeDefined();
      expect(log.objects[receiptId].type).toBe('Receipt');
      expect(log.objects[receiptId].attributes.verdict).toBe('allow');

      const sigId = `sig_${successTrace.command.id}`;
      expect(log.objects[sigId]).toBeDefined();
      expect(log.objects[sigId].type).toBe('Signature');
      expect(log.objects[sigId].attributes.algorithm).toBe('Dilithium2');

      // Verify absolute markdown links in spec attributes
      expect(log.objects[successTrace.command.id].attributes.specLink).toContain(
        'file:///Users/sac/pcpapp/'
      );
      expect(log.objects[successTrace.membraneId].attributes.specLink).toContain(
        'file:///Users/sac/pcpapp/'
      );

      // Verify Events
      expect(log.events.length).toBe(5);
      const activities = log.events.map((e) => e.activity);
      expect(activities).toEqual([
        't_receive_command',
        't_verify_zkp',
        't_enter_membrane',
        't_execute_action',
        't_sign_receipt',
      ]);

      // Ensure every event contains the absolute spec reference link
      for (const event of log.events) {
        expect(event.vmap.refLink).toContain(
          'file:///Users/sac/pcpapp/src/framework/2030/process-mining/ocel2-logger.ts'
        );
      }
    });

    it('round-trips logs correctly through parseOcelLog', () => {
      const traces = [
        successTrace,
        zkpSkippedTrace,
        zkpFailedTrace,
        membraneDeniedTrace,
        actionFailedTrace,
      ];
      const log = generateLog(traces);
      const parsed = parseOcelLog(log);

      expect(parsed.length).toBe(traces.length);

      const parsedSuccess = parsed.find((t) => t.command.id === successTrace.command.id);
      expect(parsedSuccess).toBeDefined();
      expect(parsedSuccess?.zkpEnforced).toBe(true);
      expect(parsedSuccess?.zkpVerified).toBe(true);
      expect(parsedSuccess?.executionSuccess).toBe(true);
      expect(parsedSuccess?.verdict).toBe('allow');
      expect(parsedSuccess?.signature?.algorithm).toBe('Dilithium2');

      const parsedSkipped = parsed.find((t) => t.command.id === zkpSkippedTrace.command.id);
      expect(parsedSkipped?.zkpEnforced).toBe(false);
      expect(parsedSkipped?.executionSuccess).toBe(true);

      const parsedZkpFailed = parsed.find((t) => t.command.id === zkpFailedTrace.command.id);
      expect(parsedZkpFailed?.zkpVerified).toBe(false);
      expect(parsedZkpFailed?.verdict).toBe('deny');
      expect(parsedZkpFailed?.executionSuccess).toBe(false);
    });
  });
});
