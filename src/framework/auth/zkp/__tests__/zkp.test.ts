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
    enclaveSignature: 'valid-signature',
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

    it('should fail if proof data is missing', async () => {
      const invalidProof = { ...mockProof, proofData: '' };
      const result = await zkEngine.verify(mockClaim, invalidProof);
      expect(result.verified).toBe(false);
    });

    it('should fail if public signals are missing', async () => {
      const invalidProof = { ...mockProof, publicSignals: null as any };
      const result = await zkEngine.verify(mockClaim, invalidProof);
      expect(result.verified).toBe(false);
    });

    it('should handle errors gracefully with default message', async () => {
      // Force an error with no message
      jest.spyOn(zkEngine as any, 'verifyEnclaveSignature').mockRejectedValueOnce({});
      const result = await zkEngine.verify(mockClaim, mockProof);
      expect(result.verified).toBe(false);
      expect(result.error).toBe('Verification failed');
    });

    it('should handle errors gracefully with provided message', async () => {
      const result = await zkEngine.verify(mockClaim, null as any);
      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail if proof structure contains trivial/zero values', async () => {
      const zeroProof = {
        ...mockProof,
        proofData: JSON.stringify({
          pi_a: ['0', '0', '1'],
          pi_b: [
            ['0', '0'],
            ['0', '0'],
            ['1', '0'],
          ],
          pi_c: ['0', '0', '1'],
        }),
      };
      const result = await zkEngine.verify(mockClaim, zeroProof);
      expect(result.verified).toBe(false);
    });

    it('should fail if proof contains bypass or dummy keywords in fields', async () => {
      const bypassProof = {
        ...mockProof,
        proofData: JSON.stringify({
          pi_a: ['11883344556677889900112233', '22883344556677889900112233', '1'],
          pi_b: [
            ['33883344556677889900112233', '44883344556677889900112233'],
            ['55883344556677889900112233', '66883344556677889900112233'],
            ['1', '0'],
          ],
          pi_c: ['77883344556677889900112233', '88883344556677889900112233', '1'],
          bypass: true,
        }),
      };
      const result = await zkEngine.verify(mockClaim, bypassProof);
      expect(result.verified).toBe(false);
    });

    it('should fail if proof fields are too short or trivial', async () => {
      const shortProof = {
        ...mockProof,
        proofData: JSON.stringify({
          pi_a: ['123', '456', '1'],
          pi_b: [
            ['123', '456'],
            ['123', '456'],
            ['1', '0'],
          ],
          pi_c: ['123', '456', '1'],
        }),
      };
      const result = await zkEngine.verify(mockClaim, shortProof);
      expect(result.verified).toBe(false);
    });

    it('should fail if proof fields contain repetitive/suspicious patterns', async () => {
      const repetitiveProof = {
        ...mockProof,
        proofData: JSON.stringify({
          pi_a: ['9999999999999999', '9999999999999999', '1'],
          pi_b: [
            ['9999999999999999', '9999999999999999'],
            ['9999999999999999', '9999999999999999'],
            ['1', '0'],
          ],
          pi_c: ['9999999999999999', '9999999999999999', '1'],
        }),
      };
      const result = await zkEngine.verify(mockClaim, repetitiveProof);
      expect(result.verified).toBe(false);
    });

    it('should fail if public signals contain bypass words', async () => {
      const bypassSignalProof = {
        ...mockProof,
        publicSignals: ['bypass'],
      };
      const result = await zkEngine.verify(mockClaim, bypassSignalProof);
      expect(result.verified).toBe(false);
    });

    it('should fail if public signals contain non-numeric value', async () => {
      const invalidSignalProof = {
        ...mockProof,
        publicSignals: ['invalid-123'],
      };
      const result = await zkEngine.verify(mockClaim, invalidSignalProof);
      expect(result.verified).toBe(false);
    });
  });

  describe('useZkClaimVerifier hook', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useZkClaimVerifier());
      expect(result.current.isVerifying).toBe(false);
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should verify a claim and update state', async () => {
      const { result } = renderHook(() => useZkClaimVerifier());

      let verificationPromise: any;
      await act(async () => {
        verificationPromise = result.current.verifyClaim(mockClaim, mockProof);
      });

      const verificationResult = await verificationPromise;
      expect(verificationResult.verified).toBe(true);
      expect(result.current.isVerifying).toBe(false);
      expect(result.current.result?.verified).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle verification errors in hook', async () => {
      const { result } = renderHook(() => useZkClaimVerifier());
      const invalidProof = { ...mockProof, claimId: 'wrong-id' };

      await act(async () => {
        await result.current.verifyClaim(mockClaim, invalidProof);
      });

      expect(result.current.isVerifying).toBe(false);
      expect(result.current.result?.verified).toBe(false);
      expect(result.current.error).toBe('Proof claimId mismatch');
    });

    it('should catch unexpected errors with provided message', async () => {
      const { result } = renderHook(() => useZkClaimVerifier());

      const originalVerify = zkEngine.verify;
      zkEngine.verify = jest.fn().mockRejectedValue(new Error('Unexpected crash'));

      await act(async () => {
        await result.current.verifyClaim(mockClaim, mockProof);
      });

      expect(result.current.error).toBe('Unexpected crash');
      expect(result.current.result?.verified).toBe(false);

      zkEngine.verify = originalVerify;
    });

    it('should catch unexpected errors with default message', async () => {
      const { result } = renderHook(() => useZkClaimVerifier());

      const originalVerify = zkEngine.verify;
      zkEngine.verify = jest.fn().mockRejectedValue({}); // No message

      await act(async () => {
        await result.current.verifyClaim(mockClaim, mockProof);
      });

      expect(result.current.error).toBe('Unknown error during verification');
      expect(result.current.result?.verified).toBe(false);

      zkEngine.verify = originalVerify;
    });

    it('should reset state', async () => {
      const { result } = renderHook(() => useZkClaimVerifier());

      await act(async () => {
        await result.current.verifyClaim(mockClaim, mockProof);
      });

      expect(result.current.result).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isVerifying).toBe(false);
    });
  });
});
