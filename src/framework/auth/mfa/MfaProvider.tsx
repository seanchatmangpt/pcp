import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  MfaChallenge,
  MfaVerificationOptions,
  MfaVerificationResult,
  MfaStrategy,
  MfaContextValue,
} from './types';

const MfaContext = createContext<MfaContextValue | undefined>(undefined);

export interface MfaProviderProps {
  children: ReactNode;
  /** Callback to initiate a challenge for a given strategy */
  onInitiateChallenge: (strategy: MfaStrategy) => Promise<MfaChallenge>;
  /** Callback to verify a code for an active challenge */
  onVerifyCode: (
    challengeId: string,
    code: string
  ) => Promise<{ success: boolean; token?: string }>;
  /** Optional: minimum time (ms) between required verifications */
  verificationGracePeriod?: number;
}

/**
 * MfaProvider manages the state of Multi-Factor Authentication challenges and verifications.
 */
export const MfaProvider: React.FC<MfaProviderProps> = ({
  children,
  onInitiateChallenge,
  onVerifyCode,
  verificationGracePeriod = 0,
}) => {
  const [isVerified, setIsVerified] = useState(false);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<number | undefined>(undefined);
  const [activeChallenge, setActiveChallenge] = useState<MfaChallenge | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{
    resolve: (result: MfaVerificationResult) => void;
  } | null>(null);

  const verify = useCallback(
    async (options: MfaVerificationOptions = {}): Promise<MfaVerificationResult> => {
      const { strategy = 'totp', skipIfAlreadyVerified = true } = options;

      // Check if we can skip verification
      if (skipIfAlreadyVerified && isVerified && lastVerifiedAt) {
        const now = Date.now();
        if (now - lastVerifiedAt < verificationGracePeriod) {
          return { verified: true };
        }
      }

      try {
        const challenge = await onInitiateChallenge(strategy);
        setActiveChallenge(challenge);

        return new Promise<MfaVerificationResult>((resolve) => {
          setPendingVerification({ resolve });
        });
      } catch (error) {
        return { verified: false, error: error as Error };
      }
    },
    [isVerified, lastVerifiedAt, onInitiateChallenge, verificationGracePeriod]
  );

  const confirm = useCallback(
    async (code: string): Promise<boolean> => {
      if (!activeChallenge || !pendingVerification) {
        return false;
      }

      try {
        const result = await onVerifyCode(activeChallenge.id, code);
        if (result.success) {
          setIsVerified(true);
          setLastVerifiedAt(Date.now());
          setActiveChallenge(null);
          pendingVerification.resolve({ verified: true, token: result.token });
          setPendingVerification(null);
          return true;
        }
        return false;
      } catch (error) {
        console.error('MFA verification error:', error);
        return false;
      }
    },
    [activeChallenge, onVerifyCode, pendingVerification]
  );

  const cancel = useCallback(() => {
    if (pendingVerification) {
      pendingVerification.resolve({ verified: false });
      setPendingVerification(null);
    }
    setActiveChallenge(null);
  }, [pendingVerification]);

  return (
    <MfaContext.Provider
      value={{
        isVerified,
        lastVerifiedAt,
        activeChallenge,
        verify,
        confirm,
        cancel,
      }}>
      {children}
    </MfaContext.Provider>
  );
};

/**
 * Internal hook to access MFA context.
 * Use useMfaVerification for public API.
 */
export const useMfa = () => {
  const context = useContext(MfaContext);
  if (context === undefined) {
    throw new Error('useMfa must be used within an MfaProvider');
  }
  return context;
};
