import { useMfa } from './MfaProvider';
import { MfaVerificationOptions, MfaVerificationResult } from './types';

/**
 * useMfaVerification provides a high-level API for triggering MFA challenges
 * and managing the verification lifecycle within the Pcp Framework.
 *
 * @example
 * ```tsx
 * const { verify, activeChallenge, confirm } = useMfaVerification();
 *
 * const handleSensitiveAction = async () => {
 *   const { verified } = await verify({ strategy: 'totp' });
 *   if (verified) {
 *     // Proceed with high-security action
 *   }
 * };
 * ```
 */
export function useMfaVerification() {
  const { verify, confirm, cancel, activeChallenge, isVerified, lastVerifiedAt } = useMfa();

  /**
   * Wraps an action with MFA verification.
   * Only executes the action if MFA is successful.
   */
  const withMfa = async <T>(
    action: () => Promise<T> | T,
    options?: MfaVerificationOptions
  ): Promise<T | null> => {
    const { verified } = await verify(options);
    if (verified) {
      return await action();
    }
    return null;
  };

  return {
    /**
     * Triggers the MFA verification flow.
     * Returns a promise that resolves when the user completes or cancels the challenge.
     */
    verify,
    /**
     * Submits a code to confirm the active MFA challenge.
     */
    confirm,
    /**
     * Cancels the currently active MFA challenge.
     */
    cancel,
    /**
     * Executes an action only after successful MFA verification.
     */
    withMfa,
    /**
     * The currently active MFA challenge (e.g., to display a code input field).
     */
    activeChallenge,
    /**
     * Boolean indicating if there is a pending MFA challenge.
     */
    isPending: !!activeChallenge,
    /**
     * Boolean indicating if the user has been MFA-verified in the current session.
     */
    isVerified,
    /**
     * Timestamp of the last successful MFA verification.
     */
    lastVerifiedAt,
  };
}
