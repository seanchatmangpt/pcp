import { useState, useCallback } from 'react';
import { ZkClaim, ZkProof, ZkVerificationResult } from './types';
import { zkEngine } from './engine';

/**
 * Hook for verifying ZKP claims within the Pcp Framework.
 * Provides state management for the verification process.
 *
 * @returns {Object} { verifyClaim, isVerifying, result, error }
 *
 * @example
 * const { verifyClaim, isVerifying, result } = useZkClaimVerifier();
 *
 * const handleVerify = async () => {
 *   const claim = { id: 'over-18', field: 'age', operator: 'GTE', threshold: 18 };
 *   const proof = { claimId: 'over-18', proofData: '...', publicSignals: [] };
 *   await verifyClaim(claim, proof);
 * };
 */
export function useZkClaimVerifier() {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<ZkVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyClaim = useCallback(
    async (claim: ZkClaim, proof: ZkProof): Promise<ZkVerificationResult> => {
      setIsVerifying(true);
      setError(null);
      try {
        const verificationResult = await zkEngine.verify(claim, proof);
        setResult(verificationResult);
        if (verificationResult.error) {
          setError(verificationResult.error);
        }
        return verificationResult;
      } catch (e: any) {
        const errResult: ZkVerificationResult = {
          verified: false,
          claimId: claim.id,
          timestamp: Date.now(),
          error: e.message || 'Unknown error during verification',
        };
        setResult(errResult);
        setError(errResult.error || 'Unknown error');
        return errResult;
      } finally {
        setIsVerifying(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsVerifying(false);
    setResult(null);
    setError(null);
  }, []);

  return {
    verifyClaim,
    isVerifying,
    result,
    error,
    reset,
  };
}
