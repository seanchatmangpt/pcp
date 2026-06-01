import { Membrane } from '../../../membrane/membrane';
import { AgentNativeInterface } from '../interface';
import { SemanticCommand, StateInspectionRequest } from '../types';

describe('AgentNativeInterface Resiliency & Threat Model Simulator', () => {
  let membrane: Membrane;
  let agentInterface: AgentNativeInterface;
  let initialState: any;

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
      enforceZkp: false,
      membraneId: 'test-membrane',
    });
  });

  describe('Scenario 1: Parameter Injection and Prototype Pollution via Unchecked Path Resolution', () => {
    it('demonstrates that prototype pollution is blocked and fails safely', async () => {
      // Ensure the prototype is clean before test
      delete (Object.prototype as any).polluted;
      expect((Object.prototype as any).polluted).toBeUndefined();

      const command: SemanticCommand = {
        id: 'cmd_pollution',
        action: 'update_state',
        params: {
          path: '__proto__.polluted',
          value: 'INJECTED_VALUE',
        },
        zkp: {
          claimId: 'claim_pollution',
          proofData: 'valid_proof',
          publicSignals: ['1'],
          enclaveSignature: 'valid-signature',
        },
      };

      const result = await agentInterface.dispatch(command);
      console.log('DEBUG Scenario 1 result:', JSON.stringify(result, null, 2));

      // Verify the attack was blocked and failed safely
      expect(result.success).toBe(false);
      expect(result.error).toContain('Prototype pollution attempt detected');
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('blocks prototype pollution in inspectState', async () => {
      const request: StateInspectionRequest = {
        path: 'user.__proto__.polluted',
        zkp: {
          claimId: 'claim_pollution_inspect',
          proofData: 'valid_proof',
          publicSignals: ['1'],
          enclaveSignature: 'valid-signature',
        },
      };

      await expect(agentInterface.inspectState(request)).rejects.toThrow(
        'Prototype pollution attempt detected in path: user.__proto__.polluted'
      );
    });
  });

  describe('Scenario 2: State Information Disclosure & Read Boundary Bypass via Object Reference Leakage', () => {
    it('demonstrates that returning deep-cloned state prevents bypassing the operational membrane', async () => {
      const request: StateInspectionRequest = {
        path: 'user.profile',
        zkp: {
          claimId: 'claim_leak',
          proofData: 'valid_proof',
          publicSignals: ['1'],
          enclaveSignature: 'valid-signature',
        },
      };

      // The inspection request now returns a deep clone instead of a raw object reference
      const profileRef = await agentInterface.inspectState(request);
      expect(profileRef).toBeDefined();
      expect(profileRef.name).toBe('Pcp');

      // An external actor/agent attempts to modify the returned object directly in-memory
      profileRef.name = 'COMPROMISED';

      // Verify that the internal state of the framework was NOT mutated directly
      expect(initialState.user.profile.name).toBe('Pcp');
      expect(membrane.receipts.getHistory().length).toBe(0); // No receipts were generated because no internal mutation occurred
    });
  });

  describe('Scenario 3: Asynchronous Boundary Re-entry and Execution Order Vulnerability', () => {
    it('demonstrates how transaction queues serialize execution to prevent inconsistent state', async () => {
      // Create a slower path verification scenario by registering an interceptor that mimics latency
      // and a fast command that updates state.
      // If we execute them concurrently, we can have race conditions or out-of-order execution.

      const updateCommand1: SemanticCommand = {
        id: 'cmd_slow',
        action: 'update_state',
        params: {
          path: 'settings.theme',
          value: 'blue',
        },
        zkp: {
          claimId: 'claim_slow',
          proofData: 'valid_proof',
          publicSignals: ['1'],
          enclaveSignature: 'valid-signature',
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
          claimId: 'claim_fast',
          proofData: 'valid_proof',
          publicSignals: ['1'],
          enclaveSignature: 'valid-signature',
        },
      };

      // We intercept 'cmd_slow' and introduce artificial delay, but allow it.
      membrane.interceptors.register(async (ctx) => {
        if (ctx.commandId === 'cmd_slow') {
          await new Promise((r) => setTimeout(r, 80));
        }
        return true;
      });

      // Dispatch concurrently
      const promiseSlow = agentInterface.dispatch(updateCommand1);
      const promiseFast = agentInterface.dispatch(updateCommand2);

      await Promise.all([promiseSlow, promiseFast]);

      // Because command serialization is enforced via the commandQueue,
      // cmd_slow (dispatched first) is guaranteed to execute and settle
      // before cmd_fast (dispatched second) begins execution.
      // Thus, the final settled theme is 'green', preserving chronological intent.
      const verifyRequest: StateInspectionRequest = {
        path: 'settings.theme',
        zkp: {
          claimId: 'claim_verify_theme_resiliency',
          proofData: 'valid_proof',
          publicSignals: ['1'],
          enclaveSignature: 'valid-signature',
        },
      };
      const themeVal = await agentInterface.inspectState(verifyRequest);
      expect(themeVal).toBe('green');
    });
  });
});
