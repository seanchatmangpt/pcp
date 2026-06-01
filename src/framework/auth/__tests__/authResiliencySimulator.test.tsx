import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { MfaProvider } from '../mfa/MfaProvider';
import { useMfaVerification } from '../mfa/useMfaVerification';
import { useBehavioralAuth } from '../behavioral/useBehavioralAuth';
import { zkEngine } from '../zkp/engine';
import { MfaChallenge } from '../mfa/types';
import { ZkClaim, ZkProof } from '../zkp/types';

describe('Auth Resiliency and Gating Simulator', () => {
  describe('MFA Concurrency & Expiration Race Conditions', () => {
    const mockOnInitiateChallenge = jest.fn();
    const mockOnVerifyCode = jest.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MfaProvider
        onInitiateChallenge={mockOnInitiateChallenge}
        onVerifyCode={mockOnVerifyCode}
        verificationGracePeriod={5000} // 5 seconds grace period
      >
        {children}
      </MfaProvider>
    );

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.spyOn(Date, 'now');
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('Scenario 1: Concurrency Race - Overwriting Active Challenge & Promise Leakage', async () => {
      // Setup slow challenge responses
      let resolveChallenge1: any;
      let resolveChallenge2: any;

      const p1 = new Promise<MfaChallenge>((resolve) => {
        resolveChallenge1 = resolve;
      });
      const p2 = new Promise<MfaChallenge>((resolve) => {
        resolveChallenge2 = resolve;
      });

      mockOnInitiateChallenge.mockReturnValueOnce(p1).mockReturnValueOnce(p2);

      const { result } = renderHook(() => useMfaVerification(), { wrapper });

      // Trigger concurrent verify calls A and B
      let verifyPromiseA: Promise<any>;
      let verifyPromiseB: Promise<any>;

      await act(async () => {
        verifyPromiseA = result.current.verify({ strategy: 'totp' });
      });

      await act(async () => {
        verifyPromiseB = result.current.verify({ strategy: 'sms' });
      });

      // Resolve the initializations
      const challenge1: MfaChallenge = {
        id: 'chal-1',
        strategy: 'totp',
        expiresAt: Date.now() + 60000,
      };
      const challenge2: MfaChallenge = {
        id: 'chal-2',
        strategy: 'sms',
        expiresAt: Date.now() + 60000,
      };

      await act(async () => {
        resolveChallenge1(challenge1);
      });
      await act(async () => {
        resolveChallenge2(challenge2);
      });

      // Verify that active challenge is updated to the latest (chal-2)
      expect(result.current.activeChallenge?.id).toBe('chal-2');

      // Now confirm verification with code. It should verify challenge-2.
      mockOnVerifyCode.mockResolvedValue({ success: true, token: 'token-for-chal-2' });

      let confirmResult = false;
      await act(async () => {
        confirmResult = await result.current.confirm('111222');
      });

      expect(confirmResult).toBe(true);

      // Verify B resolves with success
      const resB = await verifyPromiseB!;
      expect(resB.verified).toBe(true);
      expect(resB.token).toBe('token-for-chal-2');

      // Crucial: check Promise A. Since it was overwritten in the state, it will remain hung in pending,
      // creating a leaked promise/unresolved state unless handled.
      // We check if it is still unresolved (or resolved with B's results due to shared reference).
      // Under the current design, A's resolve reference was overwritten by B:
      // setPendingVerification({ resolve }) in MfaProvider overwrites the state.
      // Since verifyPromiseA's executor's resolve was replaced, verifyPromiseA will NEVER resolve.
      // We can assert this by checking that it remains pending even after advancing timers.
      let aResolved = false;
      verifyPromiseA!.then(() => {
        aResolved = true;
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(aResolved).toBe(false); // Leaked/hung promise verified!
    });

    it('Scenario 2: Grace Period Bypass under Client-Side Clock Drift', async () => {
      const challenge: MfaChallenge = { id: 'chal-grace', strategy: 'totp', expiresAt: 1060000 };
      mockOnInitiateChallenge.mockResolvedValue(challenge);
      mockOnVerifyCode.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMfaVerification(), { wrapper });

      const initialTime = 1000000;
      (Date.now as jest.Mock).mockReturnValue(initialTime);

      // 1. Perform initial verification
      await act(async () => {
        result.current.verify();
      });
      await act(async () => {
        await result.current.confirm('123456');
      });

      expect(result.current.isVerified).toBe(true);
      expect(result.current.lastVerifiedAt).toBe(initialTime);

      // 2. Simulate local system clock manipulation: client system clock drifts backward
      // to 999900 (e.g. user manually changes clock or NTP sync correction occurs)
      (Date.now as jest.Mock).mockReturnValue(999900);

      // Verify again. Since (now - lastVerifiedAt) = (999900 - 1000000) = -100 < 5000,
      // it bypasses verification, even though time-wise it's structurally inconsistent (negative time delta).
      let verifyResult: { verified: boolean } | undefined;
      await act(async () => {
        verifyResult = await result.current.verify();
      });

      expect(verifyResult?.verified).toBe(true);
      expect(mockOnInitiateChallenge).toHaveBeenCalledTimes(1); // No new challenge initiated!
    });
  });

  describe('Behavioral Biometrics Gating and Lockouts', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(Date, 'now');
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('Scenario 3: Bot Typing & Navigation Burst Detection vs. Sensitivity Gating', () => {
      const { result } = renderHook(() =>
        useBehavioralAuth({ updateInterval: 1000, sensitivity: 0.8 })
      );

      const baseTime = 2000000;
      (Date.now as jest.Mock).mockReturnValue(baseTime);

      // Simulate bot keystrokes (extremely high speed, 10ms intervals)
      act(() => {
        result.current.recordKeystroke();
      });
      (Date.now as jest.Mock).mockReturnValue(baseTime + 10);
      act(() => {
        result.current.recordKeystroke();
      });
      (Date.now as jest.Mock).mockReturnValue(baseTime + 20);
      act(() => {
        result.current.recordKeystroke();
      });

      // Simulate navigation burst (150 interactions in rapid succession)
      act(() => {
        for (let i = 0; i < 150; i++) {
          result.current.recordInteraction();
        }
      });

      // Trigger metric recalculation
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Trust score should be drastically reduced
      // Heuristic 1 typing speed is 10ms (<50ms threshold) => score -= sensitivity * 0.3 = 0.8 * 0.3 = 0.24
      // Heuristic 2 rhythm is 150 (>100 threshold) => score -= sensitivity * 0.4 = 0.8 * 0.4 = 0.32
      // Total reduction = 0.56, final score = 0.44
      expect(result.current.trustScore).toBeCloseTo(0.44, 2);
    });
  });

  describe('ZKP Proof Boundary Analysis', () => {
    it('Scenario 4: ZKP Claim Verification Mismatch and Missing Structures', async () => {
      const claim: ZkClaim = {
        id: 'zk-claim-age',
        field: 'age',
        operator: 'GTE',
        threshold: 18,
      };

      // Proof for a different claim ID
      const mismatchedProof: ZkProof = {
        claimId: 'zk-claim-other',
        proofData: 'dummy-data',
        publicSignals: ['18'],
      };

      const resultMismatch = await zkEngine.verify(claim, mismatchedProof);
      expect(resultMismatch.verified).toBe(false);
      expect(resultMismatch.error).toBe('Proof claimId mismatch');

      // Malformed proof (missing structure)
      const malformedProof: ZkProof = {
        claimId: 'zk-claim-age',
        proofData: '',
        publicSignals: [],
      };

      const resultMalformed = await zkEngine.verify(claim, malformedProof);
      expect(resultMalformed.verified).toBe(false);
    });
  });
});
