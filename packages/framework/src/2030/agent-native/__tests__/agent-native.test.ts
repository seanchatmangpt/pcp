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
    enclaveSignature: '0x1234567890123456789012345678901234567890ab',
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
  });
});
