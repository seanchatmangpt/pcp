import { renderHook, act } from '@testing-library/react-native';
import { zkEngine, ZkEngine } from '../engine';
import { useZkClaimVerifier } from '../hooks';
import { ZkClaim, ZkProof } from '../types';

describe('ZKP Framework', () => {
  const mockClaim: ZkClaim = {
    id: 'over-18',
    field: 'age',
    operator: 'GTE',
    threshold: 18,
    description: 'User must be over 18',
  };

  const mockProof: ZkProof = {
    claimId: 'over-18',
    proofData: JSON.stringify({
      pi_a: ['11883344556677889900112233', '22883344556677889900112233', '1'],
      pi_b: [
        ['33883344556677889900112233', '44883344556677889900112233'],
        ['55883344556677889900112233', '66883344556677889900112233'],
        ['1', '0'],
      ],
      pi_c: ['77883344556677889900112233', '88883344556677889900112233', '1'],
    }),
    publicSignals: ['18'],
    enclaveSignature: '0x1234567890123456789012345678901234567890abcdef1234567890',
  };

  describe('ZkEngine', () => {
    it('should verify a valid proof', async () => {
      const result = await zkEngine.verify(mockClaim, mockProof);
      expect(result.verified).toBe(true);
      expect(result.claimId).toBe(mockClaim.id);
      expect(result.error).toBeUndefined();
    });

    it('should cover getInstance singleton branch', () => {
      const instance1 = ZkEngine.getInstance();
      const instance2 = ZkEngine.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should fail if claimId mismatches', async () => {
      const invalidProof = { ...mockProof, claimId: 'wrong-id' };
      const result = await zkEngine.verify(mockClaim, invalidProof);
      expect(result.verified).toBe(false);
      expect(result.error).toBe('Proof claimId mismatch');
    });
  });
});
