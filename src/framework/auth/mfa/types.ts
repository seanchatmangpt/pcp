/**
 * @fileoverview Type definitions for the MFA (Multi-Factor Authentication) abstraction layer.
 */

export type MfaStrategy = 'totp' | 'sms' | 'email' | 'biometric';

export interface MfaChallenge {
  id: string;
  strategy: MfaStrategy;
  expiresAt: number;
  /** Optional metadata for the challenge (e.g., masked phone number) */
  metadata?: Record<string, any>;
}

export interface MfaVerificationOptions {
  /** The MFA strategy to use for verification */
  strategy?: MfaStrategy;
  /** Custom message or reason for the verification */
  reason?: string;
  /** Whether to bypass verification if already verified in the current session */
  skipIfAlreadyVerified?: boolean;
}

export interface MfaVerificationResult {
  verified: boolean;
  token?: string;
  error?: Error;
}

export interface MfaProviderState {
  isVerified: boolean;
  lastVerifiedAt?: number;
  activeChallenge?: MfaChallenge | null;
}

export interface MfaContextValue extends MfaProviderState {
  /** Initiate a verification flow */
  verify: (options?: MfaVerificationOptions) => Promise<MfaVerificationResult>;
  /** Complete an active challenge with a code */
  confirm: (code: string) => Promise<boolean>;
  /** Cancel the active challenge */
  cancel: () => void;
}
