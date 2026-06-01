import { Membrane } from '../../../membrane/membrane';
import { AgentNativeInterface } from '../interface';
import { SemanticCommand, StateInspectionRequest } from '../types';

describe('AgentNativeInterface', () => {
  let membrane: Membrane;
  let agentInterface: AgentNativeInterface;
  let initialState: any;

  const validZkp = {
    claimId: '',
    proofData: JSON.stringify({
      pi_a: ['11883344556677889900112233', '22883344556677889900112233', '1'],
      pi_b: [
        ['33883344556677889900112233', '44883344556677889900112233'],
        ['55883344556677889900112233', '66883344556677889900112233'],
        ['1', '0'],
      ],
      pi_c: ['77883344556677889900112233', '88883344556677889900112233', '1'],
    }),
    publicSignals: ['1'],
    enclaveSignature: 'valid-signature',
  };

  beforeEach(() => {
    membrane = new Membrane({ mode: 'strict' });
    initialState = {
      user: {
        id: 'user_123',
        profile: {
          name: 'Pcp',
          email: 'pcp@example.com',
        },
      },
      settings: {
        theme: 'dark',
      },
    };
    agentInterface = new AgentNativeInterface(membrane, initialState, {
      enforceZkp: true,
      membraneId: 'test-membrane',
    });
  });

  describe('inspectState', () => {
    it('should allow inspecting state with a valid ZKP', async () => {
      const request: StateInspectionRequest = {
        path: 'user.profile.name',
        zkp: {
          ...validZkp,
          claimId: 'claim_1',
        },
      };

      const result = await agentInterface.inspectState(request);
      expect(result).toBe('Pcp');
    });

    it('should throw error if ZKP verification fails', async () => {
      const request: StateInspectionRequest = {
        path: 'user.profile.name',
        zkp: {
          ...validZkp,
          claimId: 'claim_1',
          proofData: '', // Empty proof data causes failure
          publicSignals: [],
        },
      };

      await expect(agentInterface.inspectState(request)).rejects.toThrow(
        'ZKP Verification failed for path: user.profile.name'
      );
    });

    it('should resolve deep paths', async () => {
      const request: StateInspectionRequest = {
        path: 'settings.theme',
        zkp: {
          ...validZkp,
          claimId: 'claim_2',
        },
      };

      const result = await agentInterface.inspectState(request);
      expect(result).toBe('dark');
    });

    it('should return undefined for non-existent paths', async () => {
      const request: StateInspectionRequest = {
        path: 'non.existent.path',
        zkp: {
          ...validZkp,
          claimId: 'claim_3',
        },
      };

      const result = await agentInterface.inspectState(request);
      expect(result).toBeUndefined();
    });

    it('should skip ZKP verification if enforceZkp is false', async () => {
      const relaxedInterface = new AgentNativeInterface(membrane, initialState, {
        enforceZkp: false,
        membraneId: 'test-membrane',
      });

      const request: StateInspectionRequest = {
        path: 'user.profile.name',
        zkp: {
          ...validZkp,
          claimId: 'invalid_claim',
          proofData: '',
          publicSignals: [],
        },
      };

      const result = await relaxedInterface.inspectState(request);
      expect(result).toBe('Pcp');
    });
  });

  describe('dispatch', () => {
    it('should successfully dispatch a semantic command with valid ZKP', async () => {
      const command: SemanticCommand = {
        id: 'cmd_1',
        action: 'ping',
        params: {},
        zkp: {
          ...validZkp,
          claimId: 'claim_4',
        },
      };

      const result = await agentInterface.dispatch(command);
      expect(result.success).toBe(true);
      expect(result.result).toEqual(
        expect.objectContaining({
          pong: true,
          version: '2030.1.1-ultimate',
        })
      );
      expect(result.verdict).toBe('allow');
    });

    it('should fail dispatch if ZKP verification fails', async () => {
      const command: SemanticCommand = {
        id: 'cmd_2',
        action: 'ping',
        params: {},
        zkp: {
          ...validZkp,
          claimId: 'claim_4',
          proofData: '', // Invalid proof data
          publicSignals: [],
        },
      };

      const result = await agentInterface.dispatch(command);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ZKP Authorization failed');
    });

    it('should execute update_state semantic action', async () => {
      const command: SemanticCommand = {
        id: 'cmd_3',
        action: 'update_state',
        params: {
          path: 'settings.theme',
          value: 'light',
        },
        zkp: {
          ...validZkp,
          claimId: 'claim_5',
        },
      };

      const result = await agentInterface.dispatch(command);
      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        status: 'updated',
        path: 'settings.theme',
        value: 'light',
      });

      const checkRequest: StateInspectionRequest = {
        path: 'settings.theme',
        zkp: {
          ...validZkp,
          claimId: 'claim_check_1',
        },
      };
      const themeVal = await agentInterface.inspectState(checkRequest);
      expect(themeVal).toBe('light');
    });

    it('should handle non-existent actions', async () => {
      const command: SemanticCommand = {
        id: 'cmd_4',
        action: 'unknown_action',
        params: { foo: 'bar' },
        zkp: {
          ...validZkp,
          claimId: 'claim_6',
        },
      };

      const result = await agentInterface.dispatch(command);
      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        status: 'acknowledged',
        action: 'unknown_action',
        params: { foo: 'bar' },
      });
    });

    it('should throw error if update_state path is invalid', async () => {
      const command: SemanticCommand = {
        id: 'cmd_5',
        action: 'update_state',
        params: {
          path: 'invalid.path',
          value: 'val',
        },
        zkp: {
          ...validZkp,
          claimId: 'claim_7',
        },
      };

      const result = await agentInterface.dispatch(command);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Target path not found: invalid.path');
    });

    it('should use membrane to govern execution', async () => {
      // Register an interceptor that denies all agent actions
      membrane.interceptors.register(async (ctx) => {
        if (ctx.capabilityId.startsWith('agent-action:')) {
          return false;
        }
        return true;
      });

      const command: SemanticCommand = {
        id: 'cmd_6',
        action: 'ping',
        params: {},
        zkp: {
          ...validZkp,
          claimId: 'claim_8',
        },
      };

      const result = await agentInterface.dispatch(command);
      expect(result.success).toBe(false);
      expect(result.verdict).toBe('deny');
      expect(result.error).toBe('Denied by membrane');
    });
  });

  describe('Hardening and Security Regulations', () => {
    it('verifies prototype pollution rejection on inspectState and update_state', async () => {
      // Test inspectState pollution attempt
      const inspectRequest: StateInspectionRequest = {
        path: '__proto__.polluted',
        zkp: {
          ...validZkp,
          claimId: 'claim_pollute_inspect',
        },
      };
      await expect(agentInterface.inspectState(inspectRequest)).rejects.toThrow(
        /Access to prototype-modifying keys is forbidden/
      );

      // Test dispatch update_state pollution attempt
      const command: SemanticCommand = {
        id: 'cmd_pollute_dispatch',
        action: 'update_state',
        params: {
          path: '__proto__.polluted',
          value: 'INJECTED_VALUE',
        },
        zkp: {
          ...validZkp,
          claimId: 'claim_pollute_dispatch',
        },
      };
      const result = await agentInterface.dispatch(command);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access to prototype-modifying keys is forbidden/);
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('verifies deep clone isolation of input state, parameter, and inspect result', async () => {
      // 1. Verify input state is cloned in constructor (initialState shouldn't be affected by updates)
      const command: SemanticCommand = {
        id: 'cmd_theme_update',
        action: 'update_state',
        params: {
          path: 'settings.theme',
          value: 'light',
        },
        zkp: {
          ...validZkp,
          claimId: 'claim_theme_update',
        },
      };
      await agentInterface.dispatch(command);
      expect(initialState.settings.theme).toBe('dark'); // Initial state object remains untouched

      // 2. Verify inspection result is a deep clone (mutating the returned reference doesn't affect internal state)
      const inspectRequest: StateInspectionRequest = {
        path: 'user.profile',
        zkp: {
          ...validZkp,
          claimId: 'claim_profile_inspect',
        },
      };
      const profile = await agentInterface.inspectState(inspectRequest);
      expect(profile.name).toBe('Pcp');
      profile.name = 'compromised_value';

      const verifyRequest: StateInspectionRequest = {
        path: 'user.profile.name',
        zkp: {
          ...validZkp,
          claimId: 'claim_verify_name',
        },
      };
      const verifyName = await agentInterface.inspectState(verifyRequest);
      expect(verifyName).toBe('Pcp'); // Internal name is isolated and remains 'Pcp'
    });

    it('verifies sequential queue execution prevents out-of-order execution', async () => {
      // We will register a membrane interceptor that delays the first command execution.
      // With sequential execution, the first command must fully finish (including its delay)
      // before the second command runs.

      const updateCommand1: SemanticCommand = {
        id: 'cmd_slow',
        action: 'update_state',
        params: {
          path: 'settings.theme',
          value: 'blue',
        },
        zkp: {
          ...validZkp,
          claimId: 'claim_slow',
        },
      };

      const updateCommand2: SemanticCommand = {
        id: 'cmd_fast',
        action: 'update_state',
        params: {
          path: 'settings.theme',
          value: 'green',
        },
        zkp: {
          ...validZkp,
          claimId: 'claim_fast',
        },
      };

      // Set up a dynamic delay in membrane interceptor
      membrane.interceptors.register(async (ctx) => {
        if (ctx.commandId === 'cmd_slow') {
          await new Promise((r) => setTimeout(r, 50));
        }
        return true;
      });

      // Dispatch them concurrently
      const promiseSlow = agentInterface.dispatch(updateCommand1);
      const promiseFast = agentInterface.dispatch(updateCommand2);

      await Promise.all([promiseSlow, promiseFast]);

      // If they ran sequentially, cmd_slow executed first, then cmd_fast executed.
      // Therefore, the final state must be 'green' (cmd_fast's value).
      const verifyRequest: StateInspectionRequest = {
        path: 'settings.theme',
        zkp: {
          ...validZkp,
          claimId: 'claim_verify_theme',
        },
      };
      const themeVal = await agentInterface.inspectState(verifyRequest);
      expect(themeVal).toBe('green');
    });
  });
});
